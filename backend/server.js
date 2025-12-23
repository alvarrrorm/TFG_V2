const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const emailjs = require('@emailjs/nodejs');

// ========== CONFIGURACIÓN COMPLETA ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';

// CONFIGURACIÓN CORREGIDA: USAR SERVICE ROLE KEY PARA PERMISOS COMPLETOS
const supabaseAnonKey = process.env.SUPABASE_KEY; // Anterior: supabaseKey (clave pública)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Nueva: Service Role Key

const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mi_clave_refresh_segura_2024';

// VERIFICAR CLAVES
if (!supabaseServiceKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no configurada en Railway');
  console.log('⚠️  Solución: Verifica que añadiste la variable en Railway como SUPABASE_SERVICE_ROLE_KEY');
  console.log('⚠️  Usando clave pública como fallback...');
}

if (!supabaseAnonKey && !supabaseServiceKey) {
  console.error('❌ ERROR CRÍTICO: No hay claves de Supabase configuradas');
  process.exit(1);
}

// CREAR DOS CLIENTES: UNO CON SERVICE KEY PARA ADMIN, OTRO CON ANON KEY PARA USUARIOS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente público para operaciones regulares
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

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

// ✅ IMPORTAR EL ROUTER DE LOGIN SEPARADO
const loginRouter = require('./rutas/login');

// ✅ IMPORTAR EL ROUTER DE USUARIOS
const usuariosRoutes = require('./rutas/usuarios');

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

// Función para obtener el cliente Supabase correcto según el rol
function getSupabaseClient(user = null) {
  if (!user) {
    return supabasePublic; // Usuario no autenticado
  }
  
  // Administradores obtienen el cliente con Service Role Key
  if (user.rol === ROLES.SUPER_ADMIN || user.rol === ROLES.ADMIN || user.rol === ROLES.ADMIN_POLIDEPORTIVO) {
    return supabaseAdmin;
  }
  
  return supabasePublic; // Usuarios regulares
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

    const supabaseClient = getSupabaseClient();
    const { data: usuario, error } = await supabaseClient
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
app.set('supabase', supabasePublic); // Cliente público por defecto
app.set('supabaseAdmin', supabaseAdmin); // Cliente admin para rutas protegidas
app.set('getSupabaseClient', getSupabaseClient); // Función para obtener cliente según rol
app.set('enviarEmailConfirmacion', enviarEmailConfirmacionReserva);
app.set('obtenerEmailUsuario', obtenerEmailUsuario);
app.set('ROLES', ROLES);
app.set('NIVELES_PERMISO', NIVELES_PERMISO);
app.set('verificarEsAdmin', verificarEsAdmin);
app.set('verificarEsSuperAdmin', verificarEsSuperAdmin);
app.set('verificarEsAdminPoli', verificarEsAdminPoli);

// ========== REGISTRAR ROUTERS PRINCIPALES ==========
// ✅ REGISTRAR EL ROUTER DE USUARIOS
app.use('/api/usuarios', usuariosRoutes.router);

app.use('/api/reservas', reservasRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);

// ✅ USAR EL ROUTER DE LOGIN SEPARADO EN LUGAR DE LA RUTA DIRECTA
app.use('/api', loginRouter); // Esto manejará /api/login

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
    refreshTokens: '✅ Configurado',
    supabaseKeys: {
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      usingServiceKey: !!supabaseServiceKey
    }
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

    const { data: user, error } = await supabasePublic
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
      const { data: user, error } = await supabasePublic
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

// ========== RUTAS DE RECUPERACIÓN DE CONTRASEÑA ==========

// Ruta para solicitar recuperación de contraseña
app.post('/api/recupera/solicitar-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔐 Solicitud de recuperación para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    // Verificar si el usuario existe y obtener TODOS LOS DATOS
    const { data: usuarios, error: userError } = await supabasePublic
      .from('usuarios')
      .select('id, nombre, correo, usuario, dni, telefono')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    // Por seguridad, siempre devolvemos el mismo mensaje
    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

    if (!usuarios || usuarios.length === 0) {
      console.log('📧 Email no encontrado (por seguridad):', email);
      return res.json({ 
        success: true, 
        message: mensajeSeguro
      });
    }

    const usuario = usuarios[0];
    
    // Generar código de 6 dígitos
    const codigo = generarCodigo();
    
    // Guardar código en la base de datos CON EL USER_ID para seguimiento
    const { error: insertError } = await supabasePublic
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: codigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando código:', insertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al generar código de recuperación' 
      });
    }

    // Enviar email de recuperación CON TODA LA INFORMACIÓN DEL USUARIO
    try {
      const datosEmail = {
        email: usuario.correo,
        nombre_usuario: usuario.nombre,
        usuario: usuario.usuario,
        codigo: codigo
      };

      // Log de seguridad - quién está solicitando recuperación
      console.log('👤 USUARIO SOLICITANDO RECUPERACIÓN:', {
        id: usuario.id,
        nombre: usuario.nombre,
        usuario: usuario.usuario,
        email: usuario.correo,
        dni: usuario.dni ? `${usuario.dni.substring(0, 3)}...` : 'No disponible',
        telefono: usuario.telefono || 'No disponible',
        timestamp: new Date().toISOString()
      });

      await enviarEmailRecuperacion(datosEmail);
      
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        // Solo en desarrollo mostramos info adicional
        debug: process.env.NODE_ENV === 'development' ? {
          usuario: usuario.usuario,
          nombre: usuario.nombre,
          codigo: codigo
        } : undefined
      });
      
    } catch (emailError) {
      console.error('❌ Error enviando email de recuperación:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al enviar el email de recuperación',
        // En desarrollo mostramos el código para testing
        debug: process.env.NODE_ENV === 'development' ? {
          codigo: codigo,
          usuario: usuario.usuario
        } : undefined
      });
    }
    
  } catch (error) {
    console.error('❌ Error en solicitar-recuperacion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para reenviar código
app.post('/api/recupera/reenviar-codigo', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔄 Reenviando código para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    // Verificar si el usuario existe
    const { data: usuarios, error: userError } = await supabasePublic
      .from('usuarios')
      .select('id, nombre, correo, usuario')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

    if (!usuarios || usuarios.length === 0) {
      return res.json({ 
        success: true, 
        message: mensajeSeguro
      });
    }

    const usuario = usuarios[0];
    
    // Generar NUEVO código de 6 dígitos
    const nuevoCodigo = generarCodigo();
    
    // Guardar NUEVO código en la base de datos
    const { error: insertError } = await supabasePublic
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: nuevoCodigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando nuevo código:', insertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al reenviar el código' 
      });
    }

    // Enviar NUEVO email de recuperación
    try {
      const datosEmail = {
        email: usuario.correo,
        nombre_usuario: usuario.nombre,
        usuario: usuario.usuario,
        codigo: nuevoCodigo
      };

      console.log('🔄 REENVIO DE CÓDIGO PARA:', {
        usuario: usuario.usuario,
        email: usuario.correo,
        nuevo_codigo: nuevoCodigo
      });

      await enviarEmailRecuperacion(datosEmail);
      
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        debug: process.env.NODE_ENV === 'development' ? {
          usuario: usuario.usuario,
          codigo: nuevoCodigo
        } : undefined
      });
      
    } catch (emailError) {
      console.error('❌ Error reenviando email de recuperación:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al reenviar el email de recuperación',
        debug: process.env.NODE_ENV === 'development' ? {
          codigo: nuevoCodigo,
          usuario: usuario.usuario
        } : undefined
      });
    }
    
  } catch (error) {
    console.error('❌ Error en reenviar-codigo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para verificar código de recuperación
app.post('/api/recupera/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    console.log('🔍 Verificando código para:', email, 'Código:', codigo);

    if (!email || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y código son requeridos' 
      });
    }

    // Verificar código en la base de datos
    const { data: recuperaciones, error } = await supabasePublic
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
      .order('creado', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error verificando código:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      console.log('❌ Código no válido para:', email);
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido, expirado o ya utilizado' 
      });
    }

    const recuperacion = recuperaciones[0];
    
    // Obtener información del usuario
    const { data: usuario } = await supabasePublic
      .from('usuarios')
      .select('usuario, nombre')
      .eq('id', recuperacion.user_id)
      .single();

    console.log('✅ Código verificado para usuario:', {
      usuario: usuario?.usuario,
      nombre: usuario?.nombre,
      email: recuperacion.email
    });

    res.json({ 
      success: true, 
      message: 'Código verificado correctamente',
      valido: true,
      usuario: {
        username: usuario?.usuario,
        nombre: usuario?.nombre
      }
    });
    
  } catch (error) {
    console.error('❌ Error en verificar-codigo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para cambiar contraseña después de verificación
app.post('/api/recupera/cambiar-password', async (req, res) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    console.log('🔄 Cambiando password para:', email);

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

    // Verificar que el código es válido
    const { data: recuperaciones, error: verificarError } = await supabasePublic
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
      .order('creado', { ascending: false })
      .limit(1);

    if (verificarError) {
      console.error('❌ Error verificando código:', verificarError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido o expirado' 
      });
    }

    const recuperacion = recuperaciones[0];
    const userId = recuperacion.user_id;

    try {
      // ENCRIPTAR LA NUEVA CONTRASEÑA CON BCRYPT
      const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
      
      console.log('🔐 Contraseña encriptada correctamente para user_id:', userId);

      // Actualizar contraseña del usuario
      const { error: updateError } = await supabasePublic
        .from('usuarios')
        .update({ pass: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Error actualizando contraseña:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al cambiar la contraseña' 
        });
      }

      // Marcar código como usado
      await supabasePublic
        .from('recuperacion_password')
        .update({ usado: true })
        .eq('email', email)
        .eq('codigo', codigo);

      // Obtener información del usuario para el log
      const { data: usuario } = await supabasePublic
        .from('usuarios')
        .select('usuario, nombre')
        .eq('id', userId)
        .single();

      // Log de la operación completada
      console.log('✅ CONTRASEÑA CAMBIADA EXITOSAMENTE:', {
        usuario: usuario?.usuario,
        nombre: usuario?.nombre,
        email: email,
        user_id: userId,
        timestamp: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        message: 'Contraseña cambiada exitosamente',
        actualizado: true,
        usuario: {
          username: usuario?.usuario,
          nombre: usuario?.nombre
        }
      });

    } catch (encryptionError) {
      console.error('❌ Error encriptando contraseña:', encryptionError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al procesar la contraseña' 
      });
    }
    
  } catch (error) {
    console.error('❌ Error en cambiar-password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
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

// ========== RUTAS ESPECÍFICAS PARA ADMIN_POLI (DESPUÉS DE LOS ROUTERS) ==========

// Ruta para obtener datos específicos del polideportivo del admin_poli
app.get('/api/admin-poli/mi-polideportivo', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    
    console.log('🏢 Obteniendo polideportivo para admin_poli:', polideportivo_id);
    
    const supabaseClient = getSupabaseClient(req.user);
    const { data: polideportivo, error } = await supabaseClient
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
    
    const supabaseClient = getSupabaseClient(req.user);
    let query = supabaseClient
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
          const { data: usuario, error: usuarioError } = await supabaseClient
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
    
    const supabaseClient = getSupabaseClient(req.user);
    
    // Verificar que la reserva pertenece al polideportivo del admin
    const { data: reserva, error: reservaError } = await supabaseClient
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
    const { data: reservaActualizada, error: updateError } = await supabaseClient
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
    
    const supabaseClient = getSupabaseClient(req.user);
    
    // Verificar que la reserva pertenece al polideportivo del admin
    const { data: reserva, error: reservaError } = await supabaseClient
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
    const { data: reservaActualizada, error: updateError } = await supabaseClient
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

// ========== RUTAS ESPECÍFICAS PARA ADMIN (super_admin y admin general) ==========

// Health check de administración
app.get('/api/admin/health', authenticateToken, verificarEsAdmin, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Panel de administración funcionando',
    user: req.user,
    timestamp: new Date().toISOString(),
    supabaseAccess: 'Service Role Key: ' + (!!supabaseServiceKey ? '✅ ACTIVADA' : '❌ NO DISPONIBLE')
  });
});

// ========== NUEVAS RUTAS DE ADMINISTRACIÓN COMPLETAS ==========

// Ruta para obtener todas las reservas (admin completo)
app.get('/api/admin/reservas', authenticateToken, verificarEsAdmin, async (req, res) => {
  try {
    const { fecha, estado, polideportivo_id, usuario_id } = req.query;
    
    console.log('📋 Obteniendo todas las reservas (admin)');
    
    const supabaseClient = getSupabaseClient(req.user);
    let query = supabaseClient
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo, precio),
        polideportivos!inner(nombre, direccion),
        usuarios:usuario_id(usuario, correo, nombre, telefono)
      `)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });
    
    // Filtros
    if (fecha) {
      query = query.eq('fecha', fecha);
    }
    
    if (estado) {
      query = query.eq('estado', estado);
    }
    
    if (polideportivo_id && polideportivo_id !== '0') {
      query = query.eq('polideportivo_id', polideportivo_id);
    }
    
    if (usuario_id && usuario_id !== '0') {
      query = query.eq('usuario_id', usuario_id);
    }
    
    const { data: reservas, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo reservas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener reservas' 
      });
    }
    
    res.json({
      success: true,
      data: reservas || []
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para obtener estadísticas del sistema (super_admin)
app.get('/api/admin/estadisticas', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del sistema');
    
    const supabaseClient = getSupabaseClient(req.user);
    
    // Obtener estadísticas en paralelo
    const [
      usuariosData,
      reservasData,
      polideportivosData,
      pistasData,
      reservasPorEstado,
      reservasRecientes
    ] = await Promise.all([
      // Total usuarios por rol
      supabaseClient
        .from('usuarios')
        .select('rol, count')
        .group('rol'),
      
      // Total reservas
      supabaseClient
        .from('reservas')
        .select('count'),
      
      // Total polideportivos
      supabaseClient
        .from('polideportivos')
        .select('count'),
      
      // Total pistas
      supabaseClient
        .from('pistas')
        .select('count'),
      
      // Reservas por estado
      supabaseClient
        .from('reservas')
        .select('estado, count')
        .group('estado'),
      
      // Reservas recientes (últimos 7 días)
      supabaseClient
        .from('reservas')
        .select(`
          *,
          pistas(nombre),
          polideportivos(nombre),
          usuarios:usuario_id(usuario, nombre)
        `)
        .gte('fecha', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('fecha', { ascending: false })
        .limit(10)
    ]);
    
    const estadisticas = {
      usuarios: {
        total: usuariosData.count || 0,
        porRol: usuariosData.data || []
      },
      reservas: {
        total: reservasData.count || 0,
        porEstado: reservasPorEstado.data || []
      },
      polideportivos: polideportivosData.count || 0,
      pistas: pistasData.count || 0,
      reservasRecientes: reservasRecientes.data || []
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

// ========== RUTAS PÚBLICAS (AL FINAL) ==========

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend funcionando COMPLETAMENTE',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    secureAuth: true,
    supabaseConfig: {
      url: supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      usingServiceKey: !!supabaseServiceKey ? '✅ SI' : '❌ NO'
    },
    endpoints: {
      auth: '/api/auth/*',
      login: '/api/login (router separado)',
      verify: '/api/auth/verify',
      refresh: '/api/auth/refresh',
      logout: '/api/auth/logout',
      usuarios: '/api/usuarios/*',
      reservas: '/api/reservas/*',
      polideportivos: '/api/polideportivos',
      pistas: '/api/pistas',
      registro: '/api/registro',
      recuperacion: '/api/recupera/*',
      admin: '/api/admin/* (super_admin y admin)',
      adminPoli: '/api/admin-poli/* (admin_poli con polideportivo)'
    }
  });
});

// TEST SUPABASE CON SERVICE ROLE KEY
app.get('/api/test-supabase-admin', async (req, res) => {
  try {
    console.log('🔐 Probando conexión con Service Role Key...');
    
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error con Service Role Key:', error);
      return res.status(500).json({
        success: false,
        error: 'Error conectando con Service Role Key: ' + error.message,
        config: {
          hasServiceKey: !!supabaseServiceKey,
          keyLength: supabaseServiceKey ? supabaseServiceKey.length : 0
        }
      });
    }

    res.json({
      success: true,
      message: '✅ Supabase Service Role Key conectada correctamente',
      config: {
        hasServiceKey: !!supabaseServiceKey,
        keyLength: supabaseServiceKey ? supabaseServiceKey.length : 0
      }
    });
  } catch (error) {
    console.error('Error Supabase Service Key:', error);
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase con Service Role Key: ' + error.message
    });
  }
});

// TEST SUPABASE PÚBLICO
app.get('/api/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabasePublic
      .from('usuarios')
      .select('count')
      .limit(1);

    if (error) throw error;

    res.json({
      success: true,
      message: '✅ Supabase público conectado correctamente'
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
    const { data, error } = await supabasePublic
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
    
    let query = supabasePublic.from('pistas').select('*');
    
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

// ========== RUTAS ESPECÍFICAS PARA MANTENIMIENTO DE PISTAS ==========

// Ruta para cambiar estado de mantenimiento de pista
app.put('/api/pistas/:id/mantenimiento', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { disponible } = req.body;
  const user = req.user;

  console.log(`🛠️ Cambiando mantenimiento pista ${id}, disponible:`, disponible, 'usuario:', user.rol);

  // Validar que el campo es booleano
  if (typeof disponible !== 'boolean') {
    return res.status(400).json({ 
      success: false,
      error: 'El campo disponible debe ser un valor booleano (true/false)' 
    });
  }

  try {
    const supabaseClient = getSupabaseClient(user);
    
    // Verificar que la pista existe
    let query = supabaseClient
      .from('pistas')
      .select('id, polideportivo_id, nombre, disponible')
      .eq('id', id);

    // Si es admin_poli, solo puede modificar pistas de su polideportivo
    if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
      query = query.eq('polideportivo_id', user.polideportivo_id);
    }

    const { data: pista, error: pistaError } = await query.single();

    if (pistaError || !pista) {
      console.error('❌ Pista no encontrada o sin permisos:', pistaError);
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada o no tienes permisos para modificarla' 
      });
    }

    console.log(`ℹ️ Pista actual estado: disponible = ${pista.disponible}, recibido: disponible = ${disponible}`);

    // Lógica: Si disponible = true → poner en mantenimiento → disponible = false
    // Si disponible = false → quitar mantenimiento → disponible = true
    const nuevoDisponible = !disponible;

    const updateData = { 
      disponible: nuevoDisponible,
      updated_at: new Date().toISOString()
    };

    // Actualizar estado en la base de datos
    const { data: pistaActualizada, error: updateError } = await supabaseClient
      .from('pistas')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        polideportivos:polideportivo_id (nombre, direccion)
      `);

    // NO USAR .single() aquí porque después del UPDATE a veces no devuelve fila inmediatamente
    if (updateError) {
      console.error('❌ Error al actualizar estado:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar estado de mantenimiento: ' + updateError.message 
      });
    }

    // Si no se devolvió data, obtener la pista actualizada por separado
    if (!pistaActualizada || pistaActualizada.length === 0) {
      // Obtener la pista actualizada
      const { data: pistaActual, error: getError } = await supabaseClient
        .from('pistas')
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .eq('id', id)
        .single();

      if (getError) {
        console.error('❌ Error obteniendo pista actualizada:', getError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al obtener pista actualizada' 
        });
      }

      pistaActualizada[0] = pistaActual;
    }

    console.log(`✅ Estado actualizado pista ${id}: disponible = ${pistaActualizada[0].disponible}`);

    const respuesta = {
      id: pistaActualizada[0].id,
      nombre: pistaActualizada[0].nombre,
      tipo: pistaActualizada[0].tipo,
      precio: parseFloat(pistaActualizada[0].precio),
      descripcion: pistaActualizada[0].descripcion,
      polideportivo_id: pistaActualizada[0].polideportivo_id,
      polideportivo_nombre: pistaActualizada[0].polideportivos?.nombre,
      polideportivo_direccion: pistaActualizada[0].polideportivos?.direccion,
      disponible: pistaActualizada[0].disponible === true || pistaActualizada[0].disponible === 1,
      created_at: pistaActualizada[0].created_at,
      updated_at: pistaActualizada[0].updated_at
    };

    res.json({
      success: true,
      data: respuesta,
      disponible: !respuesta.disponible,
      message: `Pista ${disponible ? 'puesta en mantenimiento' : 'reactivada'} correctamente`
    });

  } catch (error) {
    console.error('❌ Error al actualizar estado:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar estado de mantenimiento' 
    });
  }
});

// Ruta PATCH para compatibilidad
app.patch('/api/pistas/:id/mantenimiento', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { disponible } = req.body;
  const user = req.user;

  console.log(`🛠️ (PATCH) Cambiando mantenimiento pista ${id}, disponible:`, disponible, 'usuario:', user.rol);

  // Validar que el campo es booleano
  if (typeof disponible !== 'boolean') {
    return res.status(400).json({ 
      success: false,
      error: 'El campo disponible debe ser un valor booleano (true/false)' 
    });
  }

  try {
    const supabaseClient = getSupabaseClient(user);
    
    // Verificar que la pista existe
    let query = supabaseClient
      .from('pistas')
      .select('id, polideportivo_id, nombre, disponible')
      .eq('id', id);

    // Si es admin_poli, solo puede modificar pistas de su polideportivo
    if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
      query = query.eq('polideportivo_id', user.polideportivo_id);
    }

    const { data: pista, error: pistaError } = await query.single();

    if (pistaError || !pista) {
      console.error('❌ Pista no encontrada o sin permisos:', pistaError);
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada o no tienes permisos para modificarla' 
      });
    }

    // Lógica: Si disponible = true → poner en mantenimiento → disponible = false
    // Si disponible = false → quitar mantenimiento → disponible = true
    const nuevoDisponible = !disponible;

    const updateData = { 
      disponible: nuevoDisponible,
      updated_at: new Date().toISOString()
    };

    // Actualizar estado en la base de datos
    const { data: pistaActualizada, error: updateError } = await supabaseClient
      .from('pistas')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        polideportivos:polideportivo_id (nombre, direccion)
      `);

    if (updateError) {
      console.error('❌ Error al actualizar estado:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar estado de mantenimiento: ' + updateError.message 
      });
    }

    // Si no se devolvió data, obtener la pista actualizada por separado
    if (!pistaActualizada || pistaActualizada.length === 0) {
      // Obtener la pista actualizada
      const { data: pistaActual, error: getError } = await supabaseClient
        .from('pistas')
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .eq('id', id)
        .single();

      if (getError) {
        console.error('❌ Error obteniendo pista actualizada:', getError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al obtener pista actualizada' 
        });
      }

      pistaActualizada[0] = pistaActual;
    }

    console.log(`✅ (PATCH) Estado actualizado pista ${id}: disponible = ${pistaActualizada[0].disponible}`);

    const respuesta = {
      id: pistaActualizada[0].id,
      nombre: pistaActualizada[0].nombre,
      tipo: pistaActualizada[0].tipo,
      precio: parseFloat(pistaActualizada[0].precio),
      descripcion: pistaActualizada[0].descripcion,
      polideportivo_id: pistaActualizada[0].polideportivo_id,
      polideportivo_nombre: pistaActualizada[0].polideportivos?.nombre,
      polideportivo_direccion: pistaActualizada[0].polideportivos?.direccion,
      disponible: pistaActualizada[0].disponible === true || pistaActualizada[0].disponible === 1,
      created_at: pistaActualizada[0].created_at,
      updated_at: pistaActualizada[0].updated_at
    };

    res.json({
      success: true,
      data: respuesta,
      disponible: !respuesta.disponible,
      message: `Pista ${disponible ? 'puesta en mantenimiento' : 'reactivada'} correctamente`
    });

  } catch (error) {
    console.error('❌ Error al actualizar estado:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar estado de mantenimiento' 
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
    const { data: existingUsers, error: errorCheck } = await supabasePublic
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

    const { data: newUser, error: errorInsert } = await supabasePublic
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
  console.log(`🔑 Claves Supabase configuradas:`);
  console.log(`   • Anon Key (pública): ${supabaseAnonKey ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA'}`);
  console.log(`   • Service Role Key: ${supabaseServiceKey ? '✅ CONFIGURADA EN RAILWAY' : '❌ NO CONFIGURADA'}`);
  console.log(`   • Usando Service Key: ${supabaseServiceKey ? '✅ SÍ' : '❌ NO'}`);
  console.log(`🔑 Sistema de recuperación de contraseñas ACTIVADO`);
  console.log(`🔑 Sistema de roles jerárquicos ACTIVADO`);
  console.log(`   • ${ROLES.SUPER_ADMIN} (nivel ${NIVELES_PERMISO[ROLES.SUPER_ADMIN]})`);
  console.log(`   • ${ROLES.ADMIN_POLIDEPORTIVO} (nivel ${NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]})`);
  console.log(`   • ${ROLES.ADMIN} (nivel ${NIVELES_PERMISO[ROLES.ADMIN]})`);
  console.log(`   • ${ROLES.USUARIO} (nivel ${NIVELES_PERMISO[ROLES.USUARIO]})`);
  console.log(`🔑 Endpoints principales:`);
  console.log(`   • Login tradicional: /api/login (router separado)`);
  console.log(`   • Auth: /api/auth/login, /api/auth/verify, /api/auth/refresh, /api/auth/logout`);
  console.log(`   • Usuarios: /api/usuarios/* ✅ REGISTRADO`);
  console.log(`   • Reservas: /api/reservas/*`);
  console.log(`   • Polideportivos: /api/polideportivos`);
  console.log(`   • Pistas: /api/pistas`);
  console.log(`   • Registro: /api/registro`);
  console.log(`   • Recuperación de contraseñas:`);
  console.log(`      - POST /api/recupera/solicitar-recuperacion`);
  console.log(`      - POST /api/recupera/verificar-codigo`);
  console.log(`      - POST /api/recupera/cambiar-password`);
  console.log(`      - POST /api/recupera/reenviar-codigo`);
  console.log(`   • Admin: /api/admin/* (super_admin y admin general)`);
  console.log(`   • Admin Poli: /api/admin-poli/* (admin_poli con polideportivo)`);
  console.log(`   • Estadísticas: /api/admin/estadisticas (super_admin)`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Health: http://localhost:${PORT}/api/auth/health`);
  console.log(`🔑 Recuperación Health: http://localhost:${PORT}/api/recupera/health`);
  console.log(`👑 Admin Health: http://localhost:${PORT}/api/admin/health`);
  console.log(`🔐 Test Service Key: http://localhost:${PORT}/api/test-supabase-admin`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});