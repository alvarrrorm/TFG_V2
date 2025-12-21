const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const emailjs = require('@emailjs/nodejs');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mi_clave_refresh_segura_2024';

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

// ========== CORS DEFINITIVO PARA RAILWAY ==========
// PRIMERO: Configuración CORS SIMPLE y directa
const allowedOrigins = [
  'https://www.deppo.es',
  'https://deppo.es',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080'
];

// Middleware CORS manual (SIN la librería cors para problemas de Railway)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Permitir origen si está en la lista
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV !== 'production') {
    // En desarrollo, permitir cualquier origen
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  // Headers CORS esenciales
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  
  // CRÍTICO: Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight OPTIONS manejado para Railway');
    return res.status(200).end();
  }
  
  next();
});

// SEGUNDO: También usar la librería cors como backup
app.use(cors({
  origin: function (origin, callback) {
    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, solo orígenes permitidos
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚨 Origen bloqueado por CORS:', origin);
      callback(new Error('Origen no permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization']
}));

app.use(express.json());

// Almacenamiento de refresh tokens (en producción usa Redis)
const refreshTokens = new Map();

// ========== SISTEMA DE ROLES JERÁRQUICOS ==========
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_POLIDEPORTIVO: 'admin_poli',
  ADMIN: 'admin',
  USUARIO: 'usuario'
};

const NIVELES_PERMISO = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN_POLIDEPORTIVO]: 50,
  [ROLES.ADMIN]: 40,
  [ROLES.USUARIO]: 10
};

// ========== CONFIGURACIÓN EMAILJS v5 ==========
const emailjsPublicKey = 'cm8peTJ9deE4bwUrS';
const emailjsPrivateKey = 'Td3FXR8CwPdKsuyIuwPF_';

// Servicios y templates de EmailJS
const emailjsConfig = {
  recovery: {
    serviceId: 'service_r7doupc',
    templateId: 'template_sy1terr'
  },
  reserva: {
    serviceId: 'service_lb9lbhi',
    templateId: 'template_hfuxqzm'
  }
};

// ========== IMPORTAR ROUTERS ==========
const reservasRouter = require('./rutas/reservas');
const pistasRouter = require('./rutas/pistas');
const polideportivosRouter = require('./rutas/polideportivos');
const { router: usuariosRouter, verificarRol, filtrarPorPolideportivo, ROLES: USUARIOS_ROLES, NIVELES_PERMISO: USUARIOS_NIVELES } = require('./rutas/usuarios');

// Sincronizar los roles importados con los locales
Object.assign(ROLES, USUARIOS_ROLES || {});
Object.assign(NIVELES_PERMISO, USUARIOS_NIVELES || {});

// ========== FUNCIÓN PARA MANEJAR COOKIES SIN COOKIE-PARSER ==========
const parseCookies = (req) => {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift().trim();
      const value = parts.join('=');
      if (key && value !== undefined) {
        cookies[key] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
};

// Función para establecer cookies
const setCookie = (res, name, value, options = {}) => {
  let cookie = `${name}=${encodeURIComponent(value)};`;
  
  if (options.httpOnly) cookie += ' HttpOnly;';
  if (options.secure) cookie += ' Secure;';
  if (options.sameSite) cookie += ` SameSite=${options.sameSite};`;
  if (options.maxAge) cookie += ` Max-Age=${options.maxAge};`;
  if (options.path) cookie += ` Path=${options.path || '/'};`;
  
  res.setHeader('Set-Cookie', cookie);
};

// Función para limpiar cookies
const clearCookie = (res, name) => {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/`);
};

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
const authenticateToken = (req, res, next) => {
  console.log('🔐 Middleware authenticateToken ejecutándose');
  
  // 1. Intentar obtener token de Authorization header
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  
  // 2. Intentar obtener token de cookie usando nuestra función
  const cookies = parseCookies(req);
  const tokenFromCookie = cookies.auth_token;
  
  // 3. Intentar obtener token de query string (solo para desarrollo)
  const tokenFromQuery = req.query?.token;

  // Prioridad: Header > Cookie > Query
  const token = tokenFromHeader || tokenFromCookie || tokenFromQuery;

  console.log('📌 Token obtenido:', token ? 'Sí (longitud: ' + token.length + ')' : 'No');

  if (!token) {
    console.log('❌ Token de autenticación requerido');
    return res.status(401).json({ 
      success: false, 
      error: 'Token de autenticación requerido' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token inválido o expirado:', err.message);
      return res.status(403).json({ 
        success: false, 
        error: 'Token inválido o expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.log('✅ Token verificado correctamente. Usuario:', {
      id: user.id,
      usuario: user.usuario,
      rol: user.rol
    });
    
    req.user = user;
    next();
  });
};

// ========== MIDDLEWARE PARA VERIFICAR ROLES ==========
const verificarEsAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }
  
  const { rol } = req.user;
  
  if (rol !== ROLES.SUPER_ADMIN && rol !== ROLES.ADMIN_POLIDEPORTIVO && rol !== ROLES.ADMIN) {
    return res.status(403).json({ 
      success: false, 
      error: 'Acceso denegado. Se requiere rol de administrador' 
    });
  }
  
  next();
};

const verificarEsSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }
  
  const { rol } = req.user;
  
  if (rol !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ 
      success: false, 
      error: 'Acceso denegado. Se requiere rol de super administrador' 
    });
  }
  
  next();
};

const verificarEsAdminPoli = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }
  
  const { rol, polideportivo_id } = req.user;
  
  if (rol !== ROLES.ADMIN_POLIDEPORTIVO) {
    return res.status(403).json({ 
      success: false, 
      error: 'Acceso denegado. Se requiere rol de administrador de polideportivo' 
    });
  }
  
  if (!polideportivo_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'Acceso denegado. No tienes un polideportivo asignado' 
    });
  }
  
  next();
};

// ========== FUNCIONES AUXILIARES ==========
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validarDNI(dni) {
  if (!dni) return false;
  const dniLimpio = dni.toString().trim().toUpperCase();
  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const dniRegex = /^(\d{8})([A-Z])$/;
  
  const match = dniLimpio.match(dniRegex);
  if (!match) return false;
  
  const numero = parseInt(match[1], 10);
  const letra = match[2].toUpperCase();
  const letraCalculada = letras[numero % 23];
  
  return letra === letraCalculada;
}

function limpiarTelefono(telefono) {
  if (!telefono) return '';
  return telefono.toString().replace(/\D/g, '');
}

function validarTelefono(telefono) {
  const telefonoLimpio = limpiarTelefono(telefono);
  return /^\d{9,15}$/.test(telefonoLimpio);
}

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========== FUNCIONES DE EMAIL ==========
async function enviarEmailRecuperacion(datos) {
  try {
    const templateParams = {
      user_name: datos.nombre_usuario || 'Usuario',
      user_username: datos.usuario || 'Usuario',
      verification_code: datos.codigo,
      app_name: 'Deppo',
      expiration_time: '15 minutos',
      support_email: 'soporte@deppo.com',
      current_year: new Date().getFullYear(),
      to_email: datos.email
    };

    console.log('📧 Enviando email de recuperación a:', datos.email);
    
    const result = await emailjs.send(
      emailjsConfig.recovery.serviceId,
      emailjsConfig.recovery.templateId,
      templateParams,
      {
        publicKey: emailjsPublicKey,
        privateKey: emailjsPrivateKey
      }
    );

    console.log('✅ Email enviado correctamente con EmailJS v5');
    return result;

  } catch (error) {
    console.error('❌ Error enviando email con EmailJS v5:', error);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🧪 Modo desarrollo: Simulando envío exitoso');
      console.log('🔐 Código que se enviaría:', datos.codigo);
      return { status: 200, text: 'OK', simulated: true };
    }
    
    throw error;
  }
}

async function enviarEmailConfirmacionReserva(datosReserva) {
  try {
    console.log('📧 Preparando email de confirmación de reserva...');

    const fechaReserva = new Date(datosReserva.fecha);
    const fechaFormateada = fechaReserva.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const templateParams = {
      user_name: datosReserva.nombre_usuario || 'Cliente',
      user_email: datosReserva.email,
      reservation_id: datosReserva.id || 'N/A',
      polideportivo_name: datosReserva.polideportivo_nombre || 'Polideportivo',
      pista_name: datosReserva.pista_nombre || datosReserva.pistas?.nombre || 'Pista',
      reservation_date: fechaFormateada,
      reservation_time: `${datosReserva.hora_inicio} - ${datosReserva.hora_fin}`,
      reservation_price: `${datosReserva.precio} €`,
      reservation_status: 'Confirmada',
      payment_method: 'Tarjeta de crédito',
      confirmation_date: new Date().toLocaleDateString('es-ES'),
      app_name: 'Depo',
      support_email: 'soporte@depo.com',
      current_year: new Date().getFullYear(),
      to_email: datosReserva.email
    };

    console.log('📨 Enviando email de confirmación...');

    const result = await emailjs.send(
      emailjsConfig.reserva.serviceId,
      emailjsConfig.reserva.templateId,
      templateParams,
      {
        publicKey: emailjsPublicKey,
        privateKey: emailjsPrivateKey
      }
    );

    console.log('✅ Email de confirmación enviado correctamente a:', datosReserva.email);
    return result;

  } catch (error) {
    console.error('❌ Error enviando email de confirmación:', error);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🧪 Modo desarrollo: Simulando envío exitoso de confirmación');
      return { status: 200, text: 'OK', simulated: true };
    }
    
    throw error;
  }
}

async function obtenerEmailUsuario(userId) {
  try {
    console.log('👤 Buscando email para usuario ID:', userId);
    
    if (!userId || userId === 0) {
      console.log('⚠️  Usuario ID no válido o es 0');
      return null;
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, correo, nombre, usuario')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Error obteniendo usuario:', error);
      return null;
    }
    
    if (!usuario) {
      console.log('⚠️  Usuario no encontrado ID:', userId);
      return null;
    }
    
    console.log('✅ Usuario encontrado:', {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.correo
    });
    
    return usuario;
  } catch (error) {
    console.error('❌ Error en obtenerEmailUsuario:', error);
    return null;
  }
}

// ========== INYECTAR FUNCIONES EN LA APP ==========
app.set('supabase', supabase);
app.set('enviarEmailConfirmacion', enviarEmailConfirmacionReserva);
app.set('obtenerEmailUsuario', obtenerEmailUsuario);
app.set('ROLES', ROLES);
app.set('NIVELES_PERMISO', NIVELES_PERMISO);
app.set('verificarEsAdmin', verificarEsAdmin);
app.set('verificarEsSuperAdmin', verificarEsSuperAdmin);
app.set('verificarEsAdminPoli', verificarEsAdminPoli);

// ========== REGISTRAR ROUTERS PRINCIPALES PRIMERO ==========
app.use('/api/reservas', reservasRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);
app.use('/api/usuarios', usuariosRouter);

// ========== RUTAS DE AUTENTICACIÓN SEGURA ==========

// Health check de autenticación
app.get('/api/auth/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sistema de autenticación funcionando',
    timestamp: new Date().toISOString(),
    secure: true,
    cookiesEnabled: true,
    jwt: '✅ Configurado',
    refreshTokens: '✅ Configurado'
  });
});

// Login seguro con cookies HTTP-only
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    console.log('🔐 Login seguro para:', usuario);
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña requeridos'
      });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    const passwordValid = await bcrypt.compare(password, user.pass);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Preparar datos del usuario (sin contraseña)
    const userData = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      email: user.correo,
      dni: user.dni,
      rol: user.rol || ROLES.USUARIO,
      telefono: user.telefono,
      polideportivo_id: user.polideportivo_id || null
    };

    console.log('👤 Datos del usuario para token:', {
      id: userData.id,
      usuario: userData.usuario,
      rol: userData.rol,
      polideportivo_id: userData.polideportivo_id
    });

    // Generar token de acceso (expira en 24 horas)
    const accessToken = jwt.sign(
      { 
        ...userData,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Generar token de refresco (expira en 7 días)
    const refreshToken = jwt.sign(
      { 
        id: user.id,
        type: 'refresh'
      },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Guardar refresh token
    refreshTokens.set(user.id.toString(), refreshToken);

    // Configurar cookies HTTP-only seguras usando nuestra función
    setCookie(res, 'auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    setCookie(res, 'refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log('✅ Login seguro exitoso para:', usuario);

    // También devolver el token en la respuesta para el frontend
    res.json({
      success: true,
      message: 'Login exitoso',
      token: accessToken,
      user: userData,
      expiresIn: 24 * 60 * 60
    });

  } catch (error) {
    console.error('❌ Error en login seguro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Login tradicional (mantener compatibilidad)
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    console.log('🔐 Login tradicional para:', usuario);
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña requeridos'
      });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    const passwordValid = await bcrypt.compare(password, user.pass);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Preparar datos del usuario con polideportivo_id
    const userData = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      email: user.correo,
      dni: user.dni,
      rol: user.rol || ROLES.USUARIO,
      telefono: user.telefono,
      polideportivo_id: user.polideportivo_id || null
    };

    console.log('👤 Datos usuario (tradicional):', {
      id: userData.id,
      usuario: userData.usuario,
      rol: userData.rol,
      polideportivo_id: userData.polideportivo_id
    });

    // Generar token
    const token = jwt.sign(
      { 
        ...userData,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso:', usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      user: userData
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Verificar autenticación (usado por ProtectedRoute)
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  console.log('✅ Autenticación verificada para usuario:', req.user?.id);
  res.json({
    success: true,
    message: 'Autenticación válida',
    user: req.user,
    valid: true
  });
});

// Refrescar token
app.post('/api/auth/refresh', (req, res) => {
  try {
    const cookies = parseCookies(req);
    const refreshToken = cookies.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de refresco requerido' 
      });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          error: 'Token de refresco inválido' 
        });
      }

      // Verificar que el refresh token está en la lista
      const storedToken = refreshTokens.get(decoded.id.toString());
      
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(403).json({ 
          success: false, 
          error: 'Token de refresco no válido' 
        });
      }

      // Buscar usuario para obtener datos actualizados
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('id, usuario, nombre, correo, dni, rol, telefono, polideportivo_id')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuario no encontrado' 
        });
      }

      // Generar nuevo access token
      const newAccessToken = jwt.sign(
        { 
          ...user,
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Actualizar cookie
      setCookie(res, 'auth_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.json({
        success: true,
        token: newAccessToken,
        user: user,
        expiresIn: 24 * 60 * 60
      });
    });
  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Logout seguro
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    // Remover refresh token
    refreshTokens.delete(req.user.id.toString());
    
    // Limpiar cookies
    clearCookie(res, 'auth_token');
    clearCookie(res, 'refresh_token');
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ========== RUTAS DE RECUPERACIÓN ==========

// Health check de recuperación
app.get('/api/recupera/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sistema de recuperación funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      solicitarRecuperacion: 'POST /api/recupera/solicitar-recuperacion',
      verificarCodigo: 'POST /api/recupera/verificar-codigo',
      cambiarPassword: 'POST /api/recupera/cambiar-password',
      reenviarCodigo: 'POST /api/recupera/reenviar-codigo'
    }
  });
});

// Solicitar recuperación
app.post('/api/recupera/solicitar-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔐 Solicitud de recuperación para email:', email);
    
    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', email)
      .single();

    if (error || !user) {
      console.log('⚠️ Usuario no encontrado con email:', email);
      // Por seguridad, devolvemos el mismo mensaje aunque no exista
      return res.json({
        success: true,
        message: 'Si el email existe en nuestro sistema, recibirás un código de verificación'
      });
    }

    // Generar código de 6 dígitos
    const codigo = generarCodigo();
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 15);

    // Insertar código en la base de datos
    const { error: upsertError } = await supabase
      .from('codigos_recuperacion')
      .insert({
        usuario_id: user.id,
        codigo: codigo,
        expira_en: expiration.toISOString(),
        usado: false,
        created_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('❌ Error guardando código:', upsertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al generar código de recuperación' 
      });
    }

    // Preparar datos para el email
    const datosEmail = {
      usuario: user.usuario,
      nombre_usuario: user.nombre,
      email: user.correo,
      codigo: codigo
    };

    // Enviar email de recuperación
    try {
      await enviarEmailRecuperacion(datosEmail);
      console.log('✅ Email de recuperación enviado a:', user.correo);
    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError);
      
      // En desarrollo, mostramos el código para testing
      if (process.env.NODE_ENV !== 'production') {
        console.log('🧪 Código generado (modo desarrollo):', codigo);
      }
    }

    console.log('✅ Código de recuperación generado para:', user.usuario);
    
    // Devolver respuesta exitosa
    res.json({
      success: true,
      message: 'Si el email existe en nuestro sistema, recibirás un código de verificación'
    });

  } catch (error) {
    console.error('❌ Error en solicitud de recuperación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al procesar la solicitud' 
    });
  }
});

// Verificar código de recuperación
app.post('/api/recupera/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    
    console.log('🔐 Verificando código para email:', email);
    
    if (!email || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y código requeridos' 
      });
    }

    if (codigo.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'El código debe tener 6 dígitos' 
      });
    }

    // Primero obtener el usuario por email
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, usuario, correo, nombre')
      .eq('correo', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // Verificar el código en la base de datos
    const { data: codigoData, error: codigoError } = await supabase
      .from('codigos_recuperacion')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expira_en', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (codigoError || !codigoData) {
      console.log('❌ Código inválido o expirado para usuario:', user.usuario);
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido o expirado' 
      });
    }

    console.log('✅ Código verificado para:', user.usuario);
    
    res.json({
      success: true,
      message: 'Código verificado correctamente',
      valido: true,
      usuario: {
        id: user.id,
        username: user.usuario,
        nombre: user.nombre,
        email: user.correo
      }
    });

  } catch (error) {
    console.error('❌ Error verificando código:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al verificar el código' 
    });
  }
});

// Cambiar contraseña
app.post('/api/recupera/cambiar-password', async (req, res) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    
    console.log('🔐 Cambiando contraseña para email:', email);
    
    if (!email || !codigo || !nuevaPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son requeridos' 
      });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Primero obtener el usuario por email
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, usuario, correo')
      .eq('correo', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // Verificar el código
    const { data: codigoData, error: codigoError } = await supabase
      .from('codigos_recuperacion')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expira_en', new Date().toISOString())
      .single();

    if (codigoError || !codigoData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido o expirado' 
      });
    }

    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    // Actualizar contraseña del usuario
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ 
        pass: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error actualizando contraseña:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar la contraseña' 
      });
    }

    // Marcar código como usado
    await supabase
      .from('codigos_recuperacion')
      .update({ usado: true })
      .eq('id', codigoData.id);

    console.log('✅ Contraseña cambiada exitosamente para:', user.usuario);
    
    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente',
      actualizado: true,
      usuario: {
        id: user.id,
        username: user.usuario,
        email: user.correo
      }
    });

  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al cambiar la contraseña' 
    });
  }
});

// Reenviar código
app.post('/api/recupera/reenviar-codigo', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔄 Reenviando código para email:', email);
    
    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Proporciona un email válido' 
      });
    }

    // Verificar si el usuario existe
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', email)
      .single();

    if (error || !user) {
      console.log('⚠️ Usuario no encontrado con email:', email);
      // Por seguridad, devolvemos el mismo mensaje
      return res.json({
        success: true,
        message: 'Si el email existe en nuestro sistema, recibirás un código de verificación'
      });
    }

    // Generar nuevo código
    const nuevoCodigo = generarCodigo();
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 15);

    // Insertar nuevo código
    const { error: upsertError } = await supabase
      .from('codigos_recuperacion')
      .insert({
        usuario_id: user.id,
        codigo: nuevoCodigo,
        expira_en: expiration.toISOString(),
        usado: false,
        created_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('❌ Error guardando nuevo código:', upsertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al generar nuevo código' 
      });
    }

    // Preparar datos para el email
    const datosEmail = {
      usuario: user.usuario,
      nombre_usuario: user.nombre,
      email: user.correo,
      codigo: nuevoCodigo
    };

    // Enviar email
    try {
      await enviarEmailRecuperacion(datosEmail);
      console.log('✅ Nuevo email de recuperación enviado a:', user.correo);
    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError);
      
      // En desarrollo, mostramos el código para testing
      if (process.env.NODE_ENV !== 'production') {
        console.log('🧪 Nuevo código generado (modo desarrollo):', nuevoCodigo);
      }
    }

    console.log('✅ Nuevo código generado para:', user.usuario);
    
    res.json({
      success: true,
      message: 'Si el email existe en nuestro sistema, recibirás un código de verificación'
    });

  } catch (error) {
    console.error('❌ Error reenviando código:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al reenviar el código' 
    });
  }
});

// ========== RUTAS ESPECÍFICAS PARA ADMIN_POLI ==========

app.get('/api/admin-poli/mi-polideportivo', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    
    console.log('🏢 Obteniendo polideportivo para admin_poli:', polideportivo_id);
    
    const { data: polideportivo, error } = await supabase
      .from('polideportivos')
      .select('*')
      .eq('id', polideportivo_id)
      .single();
    
    if (error || !polideportivo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Polideportivo no encontrado' 
      });
    }
    
    res.json({
      success: true,
      data: polideportivo
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo polideportivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

app.get('/api/admin-poli/reservas', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    const { fecha, estado, nombre_usuario, usuario_id } = req.query;
    
    console.log('📋 Obteniendo reservas del polideportivo (admin_poli):', polideportivo_id);
    
    let query = supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .eq('polideportivo_id', polideportivo_id)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });
    
    // Filtros
    if (fecha) {
      query = query.eq('fecha', fecha);
    }
    
    if (estado) {
      query = query.eq('estado', estado);
    }
    
    if (usuario_id && usuario_id !== '0') {
      query = query.eq('usuario_id', usuario_id);
    } else if (nombre_usuario) {
      query = query.ilike('nombre_usuario', `%${nombre_usuario}%`);
    }
    
    const { data: reservas, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo reservas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener reservas' 
      });
    }
    
    // Obtener información de usuarios por separado
    const reservasConInfo = await Promise.all((reservas || []).map(async (reserva) => {
      let usuarioInfo = {
        usuario_login: 'N/A',
        usuario_email: 'N/A',
        usuario_telefono: 'N/A'
      };
      
      if (reserva.usuario_id && reserva.usuario_id !== 0) {
        try {
          const { data: usuario, error: usuarioError } = await supabase
            .from('usuarios')
            .select('usuario, correo, telefono')
            .eq('id', reserva.usuario_id)
            .single();
          
          if (!usuarioError && usuario) {
            usuarioInfo = {
              usuario_login: usuario.usuario || 'N/A',
              usuario_email: usuario.correo || 'N/A',
              usuario_telefono: usuario.telefono || 'N/A'
            };
          }
        } catch (usuarioErr) {
          console.warn('⚠️  No se pudo obtener info del usuario ID:', reserva.usuario_id, usuarioErr);
        }
      }
      
      return {
        ...reserva,
        ludoteca: false,
        pistaNombre: reserva.pistas?.nombre,
        pistaTipo: reserva.pistas?.tipo,
        polideportivo_nombre: reserva.polideportivos?.nombre,
        ...usuarioInfo
      };
    }));
    
    res.json({
      success: true,
      data: reservasConInfo || []
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

app.put('/api/admin-poli/reservas/:id/confirmar', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    
    console.log('✅ Confirmando reserva ID:', id, 'para polideportivo:', polideportivo_id);
    
    // Verificar que la reserva pertenece al polideportivo del admin
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (reservaError || !reserva) {
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada o no tienes permisos' 
      });
    }
    
    if (reserva.estado !== 'pendiente') {
      return res.status(400).json({ 
        success: false, 
        error: 'La reserva ya ha sido confirmada o cancelada' 
      });
    }
    
    // Actualizar reserva
    const { data: reservaActualizada, error: updateError } = await supabase
      .from('reservas')
      .update({ 
        estado: 'confirmada',
        fecha_confirmacion: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        pistas!inner(nombre),
        polideportivos!inner(nombre)
      `)
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al confirmar la reserva' 
      });
    }
    
    // Enviar email de confirmación
    try {
      const datosEmail = {
        id: reservaActualizada.id,
        nombre_usuario: reservaActualizada.nombre_usuario,
        email: reservaActualizada.email_usuario,
        polideportivo_nombre: reservaActualizada.polideportivos?.nombre,
        pista_nombre: reservaActualizada.pistas?.nombre,
        fecha: reservaActualizada.fecha,
        hora_inicio: reservaActualizada.hora_inicio,
        hora_fin: reservaActualizada.hora_fin,
        precio: reservaActualizada.precio,
        pistas: { nombre: reservaActualizada.pistas?.nombre }
      };
      
      if (datosEmail.email) {
        await enviarEmailConfirmacionReserva(datosEmail);
      }
    } catch (emailError) {
      console.error('⚠️  Error enviando email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Reserva confirmada correctamente',
      data: reservaActualizada
    });
    
  } catch (error) {
    console.error('❌ Error confirmando reserva:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

app.put('/api/admin-poli/reservas/:id/cancelar', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    
    console.log('❌ Cancelando reserva ID:', id, 'para polideportivo:', polideportivo_id);
    
    // Verificar que la reserva pertenece al polideportivo del admin
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (reservaError || !reserva) {
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada o no tienes permisos' 
      });
    }
    
    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ 
        success: false, 
        error: 'La reserva ya está cancelada' 
      });
    }
    
    // Actualizar reserva
    const { data: reservaActualizada, error: updateError } = await supabase
      .from('reservas')
      .update({ 
        estado: 'cancelada',
        fecha_cancelacion: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        pistas!inner(nombre)
      `)
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al cancelar la reserva' 
      });
    }
    
    res.json({
      success: true,
      message: 'Reserva cancelada correctamente',
      data: reservaActualizada
    });
    
  } catch (error) {
    console.error('❌ Error cancelando reserva:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// ========== RUTAS ESPECÍFICAS PARA ADMIN ==========

app.get('/api/admin/health', authenticateToken, verificarEsAdmin, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Panel de administración funcionando',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// ========== RUTAS PÚBLICAS ==========
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend funcionando',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    secureAuth: true
  });
});

app.get('/api/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('count')
      .limit(1);

    if (error) throw error;

    res.json({
      success: true,
      message: '✅ Supabase conectado correctamente'
    });
  } catch (error) {
    console.error('Error Supabase:', error);
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase: ' + error.message
    });
  }
});

app.get('/api/polideportivos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('polideportivos')
      .select('*')
      .order('nombre');

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo polideportivos'
    });
  }
});

app.get('/api/pistas', async (req, res) => {
  try {
    const { polideportivo_id } = req.query;
    
    let query = supabase.from('pistas').select('*');
    
    if (polideportivo_id) {
      query = query.eq('polideportivo_id', polideportivo_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo pistas'
    });
  }
});

app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, correo, usuario, dni, telefono, pass, pass_2 } = req.body;
    
    console.log('📝 Registro attempt:', usuario);

    // Validaciones básicas
    if (!nombre || !correo || !usuario || !dni || !pass || !pass_2) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, rellena todos los campos obligatorios'
      });
    }

    if (!validarEmail(correo)) {
      return res.status(400).json({
        success: false,
        error: 'Email no válido'
      });
    }

    if (!validarDNI(dni)) {
      return res.status(400).json({
        success: false,
        error: 'DNI no válido. Formato correcto: 12345678X'
      });
    }

    let telefonoLimpio = null;
    if (telefono && telefono.trim() !== '') {
      if (!validarTelefono(telefono)) {
        return res.status(400).json({
          success: false,
          error: 'Número de teléfono no válido'
        });
      }
      telefonoLimpio = limpiarTelefono(telefono);
    }

    if (pass !== pass_2) {
      return res.status(400).json({
        success: false,
        error: 'Las contraseñas no coinciden'
      });
    }

    if (pass.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const rol = ROLES.USUARIO;

    // Verificar duplicados
    const { data: existingUsers, error: errorCheck } = await supabase
      .from('usuarios')
      .select('usuario, correo, dni')
      .or(`usuario.eq.${usuario},correo.eq.${correo},dni.eq.${dni}`);

    if (errorCheck) {
      console.error('Error verificando duplicados:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar disponibilidad'
      });
    }

    if (existingUsers && existingUsers.length > 0) {
      const userExists = existingUsers.find(u => u.usuario === usuario);
      const emailExists = existingUsers.find(u => u.correo === correo);
      const dniExists = existingUsers.find(u => u.dni === dni);

      if (userExists) {
        return res.status(400).json({ success: false, error: 'El nombre de usuario ya está registrado' });
      }
      if (emailExists) {
        return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado' });
      }
      if (dniExists) {
        return res.status(400).json({ success: false, error: 'El DNI ya está registrado' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(pass, 10);

    const datosUsuario = {
      usuario: usuario.trim(),
      pass: hashedPassword,
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      dni: dni.trim().toUpperCase(),
      rol: rol,
      fecha_creacion: new Date().toISOString()
    };

    if (telefonoLimpio) {
      datosUsuario.telefono = telefonoLimpio;
    }

    const { data: newUser, error: errorInsert } = await supabase
      .from('usuarios')
      .insert([datosUsuario])
      .select(`
        id,
        nombre,
        correo,
        usuario,
        dni,
        telefono,
        rol,
        fecha_creacion
      `)
      .single();

    if (errorInsert) {
      console.error('❌ Error al insertar usuario:', errorInsert);
      return res.status(500).json({
        success: false,
        error: 'Error al registrar el usuario: ' + errorInsert.message
      });
    }

    // Generar token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        usuario: newUser.usuario,
        nombre: newUser.nombre,
        email: newUser.correo,
        rol: newUser.rol
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Usuario registrado exitosamente:', newUser.usuario);
    
    res.json({
      success: true,
      message: `Usuario registrado correctamente como ${rol}`,
      token: token,
      user: {
        id: newUser.id,
        usuario: newUser.usuario,
        nombre: newUser.nombre,
        email: newUser.correo,
        dni: newUser.dni,
        telefono: newUser.telefono,
        rol: newUser.rol
      }
    });

  } catch (error) {
    console.error('❌ Error general en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// ========== MANEJO DE ERRORES ==========
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Ruta no encontrada' 
  });
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ 
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : err.message
  });
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend ejecutándose en puerto ${PORT}`);
  console.log(`🔐 Sistema de autenticación segura ACTIVADO`);
  console.log(`📧 EmailJS: v5.0.2 configurado`);
  console.log(`🌐 Supabase: ${supabaseUrl}`);
  console.log(`🔑 Sistema de recuperación de contraseñas ACTIVADO`);
  console.log(`🔑 Sistema de roles jerárquicos ACTIVADO`);
  console.log(`   • ${ROLES.SUPER_ADMIN} (nivel ${NIVELES_PERMISO[ROLES.SUPER_ADMIN]})`);
  console.log(`   • ${ROLES.ADMIN_POLIDEPORTIVO} (nivel ${NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]})`);
  console.log(`   • ${ROLES.ADMIN} (nivel ${NIVELES_PERMISO[ROLES.ADMIN]})`);
  console.log(`   • ${ROLES.USUARIO} (nivel ${NIVELES_PERMISO[ROLES.USUARIO]})`);
  console.log(`🔑 Endpoints principales:`);
  console.log(`   • Auth: /api/auth/login, /api/auth/verify, /api/auth/refresh, /api/auth/logout`);
  console.log(`   • Login tradicional: /api/login`);
  console.log(`   • Usuarios: /api/usuarios/*`);
  console.log(`   • Reservas: /api/reservas/*`);
  console.log(`   • Polideportivos: /api/polideportivos`);
  console.log(`   • Pistas: /api/pistas`);
  console.log(`   • Registro: /api/registro`);
  console.log(`🌐 Railway URL: https://tfgv2-production.up.railway.app`);
  console.log(`✅ Health Check: https://tfgv2-production.up.railway.app/api/health`);
  console.log(`✅ Auth Health: https://tfgv2-production.up.railway.app/api/auth/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});