import express from "express";
import db from './db.js';
import bcrypt from 'bcrypt';

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.json());

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


//Endpoint para registrar usuarios
app.post("/api/signup", async (req, res) => {
  const { nombre, correo, contrasena } = req.body;
  console.log(req.body);

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    // Encriptar contraseña
    const hash = await bcrypt.hash(contrasena, 10);

    // Guardar en la base de datos
    db.query(
      'INSERT INTO Usuario (correo, nombre, contrasena) VALUES (?, ?, ?)',
      [correo, nombre, hash],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Error al registrar usuario" });
        }
        res.status(201).json({ message: "Usuario registrado con éxito", id: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
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