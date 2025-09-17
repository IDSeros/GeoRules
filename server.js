import express from "express";
import db from './db.js'; // este es el Pool de pg
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.json());

// Endpoint para búsqueda de ubicaciones en la base de datos
app.get("/api/locations", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM Ubicacion");
    
    const locations = results.rows.map((row) => ({
      name: row.nombre,
      address: row.direccion,
      establishment: row.tipoestablecimiento, // cuidado con minúsculas
      numExtinguisher: row.numextintores,
      firstAid: row.haybotiquin,
      sprinklers: row.hayrociadores,
      emergncyExits: row.numemergenexits,
      lastInspection: row.ultimainspeccion
    }));

    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Endpoint para registrar usuarios
app.post("/api/signup", async (req, res) => {
  const { nombre, correo, contrasena, adminCode } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    // Verifica si ya existe el correo
    const exists = await db.query('SELECT 1 FROM Usuario WHERE correo = $1', [correo]);
    if (exists.rows.length) return res.status(409).json({ error: "Correo ya registrado" });

    const hash = await bcrypt.hash(contrasena, 10);

    // Decide rol: si envían adminCode y coincide con el .env => admin, sino user
    let rol = 'user';
    if (adminCode && adminCode === process.env.ADMIN_CODE) {
      rol = 'admin';
    }

    const result = await db.query(
      'INSERT INTO Usuario (correo, nombre, contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      [correo, nombre, hash, rol]
    );

    res.status(201).json({ message: "Usuario registrado con éxito", id: result.rows[0].id, rol });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});


// Endpoint para validar usuarios
app.post("/api/login", async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const result = await db.query(
      "SELECT * FROM Usuario WHERE correo = $1",
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const usuario = result.rows[0];

    const match = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!match) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const SECRET = process.env.JWT_SECRET;

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol || "user",
      },
      SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Login exitoso",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

export default app;




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