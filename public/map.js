// variables globales reutilizables
let map = null;
let userCircle = null;
let markersLayer = null;
let locationsCache = [];           // locations con coords { ...info, coords: {lat, lon} }
const geocodeCache = new Map();    // cache por dirección
let lastUserPos = null;            // {lat, lon}
const minDistanceToUpdateKm = 0.03; // ~30 metros - umbral para recargar marcadores

const statusElement = document.getElementById("status");
const statusPanel = document.getElementById("statusPanel");

// icono (global)
const redIcon = new L.Icon({
  iconUrl: 'redMarkerIcon.png',
  iconSize: [100, 100],
  iconAnchor: [50, 100],
  popupAnchor: [0, -100]
});

// inicializa mapa la primera vez
async function initApp(lat, lon, direccion) {
  if (map) return; // ya inicializado

  map = L.map('map', {
    center: [lat, lon],
    zoom: 15,
    touchZoom: true,
    tap: true,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  userCircle = L.circleMarker([lat, lon], { radius: 30, weight: 4 }).addTo(map);

  // cargar y geocodificar direcciones una vez (cache)
  await loadAndCacheLocations();

  // llenar marcadores iniciales
  updateMarkersForPosition(lat, lon);
}

// carga locations del backend y geocodifica (con cache)
async function loadAndCacheLocations() {
  const list = await fetch('/api/locations').then(r => r.json());

  // geocodificar secuencialmente o con Promise.all pero cuidado con rate limits
  for (const l of list) {
    try {
      if (geocodeCache.has(l.address)) {
        locationsCache.push({ ...l, coords: geocodeCache.get(l.address) });
      } else {
        const coords = await getLatLon(l.address).catch(() => null);
        if (coords) {
          // convertir a number por si vienen strings
          const parsed = { lat: Number(coords.lat), lon: Number(coords.lon) };
          geocodeCache.set(l.address, parsed);
          locationsCache.push({ ...l, coords: parsed });
        }
      }
    } catch (e) {
      console.warn('Error geocodificando', l.address, e);
    }
  }
}

// actualiza los marcadores visibles según la posición del usuario
function updateMarkersForPosition(lat, lon) {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  for (const loc of locationsCache) {
    if (!loc.coords) continue;
    const lat2 = Number(loc.coords.lat), lon2 = Number(loc.coords.lon);
    if (getDistanceFromLatLonInKm(lat2, lon2, lat, lon) <= 5) {
      const marker = L.marker([lat2, lon2], { icon: redIcon });
      marker.info = loc;
      marker.on("click", () => {
        document.getElementById("panelTitle").textContent = marker.info.name;
        document.getElementById("addressPanel").textContent = marker.info.address;
        document.getElementById("establishmentPanel").textContent = marker.info.establishment;
        document.getElementById("extinguishPanel").textContent = (`Extintores: ${marker.info.numExtinguisher}`);
        document.getElementById("firstAidPanel").textContent = (`Botiquín de Primeros Auxilios: ${marker.info.firstAid ? "Sí" : "No"}`);
        document.getElementById("sprinklerPanel").textContent = (`Rociadores Automáticos: ${marker.info.sprinklers ? "Sí" : "No"}`);
        document.getElementById("emergenExitPanel").textContent = (`Salidas de emergencia: ${marker.info.emergncyExits}`);
        document.getElementById("inspectionPanel").textContent = (`Última Inspección de Seguridad: ${marker.info.lastInspection} 📆`);
        document.getElementById("accessPanel").textContent = (`Características de Accesibilidad: ${marker.info.accessibility}`);
        document.getElementById("infoPanel").classList.remove("hide");
        document.getElementById("infoPanel").classList.add("show");
        document.getElementById("infoPanel").style.display = "block";
      });
      marker.addTo(markersLayer);
    }
  }
}

// mueve el circulo del usuario y actualiza marcadores si hace falta
function updateUserLocation(lat, lon) {
  if (!map) return;
  if (userCircle) {
    userCircle.setLatLng([lat, lon]);
  } else {
    userCircle = L.circleMarker([lat, lon], { radius: 30, weight: 4 }).addTo(map);
  }

  // centrar suavemente si la distancia es significativa
  if (!lastUserPos) {
    map.setView([lat, lon], 15);
  } else {
    const movedKm = getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon);
    if (movedKm > 0.2) { // si se mueve >200m, hacer pan/zoom (ajustable)
      map.panTo([lat, lon]);
    }
  }

  // actualizar marcadores solo si se movió un mínimo (ahorra llamadas)
  if (!lastUserPos || getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon) >= minDistanceToUpdateKm) {
    updateMarkersForPosition(lat, lon);
  }

  lastUserPos = { lat, lon };
}

// obtiene dirección inversa y llama a initApp o updateUserLocation según corresponda
async function getAddress(lat, lon) {
  const res = await fetch(`/api/getAddress?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error("Error en backend reverse");
  }
  const data = await res.json();
  const display = data.display_name || '';

  if (!map) {
    await initApp(lat, lon, display);
  } else {
    updateUserLocation(lat, lon);
  }
}

// tu función getLatLon queda igual pero cuidando parseo
async function getLatLon(direccion) {
  const res = await fetch(`/api/getLatLon?q=${encodeURIComponent(direccion)}`);
  if (!res.ok) throw new Error("Error en backend reverse");
  const data = await res.json();
  if (data.length > 0) {
    return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  } else {
    return null;
  }
}

// watchPosition: sólo pide address/actualización cuando hay nueva posición
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      console.log(`Latitud de Usuario: ${lat}, Longitud de Usuario ${lon}`);
      // Usa la función centralizada
      getAddress(lat, lon).catch(err => {
        console.error(err);
        statusElement.textContent = "Error: " + err.message;
        statusPanel.style.display = "block";
      });
      statusPanel.style.display = "none";
    },
    err => {
      statusElement.textContent = "Error: " + err.message;
      statusPanel.style.display = "block";
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );
} else {
  statusElement.textContent = "Geolocalización no soportada en este navegador.";
}

/* funciones auxiliares (igual que las tuyas) */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }


//---------------------------------------------------------------------------------------------------------------------------

function closePanel() {
    const infoPanel = document.getElementById("infoPanel");

    infoPanel.classList.remove("show");
    infoPanel.classList.add("hide");

    //EventListener para esperar a que termine animacion de cierre para esconder el panel
    infoPanel.addEventListener("animationend", function handler() {
        infoPanel.style.display = "none";
        infoPanel.classList.remove("hide");
        infoPanel.removeEventListener("animationend", handler);
    });
}

//---------------------------------------------------------------------------------------------------------------------------

function goBack() {
    window.location.href = "index.html"; // Redirige a la página principal
}
