// variables globales
let map = null;
let userCircle = null;
let markersLayer = null;
let locationsCache = [];
const geocodeCache = new Map();
let lastUserPos = null;
let currentMarker = null;
let favorites = [{}];

const statusElement = document.getElementById("status");
const statusPanel = document.getElementById("statusPanel");

// icono marcador
const redIcon = new L.Icon({
  iconUrl: 'redMarkerIcon.png',
  iconSize: [100, 100],
  iconAnchor: [50, 100],
  popupAnchor: [0, -100]
});

// icono marcador favorito
const favIcon = new L.Icon({
  iconUrl: 'favMarkerIcon.png',
  iconSize: [100, 100],
  iconAnchor: [50, 100],
  popupAnchor: [0, -100]
});

// inicializa mapa
async function initApp(lat, lon, direccion) {
  if (map) return;
  lastUserPos = { lat, lon };

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

  await loadAndCacheLocations();
  await updateMarkersForPosition(lat, lon);
}

// carga locations
async function loadAndCacheLocations() {
  const list = await fetch('/api/locations').then(r => r.json());

  for (const l of list) {
    try {
      if (geocodeCache.has(l.address)) {
        locationsCache.push({ ...l, coords: geocodeCache.get(l.address) });
      } else {
        const coords = await getLatLon(l.address).catch(() => null);
        if (coords) {
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

// crea marcadores
async function updateMarkersForPosition(lat, lon) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  await loadFavorites();

  for (const loc of locationsCache) {
    if (!loc.coords) continue;
    const lat2 = Number(loc.coords.lat), lon2 = Number(loc.coords.lon);
    if (getDistanceFromLatLonInKm(lat2, lon2, lat, lon) <= 5) {
      const markerIcon = favorites.some(f => f.nombre === loc.name) ? favIcon : redIcon;
      const marker = L.marker([lat2, lon2], { icon: markerIcon });
      marker.info = loc;
      marker.on("click", () => {
        currentMarker = marker;
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
        document.getElementById("infoPanel").style.display = "block";// Mostrar el panel (colapsado al inicio)
 

        // Mostrar el panel (colapsado al inicio)
        const panel = document.getElementById("infoPanel");
        panel.classList.add("visible");
        panel.classList.remove("expanded"); // empieza cerrado

        updateFavButton(marker.info.id);
         // 👇 Guardamos el id globalmente
        globalThis.currentLocationId = loc.id;

        // Mostramos el panel
        document.getElementById("infoPanel").style.display = "block";
      });
      marker.addTo(markersLayer);
    }
  }
}

// mueve círculo usuario
async function updateUserLocation(lat, lon) {
  if (!map) return;
  if (userCircle) userCircle.setLatLng([lat, lon]);
  else userCircle = L.circleMarker([lat, lon], { radius: 30, weight: 4 }).addTo(map);

  if (!lastUserPos) map.setView([lat, lon], 15);
  else {
    const movedKm = getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon);
    if (movedKm > 0.2) map.panTo([lat, lon]);
  }

  if (!lastUserPos || getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon) >= 0.03) {
    await updateMarkersForPosition(lat, lon);
  }

  lastUserPos = { lat, lon };
}

// obtiene dirección inversa
async function getAddress(lat, lon) {
  const res = await fetch(`/api/getAddress?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Error en backend reverse");
  const data = await res.json();
  const display = data.display_name || '';

  if (!map) {
    await initApp(lat, lon, display);
  } else {
    await updateUserLocation(lat, lon);
  }
}

async function getLatLon(direccion) {
  const res = await fetch(`/api/getLatLon?q=${encodeURIComponent(direccion)}`);
  if (!res.ok) throw new Error("Error en backend reverse");
  const data = await res.json();
  if (data.length > 0) return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  else return null;
}

// geoloc
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
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
    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
  );
} else {
  statusElement.textContent = "Geolocalización no soportada en este navegador.";
}

// auxiliares
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

// cerrar panel
function closePanel() {
  const infoPanel = document.getElementById("infoPanel");
  infoPanel.classList.remove("show");
  infoPanel.classList.add("hide");
  infoPanel.addEventListener("animationend", function handler() {
    infoPanel.style.display = "none";
    infoPanel.classList.remove("hide");
    infoPanel.removeEventListener("animationend", handler);
  });
}

// volver
function goBack() { window.location.href = "index.html"; }

// -------------------- FAVORITOS --------------------
async function loadFavorites() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/favorites", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  favorites = await res.json();
}

async function toggleFavorite(currentLoc) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/favorites/toggle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ nombreUbicacion: currentLoc.name })
  });
  const data = await res.json();
  console.log(data.message);
  updateFavoritesUI();
  updateFavButton(currentLoc.name);
  await updateMarkersForPosition(lastUserPos.lat, lastUserPos.lon);
}

async function isFavorite(nombreUbicacion) {
  return favorites.some(f => f.nombre === nombreUbicacion);
}

async function updateFavButton(nombreUbicacion) {
  const btn = document.getElementById("toggleFavorite");
  if (!btn) return;
  if (await isFavorite(nombreUbicacion)) {
    btn.textContent = "★ Quitar de favoritos";
  } else {
    btn.textContent = "☆ Añadir a favoritos";
  }
}

async function updateFavoritesUI() {
  const list = document.getElementById("favoritesList");
  list.innerHTML = "";
  if (favorites.length === 0) {
    list.innerHTML = "<p>No tienes favoritos aún.</p>";
    return;
  }
  for(const loc of favorites) {
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.innerHTML = `
      <span>${loc.nombre}</span>
      <button onclick="showFavorite('${loc.idubicacion}', '${loc.nombre}', '${loc.direccion}')">Ver</button>
    `;
    list.appendChild(item);
  };
}

function showFavorite(id, nombre, direccion) {
  document.getElementById("panelTitle").textContent = nombre;
  document.getElementById("addressPanel").textContent = direccion;
  document.getElementById("infoPanel").classList.remove("hide");
  document.getElementById("infoPanel").classList.add("show");
  document.getElementById("infoPanel").style.display = "block";
  updateFavButton(nombre);
}

// listeners
document.getElementById("favButton").addEventListener("click", () => {
  document.getElementById("favoritesPanel").classList.toggle("show");
  updateFavoritesUI();
});
document.getElementById("toggleFavorite").addEventListener("click", () => {
  if (currentMarker) toggleFavorite(currentMarker.info);
});

let expanded = false;
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("infoPanel");
  const handle = document.getElementById("dragHandle");


  handle.addEventListener("click", () => {
    expanded = !expanded;
    if (expanded) {
      panel.classList.add("expanded");
    } else {
      panel.classList.remove("expanded");
    }
  });
});

