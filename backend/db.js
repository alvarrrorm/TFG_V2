

const mysql = require('mysql2');

// Configuración de la conexión a MySQL
const conexion = mysql.createConnection({
  host: 'localhost',      
  user: 'root',        
  password: 'qwerty',
  database: 'gestion_polideportivo', 
  port: 3306,
  charset: 'utf8mb4',
});

// Intentar conectar
conexion.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err);
    return;
  }
  console.log('✅ Conectado a la base de datos MySQL');
});

// Ejemplo de consulta simple
conexion.query('SELECT NOW() AS fecha_actual', (err, results) => {
  if (err) {
    console.error('Error en la consulta:', err);
    return;
  }
  console.log('Fecha actual desde MySQL:', results[0].fecha_actual);
  // Cierra la conexión si quieres (opcional)
  conexion.end();
});
