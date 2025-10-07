const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

// Crear conexión MySQL
const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'qwerty',
  database: 'gestion_polideportivo'
});

// Conectar a la base de datos
conexion.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }
  console.log('Conectado a la base de datos MySQL');
});

// Crear instancia de Express
const app = express();

// Guardar la conexión en app para acceder desde rutas
app.set('conexion', conexion);

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081', 'https://tfgalvaroramirezmartin.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));



// Middlewares para parsear JSON y datos urlencoded, debe ir antes de las rutas
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
const loginRuta = require('./rutas/login');
const registroRuta = require('./rutas/registro');
const pistasRuta = require('./rutas/pistas');
const reservasRuta = require('./rutas/reservas');
const polideportivosRuta = require('./rutas/polideportivos');

app.use('/login', loginRuta);
app.use('/registro', registroRuta);
app.use('/pistas', pistasRuta);
app.use('/reservas', reservasRuta);
app.use('/polideportivos', polideportivosRuta);

// Ruta de prueba para verificar que el servidor está activo
app.get('/', (req, res) => {
  res.send('API del Polideportivo');
});

// Manejo explícito para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Cerrar conexión a la base de datos al terminar el proceso
process.on('SIGINT', () => {
  conexion.end();
  process.exit();
});
