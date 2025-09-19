// variables globales
let map = null;
let userCircle = null;
let markersLayer = null;
let locationsCache = [];
const geocodeCache = new Map();
let lastUserPos = null;
let currentMarker = null;

const statusElement = document.getElementById("status");
const statusPanel = document.getElementById("statusPanel");

// icono marcador
const redIcon = new L.Icon({
  iconUrl: 'redMarkerIcon.png',
  iconSize: [100, 100],
  iconAnchor: [50, 100],
  popupAnchor: [0, -100]
});

// inicializa mapa
async function initApp(lat, lon, direccion) {
  if (map) return;

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
  updateMarkersForPosition(lat, lon);
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
        document.getElementById(infoPanel).classList.remove("hide");
        document.getElementById("infoPanel").classList.add("show");
        updateFavButton(marker.info.id);
      });
      marker.addTo(markersLayer);
    }
  }
}

// mueve círculo usuario
function updateUserLocation(lat, lon) {
  if (!map) return;
  if (userCircle) userCircle.setLatLng([lat, lon]);
  else userCircle = L.circleMarker([lat, lon], { radius: 30, weight: 4 }).addTo(map);

  if (!lastUserPos) map.setView([lat, lon], 15);
  else {
    const movedKm = getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon);
    if (movedKm > 0.2) map.panTo([lat, lon]);
  }

  if (!lastUserPos || getDistanceFromLatLonInKm(lastUserPos.lat, lastUserPos.lon, lat, lon) >= 0.03) {
    updateMarkersForPosition(lat, lon);
  }

  lastUserPos = { lat, lon };
}

// obtiene dirección inversa
async function getAddress(lat, lon) {
  const res = await fetch(`/api/getAddress?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Error en backend reverse");
  const data = await res.json();
  const display = data.display_name || '';

  if (!map) await initApp(lat, lon, display);
  else updateUserLocation(lat, lon);
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
function getFavorites() {
  return JSON.parse(localStorage.getItem("favorites") || "[]");
}
function saveFavorites(favs) {
  localStorage.setItem("favorites", JSON.stringify(favs));
}
function isFavorite(id) {
  return getFavorites().some(f => f.id === id);
}
function toggleFavorite(currentLoc) {
  let favs = getFavorites();
  if (isFavorite(currentLoc.id)) {
    favs = favs.filter(f => f.id !== currentLoc.id);
  } else {
    favs.push(currentLoc);
  }
  saveFavorites(favs);
  updateFavoritesUI();
  updateFavButton(currentLoc.id);
}
function updateFavButton(id) {
  const btn = document.getElementById("toggleFavorite");
  if (!btn) return;
  if (isFavorite(id)) btn.textContent = "★ Quitar de favoritos";
  else btn.textContent = "☆ Añadir a favoritos";
}
function updateFavoritesUI() {
  const list = document.getElementById("favoritesList");
  list.innerHTML = "";
  const favs = getFavorites();
  if (favs.length === 0) {
    list.innerHTML = "<p>No tienes favoritos aún.</p>";
    return;
  }
  favs.forEach(loc => {
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.innerHTML = `
      <span>${loc.name}</span>
      <button onclick="showFavorite('${loc.id}')">Ver</button>
    `;
    list.appendChild(item);
  });
}
function showFavorite(id) {
  const fav = getFavorites().find(f => f.id === id);
  if (fav) {
    document.getElementById("panelTitle").textContent = fav.name;
    document.getElementById("addressPanel").textContent = fav.address;
    document.getElementById("infoPanel").classList.add("show");
    updateFavButton(fav.id);
  }
}

// listeners
document.getElementById("favButton").addEventListener("click", () => {
  document.getElementById("favoritesPanel").classList.toggle("show");
  updateFavoritesUI();
});
document.getElementById("toggleFavorite").addEventListener("click", () => {
  if (currentMarker) toggleFavorite(currentMarker.info);
});
