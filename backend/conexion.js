const mysql = require('mysql2');

// Crear conexión normal
const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'qwerty', //
  database: 'gestion_polideportivo',
  port: 3306,
  charset: 'utf8mb4',
});

// Conectar a la base de datos
conexion.connect((err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Conectado correctamente a la base de datos');
  }
});


module.exports = {
  conexion,
  promiseConexion: conexion.promise()
};
