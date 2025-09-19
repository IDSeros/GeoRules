import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  //External Database URL
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // necesario en Render
  }
});

// Verificar conexión
pool.connect()
  .then(client => {
    console.log("✅ Conectado a PostgreSQL en Render");
    client.release();
  })
  .catch(err => {
    console.error("❌ Error de conexión:", err.stack);
  });

export default pool;
