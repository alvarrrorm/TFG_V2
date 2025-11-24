const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://localhost:8081', 
      'https://deppo.es', 
      'https://www.deppo.es',
      /\.railway\.app$/,
      /\.vercel\.app$/,
      'https://gestion-pink.vercel.app',
      'https://gestion-polideportivos-web.vercel.app'
    ];
    
    // Permitir requests sin origin (como mobile apps o postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 👇 MANEJAR PREFLIGHT REQUESTS EXPLÍCITAMENTE
app.options('*', cors(corsOptions));

// Middlewares para parsear JSON y datos urlencoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Guardar las funciones en app para usarlas en las rutas
app.set('enviarEmailConfirmacion', enviarEmailConfirmacion);
app.set('obtenerEmailUsuario', obtenerEmailUsuario);
app.set('validarEmail', validarEmail);
app.set('supabase', supabase);
app.set('jwt_secret', JWT_SECRET);
app.set('jwt', jwt);
app.set('bcrypt', bcrypt);

// ========== SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ==========
app.use(express.static(path.join(__dirname, 'dist')));

// ========== RUTA DE LOGIN SIMPLIFICADA (PARA PRUEBAS) ==========
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    console.log('🔐 Intento de login para usuario:', usuario);
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña son requeridos'
      });
    }

    // Buscar usuario en Supabase
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .single();

    if (error || !user) {
      console.log('❌ Usuario no encontrado:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña (asumiendo que está hasheada)
    // Si las contraseñas están en texto plano, compara directamente
    let passwordValid = false;
    
    if (user.password_hash) {
      // Si tienes contraseñas hasheadas
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else if (user.password) {
      // Si tienes contraseñas en texto plano (no recomendado)
      passwordValid = user.password === password;
    } else {
      console.log('❌ No se encontró campo de contraseña para el usuario');
      return res.status(401).json({
        success: false,
        error: 'Error en la configuración de contraseñas'
      });
    }

    if (!passwordValid) {
      console.log('❌ Contraseña incorrecta para usuario:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.correo
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso para usuario:', usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.correo
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// ========== RUTAS BÁSICAS DEL API ==========
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API del Polideportivo funcionando',
    database: 'Supabase PostgreSQL',
    emailService: 'EmailJS',
    environment: process.env.NODE_ENV || 'development',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    database: 'Supabase',
    environment: process.env.NODE_ENV || 'development'
  });
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
    config: config
  });
});

// 👇 RUTA MEJORADA PARA PROBAR EMAIL CON USUARIO REAL
app.get('/api/test-email-real', async (req, res) => {
  try {
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
        pistas: '✅ Accesible'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase: ' + error.message
    });
  }
});

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

// Ruta protegida de ejemplo
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Acceso a ruta protegida exitoso',
    user: req.user
  });
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
  
  // Manejar errores de CORS
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ 
      error: 'Origen no permitido por CORS',
      origin: req.headers.origin 
    });
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : err.message
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
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Test Supabase: http://localhost:${PORT}/api/test-supabase`);
  console.log(`📧 Test Email: http://localhost:${PORT}/api/test-email-real`);
  console.log('');
  
  // Verificar conexión a Supabase
  await verificarConexionSupabase();
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});