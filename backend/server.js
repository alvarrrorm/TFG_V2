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

// ========== MIDDLEWARE ==========
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
      rol: user.rol || 'user',
      telefono: user.telefono
    };

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
      expiresIn: 24 * 60 * 60 // 24 horas en segundos
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
        .select('id, usuario, nombre, correo, dni, rol, telefono')
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

    // Generar token
    const token = jwt.sign(
      { 
        id: user.id, 
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.correo,
        rol: user.rol || 'user'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso:', usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.correo,
        rol: user.rol || 'user'
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ========== RUTAS PROTEGIDAS POR TOKEN ==========

// Ejemplo de ruta protegida
app.get('/api/protected/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Acceso a ruta protegida exitoso',
    user: req.user
  });
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

// ========== RUTAS DE EMAIL PARA RESERVAS ==========
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

// Ruta para confirmar reserva y enviar email (PROTEGIDA)
app.put('/api/reservas/:id/confirmar', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✅ Confirmando reserva ID:', id, 'por usuario:', req.user.usuario);

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de reserva inválido' 
      });
    }

    const reservaId = parseInt(id);

    // Verificar que la reserva pertenece al usuario
    const { data: reserva, error: queryError } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', reservaId)
      .eq('usuario_id', req.user.id)
      .single();

    if (queryError || !reserva) {
      console.error('❌ Error obteniendo reserva:', queryError);
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada o no tienes permiso' 
      });
    }

    if (reserva.estado !== 'pendiente') {
      return res.status(400).json({ 
        success: false, 
        error: 'La reserva ya ha sido confirmada o cancelada' 
      });
    }

    // Actualizar estado de la reserva
    const { error: updateError } = await supabase
      .from('reservas')
      .update({ 
        estado: 'confirmada',
        fecha_confirmacion: new Date().toISOString()
      })
      .eq('id', reservaId);

    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor al confirmar' 
      });
    }

    console.log('✅ Reserva actualizada a estado: confirmada');

    // Obtener el email del usuario
    const usuario = await obtenerEmailUsuario(req.user.id);
    
    let emailEnviado = false;
    let mensajeEmail = '';
    
    if (usuario && usuario.correo) {
      const reservaConEmail = {
        ...reserva,
        email: usuario.correo,
        nombre_usuario: usuario.nombre || reserva.nombre_usuario,
        polideportivo_nombre: reserva.polideportivos?.nombre,
        pista_nombre: reserva.pistas?.nombre,
        estado: 'confirmada'
      };

      try {
        await enviarEmailConfirmacionReserva(reservaConEmail);
        emailEnviado = true;
        mensajeEmail = 'Email de confirmación enviado correctamente';
        console.log('✅ Email enviado exitosamente');
        
      } catch (emailError) {
        console.error('⚠️  Error enviando email:', emailError);
        mensajeEmail = 'Reserva confirmada, pero no se pudo enviar el email de confirmación';
      }
      
    } else {
      console.log('⚠️  Usuario no tiene email registrado');
      mensajeEmail = 'Reserva confirmada, pero no se encontró email del usuario';
    }

    // Obtener reserva actualizada para la respuesta
    const { data: reservaActualizada } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', reservaId)
      .single();

    const responseData = {
      ...reservaActualizada,
      ludoteca: false,
      pistaNombre: reservaActualizada.pistas?.nombre,
      polideportivo_nombre: reservaActualizada.polideportivos?.nombre
    };

    if (emailEnviado) {
      res.json({
        success: true,
        message: '✅ Reserva confirmada y email enviado',
        data: responseData
      });
    } else {
      res.json({
        success: true,
        message: '✅ Reserva confirmada',
        data: responseData,
        warning: mensajeEmail
      });
    }

  } catch (error) {
    console.error('❌ Error en confirmar reserva:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// ========== RUTAS PÚBLICAS ==========

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
      logout: '/api/auth/logout'
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

// REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, correo, usuario, dni, telefono, pass, pass_2, clave_admin } = req.body;
    
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

    const rol = clave_admin === 'admin1234' ? 'admin' : 'user';

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

// ========== RUTAS DE DATOS BÁSICAS ==========

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

// RESERVAS - GET (PROTEGIDO)
app.get('/api/reservas', authenticateToken, async (req, res) => {
  try {
    const { usuario_id, fecha } = req.query;
    
    let query = supabase
      .from('reservas')
      .select(`
        *,
        pistas (*),
        polideportivos (*)
      `);

    // Si no es admin, solo ver sus propias reservas
    if (req.user.rol !== 'admin') {
      query = query.eq('usuario_id', req.user.id);
    } else if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    const { data, error } = await query.order('fecha', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo reservas'
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
  console.log(`🔑 Endpoints de autenticación:`);
  console.log(`   • Login seguro: POST /api/auth/login`);
  console.log(`   • Verificar: GET /api/auth/verify`);
  console.log(`   • Refrescar: POST /api/auth/refresh`);
  console.log(`   • Logout: POST /api/auth/logout`);
  console.log(`   • Login tradicional: POST /api/login`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Health: http://localhost:${PORT}/api/auth/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});