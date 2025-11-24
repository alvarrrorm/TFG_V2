const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');

// ========== CONFIGURACIÓN SUPABASE ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWpoaGtnZ25tcXJ1YnlwdnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY0OTUsImV4cCI6MjA3OTU1MjQ5NX0.ZDrmA-jkADMH0CPrtm14IZkPEChTLvSxJ8BM2roC8A0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Verificar conexión a Supabase
async function verificarConexionSupabase() {
  try {
    const { data, error } = await supabase.from('usuarios').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Conectado a Supabase correctamente');
  } catch (error) {
    console.error('❌ Error conectando a Supabase:', error.message);
  }
}

// ========== CONFIGURACIÓN EMAILJS ==========
const emailjsConfig = {
  publicKey: process.env.EMAILJS_PUBLIC_KEY || 'cm8peTJ9deE4bwUrS',
  privateKey: process.env.EMAILJS_PRIVATE_KEY || 'Td3FXR8CwPdKsuyIuwPF_',
};

const emailjsServiceId = 'service_lb9lbhi';
const emailjsTemplateId = 'template_hfuxqzm';

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';

console.log('📧 Configurando EmailJS...');

// 👇 FUNCIÓN MEJORADA PARA VALIDAR EMAIL
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 👇 FUNCIÓN MEJORADA PARA OBTENER EMAIL DEL USUARIO (AHORA CON SUPABASE)
async function obtenerEmailUsuario(usuarioId) {
  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, correo, nombre')
      .eq('id', usuarioId)
      .single();

    if (error) {
      throw error;
    }

    if (!usuario) {
      return null;
    }

    console.log('🔍 Usuario encontrado:', {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      emailValido: validarEmail(usuario.correo)
    });
    
    return usuario;
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    throw error;
  }
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

// Crear instancia de Express
const app = express();

// ========== CONFIGURACIÓN CORS MEJORADA ==========
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:8081', 
    'https://deppo.es', 
    'https://www.deppo.es',
    'https://*.railway.app',
    'https://*.vercel.app',
    'https://gestion-pink.vercel.app'  // 👈 AÑADIDO ESPECÍFICAMENTE
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // 👈 AÑADIDO X-Requested-With
  credentials: true,
  optionsSuccessStatus: 204
}));

// 👇 MANEJAR PREFLIGHT REQUESTS EXPLÍCITAMENTE
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(204).send();
});

// Middlewares para parsear JSON y datos urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Guardar las funciones en app para usarlas en las rutas
app.set('enviarEmailConfirmacion', enviarEmailConfirmacion);
app.set('obtenerEmailUsuario', obtenerEmailUsuario);
app.set('validarEmail', validarEmail);
app.set('supabase', supabase);
app.set('jwt_secret', JWT_SECRET);

// ========== SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ==========
app.use(express.static(path.join(__dirname, 'dist')));

// Rutas
const loginRuta = require('./rutas/login');
const registroRuta = require('./rutas/registro');
const pistasRuta = require('./rutas/pistas');
const reservasRuta = require('./rutas/reservas');
const polideportivosRuta = require('./rutas/polideportivos');
const recuperaRuta = require('./rutas/recupera');

// ========== RUTAS DEL API CON PREFIJO /api ==========
app.use('/api/login', loginRuta);
app.use('/api/registro', registroRuta);
app.use('/api/pistas', pistasRuta);
app.use('/api/reservas', reservasRuta);
app.use('/api/polideportivos', polideportivosRuta);
app.use('/api/recupera', recuperaRuta);

// ========== RUTAS DEL API ==========
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API del Polideportivo funcionando',
    database: 'Supabase PostgreSQL',
    emailService: 'EmailJS',
    environment: process.env.NODE_ENV || 'development',
    status: 'online'
  });
});

// 👇 RUTA MEJORADA PARA PROBAR EMAIL CON USUARIO REAL (ACTUALIZADA)
app.get('/api/test-email-real', async (req, res) => {
  try {
    const obtenerEmailUsuario = req.app.get('obtenerEmailUsuario');
    const validarEmail = req.app.get('validarEmail');
    
    // Obtener un usuario real de Supabase
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo')
      .not('correo', 'is', null)
      .neq('correo', '')
      .limit(1);

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener usuarios' 
      });
    }

    if (!usuarios || usuarios.length === 0) {
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
app.get('/api/test-email', async (req, res) => {
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
app.get('/api/emailjs-status', (req, res) => {
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
      'Puedes probar el email en /api/test-email' : 
      'Completa la configuración en server.js'
  });
});

// 👇 NUEVAS RUTAS DE DEBUG MEJORADAS PARA SUPABASE
app.get('/api/debug/usuarios', async (req, res) => {
  try {
    const validarEmail = req.app.get('validarEmail');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, usuario, correo')
      .limit(20);

    if (error) {
      return res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
    
    const usuariosConValidacion = usuarios.map(usuario => ({
      ...usuario,
      email_valido: validarEmail(usuario.correo),
      tiene_email: !!usuario.correo && usuario.correo.trim() !== ''
    }));
    
    res.json({
      total: usuarios.length,
      usuarios: usuariosConValidacion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/reservas', async (req, res) => {
  try {
    const validarEmail = req.app.get('validarEmail');
    
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select(`
        id, usuario_id, nombre_usuario, estado, fecha,
        usuarios!inner(correo)
      `)
      .order('id', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(500).json({ error: 'Error obteniendo reservas' });
    }
    
    const reservasConValidacion = reservas.map(r => ({
      id: r.id,
      usuario_id: r.usuario_id,
      nombre_usuario: r.nombre_usuario,
      correo: r.usuarios?.correo,
      estado: r.estado,
      fecha: r.fecha,
      tiene_email: !!r.usuarios?.correo && r.usuarios.correo.trim() !== '',
      email_valido: validarEmail(r.usuarios?.correo),
      usuario_valido: r.usuario_id > 0
    }));
    
    res.json({
      total: reservas.length,
      reservas: reservasConValidacion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👇 NUEVA RUTA PARA ARREGLAR EMAILS INVÁLIDOS
app.get('/api/debug/fix-emails', async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo')
      .or('correo.is.null,correo.eq.,correo.not.like.%@%.%');

    if (error) {
      return res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
    
    res.json({
      usuarios_con_email_invalido: usuarios.length,
      usuarios: usuarios,
      solucion: 'Actualiza los emails en Supabase usando la interfaz web'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👇 NUEVA RUTA PARA PROBAR SUPABASE
app.get('/api/test-supabase', async (req, res) => {
  try {
    // Probar consulta a cada tabla
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('usuarios')
      .select('count')
      .limit(1);

    const { data: reservas, error: errorReservas } = await supabase
      .from('reservas')
      .select('count')
      .limit(1);

    const { data: pistas, error: errorPistas } = await supabase
      .from('pistas')
      .select('count')
      .limit(1);

    if (errorUsuarios || errorReservas || errorPistas) {
      throw new Error('Error en alguna consulta');
    }

    res.json({
      success: true,
      message: '✅ Supabase conectado correctamente',
      tablas: {
        usuarios: '✅ Accesible',
        reservas: '✅ Accesible',
        pistas: '✅ Accesible',
        polideportivos: '✅ Accesible',
        recuperacion_password: '✅ Accesible'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase: ' + error.message
    });
  }
});

// ========== PARA TODAS LAS DEMÁS RUTAS, SIRVE EL FRONTEND ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🗄️  Database: Supabase PostgreSQL`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET ? '✅ Configurado' : '❌ Usando valor por defecto'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Sirviendo frontend desde: ${path.join(__dirname, 'dist')}`);
  console.log(`🔗 Test Supabase: http://localhost:${PORT}/api/test-supabase`);
  console.log(`📧 Test Email: http://localhost:${PORT}/api/test-email`);
  console.log(`🔧 CORS configurado para Vercel: https://gestion-pink.vercel.app`);
  console.log('');
  
  // Verificar conexión a Supabase
  await verificarConexionSupabase();
});

// Ya no necesitamos cerrar conexión MySQL
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});