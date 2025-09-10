import mysql from 'mysql2';

//Datos de Conexión
const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Kinh-13579$',
  database: 'GEORULES'
});

//Conexión a Base de Datos
connection.connect((err) => {
  if (err) {
    console.error('Error de conexión: ' + err.stack);
    return;
  }
  console.log('Conectado como id ' + connection.threadId);
});

export default connection;