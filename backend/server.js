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

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    'https://www.deppo.es',          // Tu dominio principal
    'https://deppo.es',              // Versión sin www
    'http://localhost:3000',         // Desarrollo local
    'http://localhost:3001',         // Desarrollo local alternativo
    'http://localhost:8080'          // Si pruebas localmente
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Authorization']
}));
app.options('*', cors());
app.use(express.json());

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

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token de autenticación requerido' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Token expirado o inválido
      return res.status(403).json({ 
        success: false, 
        error: 'Token inválido o expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    req.user = user;
    next();
  });
};

// ========== MIDDLEWARE PARA VERIFICAR ROLES ==========
// Middleware para verificar que es admin (super_admin, admin_poli o admin)
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

// Middleware para verificar que es super_admin
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

// Middleware para verificar que es admin_poli
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
// ¡IMPORTANTE! Los routers generales deben ir ANTES de las rutas específicas
app.use('/api/reservas', reservasRouter);      // Incluye /api/reservas/mis-reservas
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
app.get('/api/recupera/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sistema de recuperación funcionando',
    timestamp: new Date().toISOString()
  });
});

// Solicitar recuperación de contraseña
app.post('/api/recupera/solicitar', async (req, res) => {
  try {
    const { usuario, email } = req.body;
    
    console.log('🔐 Solicitud de recuperación para:', { usuario, email });
    
    if (!usuario && !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Proporciona usuario o email' 
      });
    }

    let query = supabase.from('usuarios').select('*');
    
    if (usuario) {
      query = query.eq('usuario', usuario);
    }
    if (email) {
      query = query.eq('correo', email);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      console.log('⚠️ Usuario no encontrado:', { usuario, email });
      // Por seguridad, damos el mismo mensaje aunque no exista
      return res.json({
        success: true,
        message: 'Si el usuario existe, recibirás un email con el código'
      });
    }

    if (!user.correo) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no tiene email registrado'
      });
    }

    const codigo = generarCodigo();
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 15);

    const { error: upsertError } = await supabase
      .from('codigos_recuperacion')
      .upsert({
        usuario_id: user.id,
        codigo: codigo,
        expira_en: expiration.toISOString(),
        usado: false
      });

    if (upsertError) {
      console.error('❌ Error guardando código:', upsertError);
      throw new Error('Error al generar código de recuperación');
    }

    const datosEmail = {
      usuario: user.usuario,
      nombre_usuario: user.nombre,
      email: user.correo,
      codigo: codigo
    };

    await enviarEmailRecuperacion(datosEmail);

    console.log('✅ Código de recuperación generado para:', user.usuario);
    
    res.json({
      success: true,
      message: 'Código de recuperación enviado al email registrado',
      usuario: user.usuario,
      email: user.correo
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
app.post('/api/recupera/verificar', async (req, res) => {
  try {
    const { usuario, codigo } = req.body;
    
    console.log('🔐 Verificando código para:', usuario);
    
    if (!usuario || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Usuario y código requeridos' 
      });
    }

    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, usuario, correo')
      .eq('usuario', usuario)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

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
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido o expirado' 
      });
    }

    console.log('✅ Código verificado para:', usuario);
    
    res.json({
      success: true,
      message: 'Código verificado correctamente',
      usuario_id: user.id,
      usuario: user.usuario,
      puede_restablecer: true
    });

  } catch (error) {
    console.error('❌ Error verificando código:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al verificar el código' 
    });
  }
});

// Restablecer contraseña
app.post('/api/recupera/restablecer', async (req, res) => {
  try {
    const { usuario_id, codigo, nueva_password, confirmar_password } = req.body;
    
    console.log('🔐 Restableciendo contraseña para usuario ID:', usuario_id);
    
    if (!usuario_id || !codigo || !nueva_password || !confirmar_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son requeridos' 
      });
    }

    if (nueva_password !== confirmar_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Las contraseñas no coinciden' 
      });
    }

    if (nueva_password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    const { data: codigoData, error: codigoError } = await supabase
      .from('codigos_recuperacion')
      .select('*')
      .eq('usuario_id', usuario_id)
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

    const hashedPassword = await bcrypt.hash(nueva_password, 10);

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ 
        pass: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', usuario_id);

    if (updateError) {
      console.error('❌ Error actualizando contraseña:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar la contraseña' 
      });
    }

    await supabase
      .from('codigos_recuperacion')
      .update({ usado: true })
      .eq('id', codigoData.id);

    console.log('✅ Contraseña restablecida para usuario ID:', usuario_id);
    
    res.json({
      success: true,
      message: 'Contraseña restablecida correctamente'
    });

  } catch (error) {
    console.error('❌ Error restableciendo contraseña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al restablecer la contraseña' 
    });
  }
});

// Test de recuperación
app.get('/api/recupera/test', async (req, res) => {
  try {
    const testData = {
      usuario: 'testuser',
      nombre_usuario: 'Usuario de Prueba',
      email: 'alvaroramirezm8@gmail.com',
      codigo: '123456'
    };

    console.log('🧪 Probando envío de email de recuperación...');
    
    const result = await enviarEmailRecuperacion(testData);
    
    res.json({ 
      success: true, 
      message: '✅ Email de recuperación enviado correctamente',
      to: testData.email,
      result: result
    });
    
  } catch (error) {
    console.error('❌ Error en test de recuperación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test email para reservas
app.get('/api/reservas/test-email', async (req, res) => {
  try {
    const testReserva = {
      id: 999,
      nombre_usuario: 'Alvaro Ramirez',
      email: 'alvaroramirezm8@gmail.com',
      polideportivo_nombre: 'Polideportivo Municipal',
      pista_nombre: 'Pista 1 - Fútbol',
      fecha: '2024-12-20',
      hora_inicio: '16:00',
      hora_fin: '18:00',
      precio: 24.50,
      pistas: { nombre: 'Pista 1 - Fútbol' }
    };

    console.log('🧪 Probando email de confirmación de reserva...');
    
    const result = await enviarEmailConfirmacionReserva(testReserva);
    
    res.json({ 
      success: true, 
      message: '✅ Email de confirmación de reserva enviado correctamente',
      to: testReserva.email,
      result: result
    });
    
  } catch (error) {
    console.error('❌ Error en test de reserva:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========== RUTAS ESPECÍFICAS PARA ADMIN_POLI (DESPUÉS DE LOS ROUTERS) ==========

// Ruta para obtener datos específicos del polideportivo del admin_poli
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

// Ruta para obtener reservas del polideportivo del admin_poli
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

// Ruta para confirmar reserva (admin_poli)
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
      // No fallamos la operación si el email falla
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

// Ruta para cancelar reserva (admin_poli)
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

// Ruta para reenviar email de confirmación (admin_poli)
app.post('/api/admin-poli/reservas/:id/reenviar-email', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    
    console.log('📧 Reenviando email para reserva ID:', id);
    
    // Verificar que la reserva pertenece al polideportivo del admin
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre),
        polideportivos!inner(nombre)
      `)
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (reservaError || !reserva) {
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada o no tienes permisos' 
      });
    }
    
    if (reserva.estado !== 'confirmada') {
      return res.status(400).json({ 
        success: false, 
        error: 'Solo se pueden reenviar emails de reservas confirmadas' 
      });
    }
    
    // Obtener email del usuario
    let emailParaEnviar = '';
    
    if (reserva.email_usuario) {
      emailParaEnviar = reserva.email_usuario;
    } else if (reserva.usuario_id && reserva.usuario_id !== 0) {
      const usuario = await obtenerEmailUsuario(reserva.usuario_id);
      if (usuario && usuario.correo) {
        emailParaEnviar = usuario.correo;
      }
    }
    
    if (!emailParaEnviar) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede reenviar el email - usuario no tiene email registrado' 
      });
    }
    
    // Enviar email
    const datosEmail = {
      id: reserva.id,
      nombre_usuario: reserva.nombre_usuario,
      email: emailParaEnviar,
      polideportivo_nombre: reserva.polideportivos?.nombre,
      pista_nombre: reserva.pistas?.nombre,
      fecha: reserva.fecha,
      hora_inicio: reserva.hora_inicio,
      hora_fin: reserva.hora_fin,
      precio: reserva.precio,
      pistas: { nombre: reserva.pistas?.nombre }
    };
    
    await enviarEmailConfirmacionReserva(datosEmail);
    
    res.json({
      success: true,
      message: 'Email de confirmación reenviado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error reenviando email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para obtener pistas del polideportivo del admin_poli
app.get('/api/admin-poli/pistas', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    const { tipo, disponible } = req.query;
    
    console.log('🎾 Obteniendo pistas del polideportivo:', polideportivo_id);
    
    let query = supabase
      .from('pistas')
      .select('*')
      .eq('polideportivo_id', polideportivo_id)
      .order('tipo')
      .order('nombre');
    
    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    
    if (disponible !== undefined) {
      query = query.eq('disponible', disponible === 'true');
    }
    
    const { data: pistas, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo pistas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener pistas' 
      });
    }
    
    res.json({
      success: true,
      data: pistas || []
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo pistas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para cambiar estado de mantenimiento de pista (admin_poli)
app.patch('/api/admin-poli/pistas/:id/mantenimiento', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    const { enMantenimiento, motivo } = req.body;
    
    console.log('🛠️ Cambiando mantenimiento pista ID:', id, 'para polideportivo:', polideportivo_id);
    
    // Verificar que la pista pertenece al polideportivo del admin
    const { data: pista, error: pistaError } = await supabase
      .from('pistas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (pistaError || !pista) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pista no encontrada o no tienes permisos' 
      });
    }
    
    // Actualizar pista
    const { data: pistaActualizada, error: updateError } = await supabase
      .from('pistas')
      .update({ 
        disponible: !enMantenimiento,
        motivo_mantenimiento: motivo || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando pista:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar el estado de mantenimiento' 
      });
    }
    
    res.json({
      success: true,
      message: `Pista ${enMantenimiento ? 'puesta en mantenimiento' : 'reactivada'} correctamente`,
      data: pistaActualizada
    });
    
  } catch (error) {
    console.error('❌ Error cambiando mantenimiento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para cambiar precio de pista (admin_poli)
app.patch('/api/admin-poli/pistas/:id/precio', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    const { precio } = req.body;
    
    console.log('💰 Cambiando precio pista ID:', id, 'para polideportivo:', polideportivo_id);
    
    if (!precio || isNaN(parseFloat(precio)) || parseFloat(precio) <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Precio inválido. Debe ser un número mayor a 0' 
      });
    }
    
    // Verificar que la pista pertenece al polideportivo del admin
    const { data: pista, error: pistaError } = await supabase
      .from('pistas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (pistaError || !pista) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pista no encontrada o no tienes permisos' 
      });
    }
    
    // Actualizar pista
    const { data: pistaActualizada, error: updateError } = await supabase
      .from('pistas')
      .update({ 
        precio: parseFloat(precio),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando pista:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar el precio' 
      });
    }
    
    res.json({
      success: true,
      message: 'Precio actualizado correctamente',
      data: pistaActualizada
    });
    
  } catch (error) {
    console.error('❌ Error cambiando precio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para obtener estadísticas del polideportivo (admin_poli)
app.get('/api/admin-poli/estadisticas', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    const { periodo = 'mes' } = req.query;
    
    console.log('📊 Obteniendo estadísticas para polideportivo:', polideportivo_id);
    
    const hoy = new Date();
    let fechaInicio = new Date();
    
    // Calcular fecha de inicio según el periodo
    switch (periodo) {
      case 'dia':
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio.setDate(fechaInicio.getDate() - 7);
        break;
      case 'mes':
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
        break;
      case 'año':
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
        break;
      default:
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    }
    
    // Estadísticas de reservas
    const { data: reservasData, error: reservasError } = await supabase
      .from('reservas')
      .select('estado, precio, fecha')
      .eq('polideportivo_id', polideportivo_id)
      .gte('fecha', fechaInicio.toISOString().split('T')[0])
      .lte('fecha', hoy.toISOString().split('T')[0]);
    
    if (reservasError) {
      console.error('Error al obtener estadísticas de reservas:', reservasError);
    }
    
    // Calcular estadísticas
    let totalReservas = 0;
    let reservasConfirmadas = 0;
    let reservasPendientes = 0;
    let reservasCanceladas = 0;
    let ingresosTotales = 0;
    
    if (reservasData) {
      totalReservas = reservasData.length;
      reservasData.forEach(reserva => {
        if (reserva.estado === 'confirmada') {
          reservasConfirmadas++;
          ingresosTotales += parseFloat(reserva.precio || 0);
        } else if (reserva.estado === 'pendiente') {
          reservasPendientes++;
        } else if (reserva.estado === 'cancelada') {
          reservasCanceladas++;
        }
      });
    }
    
    // Estadísticas de pistas
    const { data: pistasData, error: pistasError } = await supabase
      .from('pistas')
      .select('id, nombre, tipo, precio, disponible')
      .eq('polideportivo_id', polideportivo_id);
    
    if (pistasError) {
      console.error('Error al obtener estadísticas de pistas:', pistasError);
    }
    
    let totalPistas = 0;
    let pistasDisponibles = 0;
    const pistasPorTipo = {};
    
    if (pistasData) {
      totalPistas = pistasData.length;
      pistasData.forEach(pista => {
        if (pista.disponible) {
          pistasDisponibles++;
        }
        
        if (pistasPorTipo[pista.tipo]) {
          pistasPorTipo[pista.tipo]++;
        } else {
          pistasPorTipo[pista.tipo] = 1;
        }
      });
    }
    
    const estadisticas = {
      periodo: {
        tipo: periodo,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_fin: hoy.toISOString().split('T')[0]
      },
      reservas: {
        total: totalReservas,
        confirmadas: reservasConfirmadas,
        pendientes: reservasPendientes,
        canceladas: reservasCanceladas,
        tasa_confirmacion: totalReservas > 0 ? (reservasConfirmadas / totalReservas * 100).toFixed(1) + '%' : '0%'
      },
      ingresos: {
        total: parseFloat(ingresosTotales.toFixed(2)),
        promedio_por_reserva: reservasConfirmadas > 0 ? parseFloat((ingresosTotales / reservasConfirmadas).toFixed(2)) : 0
      },
      pistas: {
        total: totalPistas,
        disponibles: pistasDisponibles,
        tasa_disponibilidad: totalPistas > 0 ? (pistasDisponibles / totalPistas * 100).toFixed(1) + '%' : '0%',
        por_tipo: pistasPorTipo
      }
    };
    
    res.json({
      success: true,
      data: estadisticas
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// ========== RUTAS ESPECÍFICAS PARA ADMIN (super_admin y admin general) ==========

// Health check de administración
app.get('/api/admin/health', authenticateToken, verificarEsAdmin, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Panel de administración funcionando',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Ruta para obtener todos los usuarios (admin)
app.get('/api/admin/usuarios', authenticateToken, verificarEsAdmin, async (req, res) => {
  try {
    const { rol, search } = req.query;
    
    console.log('👥 Admin obteniendo usuarios');
    
    let query = supabase
      .from('usuarios')
      .select('id, nombre, usuario, correo, dni, telefono, rol, polideportivo_id, fecha_creacion')
      .order('fecha_creacion', { ascending: false });
    
    if (rol) {
      query = query.eq('rol', rol);
    }
    
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,usuario.ilike.%${search}%,correo.ilike.%${search}%`);
    }
    
    const { data: usuarios, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener usuarios' 
      });
    }
    
    res.json({
      success: true,
      data: usuarios || []
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para cambiar rol de usuario (admin)
app.put('/api/admin/usuarios/:id/rol', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevoRol, polideportivo_id } = req.body;
    const adminId = req.user.id;
    
    console.log('👑 Cambiando rol usuario ID:', id, 'nuevo rol:', nuevoRol);
    
    if (!nuevoRol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nuevo rol es requerido' 
      });
    }
    
    // Verificar roles válidos
    const rolesValidos = [ROLES.SUPER_ADMIN, ROLES.ADMIN_POLIDEPORTIVO, ROLES.ADMIN, ROLES.USUARIO];
    if (!rolesValidos.includes(nuevoRol)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rol no válido' 
      });
    }
    
    // No permitir cambiar tu propio rol
    if (parseInt(id) === adminId) {
      return res.status(400).json({ 
        success: false, 
        error: 'No puedes cambiar tu propio rol' 
      });
    }
    
    const updateData = {
      rol: nuevoRol,
      updated_at: new Date().toISOString()
    };
    
    // Si es admin_poli, asignar polideportivo_id si se proporciona
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO && polideportivo_id) {
      updateData.polideportivo_id = polideportivo_id;
    } else if (nuevoRol !== ROLES.ADMIN_POLIDEPORTIVO) {
      updateData.polideportivo_id = null;
    }
    
    // Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select('id, nombre, usuario, correo, rol, polideportivo_id')
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando usuario:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar el rol' 
      });
    }
    
    res.json({
      success: true,
      message: `Rol actualizado a ${nuevoRol}`,
      data: usuarioActualizado
    });
    
  } catch (error) {
    console.error('❌ Error cambiando rol:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// ========== RUTAS PÚBLICAS (AL FINAL) ==========

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend funcionando',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    secureAuth: true,
    endpoints: {
      auth: '/api/auth/*',
      login: '/api/auth/login',
      verify: '/api/auth/verify',
      refresh: '/api/auth/refresh',
      logout: '/api/auth/logout',
      usuarios: '/api/usuarios/*',
      reservas: '/api/reservas/*',
      polideportivos: '/api/polideportivos',
      pistas: '/api/pistas',
      registro: '/api/registro',
      admin: '/api/admin/* (super_admin y admin)',
      adminPoli: '/api/admin-poli/* (admin_poli con polideportivo)'
    }
  });
});

// TEST SUPABASE
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

// POLIDEPORTIVOS
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

// PISTAS
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

// ========== REGISTRO ==========
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

    // TODOS los nuevos registros son 'usuario' por defecto
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

// ========== RUTA PARA CREAR SUPER_ADMIN INICIAL ==========
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/setup/super-admin', async (req, res) => {
    try {
      const { dni, nombre, correo, usuario, password } = req.body;
      
      if (!dni || !nombre || !correo || !usuario || !password) {
        return res.status(400).json({
          success: false,
          error: 'Todos los campos son obligatorios'
        });
      }
      
      // Verificar si ya existe un super admin
      const { data: existingAdmin, error: checkError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', ROLES.SUPER_ADMIN)
        .limit(1);
        
      if (checkError) throw checkError;
      
      if (existingAdmin && existingAdmin.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un super administrador en el sistema'
        });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          dni,
          nombre,
          correo,
          usuario,
          pass: hashedPassword,
          rol: ROLES.SUPER_ADMIN,
          fecha_creacion: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'Super admin creado exitosamente',
        data
      });
    } catch (error) {
      console.error('Error creando super admin:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

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
  console.log(`🔑 Sistema de roles jerárquicos ACTIVADO`);
  console.log(`   • ${ROLES.SUPER_ADMIN} (nivel ${NIVELES_PERMISO[ROLES.SUPER_ADMIN]})`);
  console.log(`   • ${ROLES.ADMIN_POLIDEPORTIVO} (nivel ${NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]})`);
  console.log(`   • ${ROLES.ADMIN} (nivel ${NIVELES_PERMISO[ROLES.ADMIN]})`);
  console.log(`   • ${ROLES.USUARIO} (nivel ${NIVELES_PERMISO[ROLES.USUARIO]})`);
  console.log(`🔑 Endpoints principales:`);
  console.log(`   • Auth: /api/auth/login, /api/auth/verify, /api/auth/refresh, /api/auth/logout`);
  console.log(`   • Login tradicional: /api/login`);
  console.log(`   • Usuarios: /api/usuarios/*`);
  console.log(`   • Reservas: /api/reservas/* (INCLUYE /api/reservas/mis-reservas)`);
  console.log(`   • Polideportivos: /api/polideportivos`);
  console.log(`   • Pistas: /api/pistas`);
  console.log(`   • Registro: /api/registro`);
  console.log(`   • Admin: /api/admin/* (super_admin y admin general)`);
  console.log(`   • Admin Poli: /api/admin-poli/* (admin_poli con polideportivo)`);
  console.log(`   • Setup Super Admin (solo dev): /api/setup/super-admin`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Health: http://localhost:${PORT}/api/auth/health`);
  console.log(`👑 Admin Health: http://localhost:${PORT}/api/admin/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});
