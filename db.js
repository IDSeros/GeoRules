import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  //External Database URL
  connectionString: "postgresql://adrian:0txxPpDYYWdhidTVJBJ3sXOIEVntlChU@dpg-d32ajqgdl3ps73fut3r0-a.oregon-postgres.render.com/georules_postgres",
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
