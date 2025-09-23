import express from "express";
import db from './db.js'; // este es el Pool de pg
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import 'dotenv/config';

const app = express();

app.use(express.static("public"));
app.use(express.json());

// Middleware para obtener los datos de usuario desde JWT

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token requerido" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ahora tenemos req.user.id, req.user.correo, etc.
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: "Token inválido" });
  }
}

/* Endpoint para devolver info del usuario (frontend lo usa para mostrar UI) */
app.get("/api/me", authMiddleware, (req, res) => {
  console.log("llegó a /api/me");
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    correo: req.user.correo,
    rol: req.user.rol || "user"
  });
});


// Endpoint para búsqueda de ubicaciones en la base de datos
app.get("/api/locations", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM Ubicacion");
    
    const locations = results.rows.map((row) => ({
      id: row.id,
      name: row.nombre,
      address: row.direccion,
      establishment: row.tipoestablecimiento,
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

    const usuario = {
      id: result.rows[0].id,
      nombre,
      correo,
      rol
    };

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

    res.status(201).json({ message: "Usuario registrado con éxito", token, id: result.rows[0].id, rol });
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
        rol: usuario.rol || "user",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener lista de encargados para poblar el <select>
app.get("/api/encargados", authMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT id, nombre FROM Encargado ORDER BY nombre");
    res.json(result.rows); // [{ id, nombre }, ...]
  } catch (err) {
    console.error("Error fetching encargados:", err);
    res.status(500).json({ error: "Error al obtener encargados" });
  }
});

// Crear nueva ubicación
app.post("/api/addLocation", authMiddleware, async (req, res) => {
  const {
    nombre,
    direccion,
    tipoestablecimiento,
    numextintores,
    haybotiquin,
    hayrociadores,
    numemergenexits,
    ultimainspeccion, // ISO date string o null
    idencargado
  } = req.body;

  if (!nombre || !direccion || !tipoestablecimiento) {
    return res.status(400).json({ error: "Faltan campos obligatorios (nombre/direccion/tipoestablecimiento)" });
  }

  try {
    const q = `
      INSERT INTO ubicacion
        (nombre, direccion, tipoestablecimiento, numextintores, haybotiquin, hayrociadores, numemergenexits, ultimainspeccion, encargadoid)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `;
    const params = [
      nombre,
      direccion,
      tipoestablecimiento,
      numextintores || 0,
      !!haybotiquin,
      !!hayrociadores,
      numemergenexits || 0,
      ultimainspeccion || null,
      idencargado || null
    ];

    const result = await db.query(q, params);
    res.status(201).json({ message: "Ubicación creada", id: result.rows[0].id });
  } catch (err) {
    console.error("Error insert Ubicacion:", err);
    res.status(500).json({ error: "Error al crear la ubicación" });
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

// Obtener favoritos del usuario
app.get("/api/favorites", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.idubicacion, u.nombre, u.direccion
       FROM favoritos f
       JOIN ubicacion u ON f.idubicacion = u.id
       WHERE f.idusuario = $1
       ORDER BY f.fechaguardado DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener favoritos" });
  }
});

// Alternar favorito (agregar/quitar)
app.post("/api/favorites/toggle", authMiddleware, async (req, res) => {
  const { nombreUbicacion } = req.body; // viene del marcador actual
  if (!nombreUbicacion) return res.status(400).json({ error: "Falta nombreUbicacion" });

  try {
    // Obtener ID de la ubicación
    const ubicacion = await db.query("SELECT id FROM ubicacion WHERE nombre = $1", [nombreUbicacion]);
    if (ubicacion.rows.length === 0) return res.status(404).json({ error: "Ubicación no encontrada" });

    const idUbicacion = ubicacion.rows[0].id;

    // Revisar si ya es favorito
    const fav = await db.query(
      "SELECT 1 FROM favoritos WHERE idusuario = $1 AND idubicacion = $2",
      [req.user.id, idUbicacion]
    );

    if (fav.rows.length > 0) {
      // Si ya existe → eliminar
      await db.query(
        "DELETE FROM favoritos WHERE idusuario = $1 AND idubicacion = $2",
        [req.user.id, idUbicacion]
      );
      return res.json({ message: "Favorito eliminado" });
    } else {
      // Si no existe → agregar
      await db.query(
        "INSERT INTO favoritos (idusuario, idubicacion) VALUES ($1, $2)",
        [req.user.id, idUbicacion]
      );
      return res.json({ message: "Favorito agregado" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al alternar favorito" });
  }
});

// Middleware extra para admins
function adminMiddleware(req, res, next) {
  if (req.user.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado: solo admins" });
  }
  next();
}

// Endpoint para eliminar ubicación
app.delete("/api/locations/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query("DELETE FROM ubicaciones WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ubicación no encontrada" });
    }

    res.json({ message: "Ubicación eliminada correctamente", deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la ubicación" });
  }
});




export default app;