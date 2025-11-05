const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const emailjs = require('@emailjs/nodejs');

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

// ========== CONFIGURACIÓN EMAILJS ==========
const emailjsConfig = {
  publicKey: 'cm8peTJ9deE4bwUrS',
  privateKey: 'Td3FXR8CwPdKsuyIuwPF_',
};

const emailjsServiceId = 'service_lb9lbhi';
const emailjsTemplateId = 'template_hfuxqzm';

console.log('📧 Configurando EmailJS...');

// 👇 FUNCIÓN MEJORADA PARA VALIDAR EMAIL
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 👇 FUNCIÓN MEJORADA PARA OBTENER EMAIL DEL USUARIO
function obtenerEmailUsuario(usuarioId, db) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, correo, nombre FROM usuarios WHERE id = ?';
    db.query(sql, [usuarioId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length === 0) {
        resolve(null);
      } else {
        const usuario = results[0];
        console.log('🔍 Usuario encontrado:', {
          id: usuario.id,
          nombre: usuario.nombre,
          correo: usuario.correo,
          emailValido: validarEmail(usuario.correo)
        });
        resolve(usuario);
      }
    });
  });
}

// 👇 FUNCIÓN MEJORADA PARA ENVIAR EMAIL CON VALIDACIÓN
function enviarEmailConfirmacion(reserva) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validar que tenemos un email válido
      if (!reserva.email || !validarEmail(reserva.email)) {
        throw new Error(`Email inválido o vacío: "${reserva.email}"`);
      }

      const fechaFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Datos para la plantilla de email
      const templateParams = {
        to_email: reserva.email,
        to_name: reserva.nombre_usuario,
        reserva_id: reserva.id,
        polideportivo_nombre: reserva.polideportivo_nombre,
        pista_nombre: reserva.pista_nombre,
        fecha: fechaFormateada,
        horario: `${reserva.hora_inicio} - ${reserva.hora_fin}`,
        precio: `${reserva.precio} €`,
        from_name: 'Polideportivo App'
      };

      console.log('📤 Enviando email a:', reserva.email);
      console.log('✅ Email validado correctamente');
      
      // Enviar email con EmailJS
      const result = await emailjs.send(
        emailjsServiceId,
        emailjsTemplateId,
        templateParams,
        emailjsConfig
      );

      console.log('✅ Email enviado con EmailJS');
      resolve(result);

    } catch (error) {
      console.error('❌ Error enviando email con EmailJS:', error);
      reject(error);
    }
  });
}

// Guardar las funciones en app para usarlas en las rutas
app.set('enviarEmailConfirmacion', enviarEmailConfirmacion);
app.set('obtenerEmailUsuario', obtenerEmailUsuario);
app.set('validarEmail', validarEmail);
app.set('conexion', conexion);

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Middlewares para parsear JSON y datos urlencoded
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
  res.json({ 
    message: 'API del Polideportivo funcionando',
    emailService: 'EmailJS',
    status: 'online'
  });
});

// 👇 RUTA MEJORADA PARA PROBAR EMAIL CON USUARIO REAL
app.get('/test-email-real', async (req, res) => {
  try {
    const db = req.app.get('conexion');
    const obtenerEmailUsuario = req.app.get('obtenerEmailUsuario');
    const validarEmail = req.app.get('validarEmail');
    
    // Obtener un usuario real de la base de datos
    const usuariosSQL = 'SELECT id, nombre, correo FROM usuarios WHERE correo IS NOT NULL AND correo != "" LIMIT 1';
    
    db.query(usuariosSQL, async (err, usuarios) => {
      if (err) {
        console.error('❌ Error obteniendo usuarios:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al obtener usuarios' 
        });
      }

      if (usuarios.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'No hay usuarios con email válido en la base de datos' 
        });
      }

      const usuario = usuarios[0];
      
      // Validar el email
      if (!validarEmail(usuario.correo)) {
        return res.status(400).json({ 
          success: false, 
          error: `El email del usuario tiene formato inválido: "${usuario.correo}"` 
        });
      }

      const testReserva = {
        id: Math.floor(Math.random() * 1000),
        email: usuario.correo,
        nombre_usuario: usuario.nombre,
        polideportivo_nombre: 'Polideportivo Central',
        pista_nombre: 'Pista de Fútbol 1',
        fecha: new Date('2024-12-15'),
        hora_inicio: '10:00',
        hora_fin: '11:00',
        precio: '25.00'
      };

      console.log('📧 Probando EmailJS con usuario real...');
      console.log('   Destino:', testReserva.email);
      console.log('   Usuario:', testReserva.nombre_usuario);
      console.log('   Email válido:', validarEmail(testReserva.email));
      
      const result = await enviarEmailConfirmacion(testReserva);
      
      res.json({ 
        success: true, 
        message: '✅ Email enviado correctamente con EmailJS',
        to: testReserva.email,
        usuario: testReserva.nombre_usuario,
        reserva_id: testReserva.id
      });
    });
    
  } catch (error) {
    console.error('❌ Error en test-email-real:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Error enviando email de prueba'
    });
  }
});

// Ruta simple para probar el email (mantener compatibilidad)
app.get('/test-email', async (req, res) => {
  try {
    const testReserva = {
      id: Math.floor(Math.random() * 1000),
      email: 'alvaroramirezm8@gmail.com',
      nombre_usuario: 'Alvaro Ramirez',
      polideportivo_nombre: 'Polideportivo Central',
      pista_nombre: 'Pista de Fútbol 1',
      fecha: new Date('2024-12-15'),
      hora_inicio: '10:00',
      hora_fin: '11:00',
      precio: '25.00'
    };

    console.log('📧 Probando EmailJS...');
    console.log('   Destino:', testReserva.email);
    
    const result = await enviarEmailConfirmacion(testReserva);
    
    res.json({ 
      success: true, 
      message: '✅ Email enviado correctamente con EmailJS',
      to: testReserva.email,
      reserva_id: testReserva.id
    });
    
  } catch (error) {
    console.error('❌ Error en test-email:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Error enviando email de prueba'
    });
  }
});

// Ruta para verificar configuración de EmailJS
app.get('/emailjs-status', (req, res) => {
  const config = {
    publicKey: emailjsConfig.publicKey ? '✅ Configurada' : '❌ Faltante',
    privateKey: emailjsConfig.privateKey ? '✅ Configurada' : '❌ Faltante',
    serviceId: emailjsServiceId ? '✅ Configurado' : '❌ Faltante',
    templateId: emailjsTemplateId ? '✅ Configurado' : '❌ Faltante'
  };

  const todosConfigurados = emailjsConfig.publicKey && emailjsConfig.privateKey && 
                           emailjsServiceId && emailjsTemplateId;

  res.json({
    service: 'EmailJS',
    status: todosConfigurados ? '✅ Listo' : '❌ Configuración incompleta',
    config: config,
    nextSteps: todosConfigurados ? 
      'Puedes probar el email en /test-email' : 
      'Completa la configuración en server.js'
  });
});

// 👇 NUEVAS RUTAS DE DEBUG MEJORADAS
app.get('/debug/usuarios', (req, res) => {
  const db = req.app.get('conexion');
  const validarEmail = req.app.get('validarEmail');
  const sql = 'SELECT id, nombre, usuario, correo FROM usuarios LIMIT 20';
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
    
    const usuariosConValidacion = results.map(usuario => ({
      ...usuario,
      email_valido: validarEmail(usuario.correo),
      tiene_email: !!usuario.correo && usuario.correo.trim() !== ''
    }));
    
    res.json({
      total: results.length,
      usuarios: usuariosConValidacion
    });
  });
});

app.get('/debug/reservas', (req, res) => {
  const db = req.app.get('conexion');
  const validarEmail = req.app.get('validarEmail');
  const sql = `
    SELECT r.id, r.usuario_id, r.nombre_usuario, u.correo, r.estado, r.fecha
    FROM reservas r 
    LEFT JOIN usuarios u ON r.usuario_id = u.id 
    ORDER BY r.id DESC 
    LIMIT 10
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error obteniendo reservas' });
    }
    
    const reservasConValidacion = results.map(r => ({
      ...r,
      tiene_email: !!r.correo && r.correo.trim() !== '',
      email_valido: validarEmail(r.correo),
      usuario_valido: r.usuario_id > 0
    }));
    
    res.json({
      total: results.length,
      reservas: reservasConValidacion
    });
  });
});

// 👇 NUEVA RUTA PARA ARREGLAR EMAILS INVÁLIDOS
app.get('/debug/fix-emails', (req, res) => {
  const db = req.app.get('conexion');
  
  // Mostrar usuarios con emails problemáticos
  const sql = `
    SELECT id, nombre, correo 
    FROM usuarios 
    WHERE correo IS NULL OR correo = '' OR correo NOT LIKE '%@%.%'
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
    
    res.json({
      usuarios_con_email_invalido: results.length,
      usuarios: results,
      solucion: 'Actualiza los emails en la base de datos usando: UPDATE usuarios SET correo = "email@valido.com" WHERE id = X'
    });
  });
});

// Manejo explícito para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📧 Test Email: http://localhost:${PORT}/test-email`);
  console.log(`📧 Test Email Real: http://localhost:${PORT}/test-email-real`);
  console.log(`👤 Debug Usuarios: http://localhost:${PORT}/debug/usuarios`);
  console.log(`📋 Debug Reservas: http://localhost:${PORT}/debug/reservas`);
  console.log(`🔧 Fix Emails: http://localhost:${PORT}/debug/fix-emails`);
  console.log(`⚙️  Status: http://localhost:${PORT}/emailjs-status`);
  console.log('');
  
  // Verificar configuración
  const configCheck = {
    publicKey: !!emailjsConfig.publicKey && emailjsConfig.publicKey !== 'tu-public-key-real',
    privateKey: !!emailjsConfig.privateKey && emailjsConfig.privateKey !== 'tu-private-key-real',
    serviceId: !!emailjsServiceId && emailjsServiceId !== 'tu-service-id-real',
    templateId: !!emailjsTemplateId && emailjsTemplateId !== 'tu-template-id-real'
  };

  if (configCheck.publicKey && configCheck.privateKey && configCheck.serviceId && configCheck.templateId) {
    console.log('✅ EmailJS configurado correctamente');
  } else {
    console.log('❌ CONFIGURACIÓN EMAILJS INCOMPLETA:');
    console.log('   Ve a: https://dashboard.emailjs.com/admin');
    console.log('   Obtén tus claves y actualiza:');
    console.log('   - publicKey');
    console.log('   - privateKey'); 
    console.log('   - serviceId');
    console.log('   - templateId');
  }
});

// Cerrar conexión a la base de datos al terminar el proceso
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  conexion.end();
  process.exit();
});