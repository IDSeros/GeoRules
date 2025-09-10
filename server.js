import express from "express";

const app = express();
const PORT = 3000;
const db = require('./db');

app.use(express.static("public"));

// Endpoint para búsqueda de ubiaciones en la base de datos
app.get("/api/locations", async (req, res) => {
  db.query("SELECT * FROM Ubicacion", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error en la base de datos');
    }

    const locations = results.map((row) => ({
      name: row.nombre,
      address: row.direccion,
      establishment: row.tipoEstablecimiento,
      numExtinguisher: row.numExtintores,
      firstAid: !!row.hayBotiquin,
      sprinklers: !!row.hayRociadores,
      emergncyExits: row.numEmergenExits,
      lastInspection: row.ultimaInspeccion // formato ISO, sin modificar
    }));

    res.json(locations);
  });
});



// Endpoint para búsqueda directa
app.get("/api/getLatLon", async (req, res) => {
  const { q } = req.query;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "GeoRules/1.0 (15adriangc@gmail.com)"
        }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Endpoint para reverse geocoding
app.get("/api/getAddress", async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
      {
        headers: {
          "User-Agent": "GeoRules/1.0 (15adriangc@gmail.com)"
        }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend en http://localhost:${PORT}`);
});