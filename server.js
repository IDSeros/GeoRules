import app from "./app.js";
import db from "./db.js";
import 'dotenv/config';

const PORT = process.env.PORT;

// Verificar conexión
db.connect()
  .then(client => {
    console.log("✅ Conectado a PostgreSQL en Render");
    client.release();
  })
  .catch(err => {
    console.error("❌ Error de conexión:", err.stack);
  });

app.listen(PORT, () => {
  console.log(`Servidor backend en http://localhost:${PORT}`);
});
