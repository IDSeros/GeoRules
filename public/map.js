//---------------------------------------------------------------------------------------------------------------------------

async function initMap(lat, lon, direccion) {
    const locationList = [{lat: 25.62838011058238, lon: -100.30402303520061}, {lat: 25.651100767545586, lon: -100.26618896222656}, {lat: 25.63027923400895, lon: -100.30287950319702}];
    const locationAddress = [{name: '7-Eleven', address: 'Paseo del Acueducto 4366, Laderas del Mirador, 64765 Monterrey, Nuevo León'},{name: 'Iglesia San Nicolás de Bari',address: 'Mauritania, Laderas del Mirador, 64765 Monterrey, Nuevo León'}, {name: 'H-E-B',address: 'Av. Eugenio Garza Sada 4321, Contry, 64860 Monterrey, Nuevo León'}];
    //Formato Visual de los marcadores en el mapa
    const redIcon = new L.Icon({
        iconUrl: 'redMarkerIcon.png',
        iconSize: [100, 100],   // tamaño grande
        iconAnchor: [50, 100],  // mitad ancho, base abajo
        popupAnchor: [0, -100]
    });

    const map = L.map('map').setView([lat, lon], 50); //Coordenadas y 'Zoom' en el mapa

    // Capa de mapa base (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Marcador con dirección actual
    L.circleMarker([lat, lon], {radius : 30, weight : 4})
      .addTo(map)
      .bindPopup(`<b>Estás aquí</b><br>${direccion}`)
      .openPopup();

    for (const l of locationList) {
        if(getDistanceFromLatLonInKm(l.lat, l.lon, lat, lon) <= 7){
            const nombreDireccion = await justGetAddres(l.lat, l.lon);
            console.log(nombreDireccion);
            if (nombreDireccion){
                L.marker([l.lat, l.lon], {icon : redIcon})
                    .addTo(map)
                    .bindPopup(`${nombreDireccion}`);
            }
        }
    };

    for (const l of locationAddress) {
        const coordinates = await getLatLon(l.address);
        if(getDistanceFromLatLonInKm(coordinates.lat, coordinates.lon, lat, lon) <= 7){
            console.log(l.address);
            if (coordinates.lat){
                const marker = L.marker([coordinates.lat, coordinates.lon], {icon : redIcon})
                .addTo(map)

                marker.info = l;

                // Evento de click para mostrar en panel
                marker.on("click", () => {
                    document.getElementById("panelTitle").textContent = marker.info.name;
                    document.getElementById("addressPanel").textContent = marker.info.address;
                    document.getElementById("infoPanel").style.display = "block";
                });
            }
        }
    }

}

//---------------------------------------------------------------------------------------------------------------------------

async function justGetAddres(lat, lon) {
    const res = await fetch(`/api/getAddress?lat=${lat}&lon=${lon}`);
    if (!res.ok) {
        throw new Error("Error en backend reverse");
    }
    const data = await res.json();

    return data.display_name || "Dirección no encontrada";
}

//---------------------------------------------------------------------------------------------------------------------------

async function getLatLon(direccion) {
    const res = await fetch(`/api/getLatLon?q=${encodeURIComponent(direccion)}`);
    if (!res.ok) {
        throw new Error("Error en backend reverse");
    }

    const data = await res.json();

    if (data.length > 0) {
        console.log(`Latitud: ${data[0].lat}, Longitud: ${data[0].lon}`);
        return { lat: data[0].lat, lon: data[0].lon };
    } else {
        console.warn("No se encontraron resultados para la dirección.");
        return null;
    }
}

//---------------------------------------------------------------------------------------------------------------------------

async function getAddress(lat, lon) {
    const res = await fetch(`/api/getAddress?lat=${lat}&lon=${lon}`);
    if (!res.ok) {
        throw new Error("Error en backend reverse");
    }
    
    const data = await res.json();
    document.getElementById("status").textContent = `Ubicación: ${data.display_name}`;

    initMap(lat, lon, data.display_name); //Llamado a initMap
    
}

//---------------------------------------------------------------------------------------------------------------------------

if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            console.log(`Latitud de Usuario: ${lat}, Longitud de Usuario ${lon}`);
            getAddress(lat, lon); //Llamado a getAddress
        },
        err => {
            document.getElementById("status").textContent = "Error: " + err.message;
        },
        {
            enableHighAccuracy: true, // Usa GPS si está disponible
            maximumAge: 0,            // No reutiliza posiciones en caché
            timeout: 5000             // Tiempo máximo de espera por actualización
        }
    );
} else {
    document.getElementById("status").textContent = "Geolocalización no soportada en este navegador.";
}

//---------------------------------------------------------------------------------------------------------------------------

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  console.log(d);
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

//---------------------------------------------------------------------------------------------------------------------------

function closePanel() {
  document.getElementById("infoPanel").style.display = "none";
}