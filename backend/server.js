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

// Almacenamiento de refresh tokens
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
const loginRouter = require('./rutas/login');

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    'https://www.deppo.es',
    'https://deppo.es',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Authorization']
}));
app.options('*', cors());
app.use(express.json());

// ========== FUNCIÓN PARA MANEJAR COOKIES ==========
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

const setCookie = (res, name, value, options = {}) => {
  let cookie = `${name}=${encodeURIComponent(value)};`;
  if (options.httpOnly) cookie += ' HttpOnly;';
  if (options.secure) cookie += ' Secure;';
  if (options.sameSite) cookie += ` SameSite=${options.sameSite};`;
  if (options.maxAge) cookie += ` Max-Age=${options.maxAge};`;
  if (options.path) cookie += ` Path=${options.path || '/'};`;
  res.setHeader('Set-Cookie', cookie);
};

const clearCookie = (res, name) => {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/`);
};

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
const authenticateToken = (req, res, next) => {
  console.log('🔐 Middleware authenticateToken ejecutándose');
  
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const cookies = parseCookies(req);
  const tokenFromCookie = cookies.auth_token;
  const tokenFromQuery = req.query?.token;

  const token = tokenFromHeader || tokenFromCookie || tokenFromQuery;

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
  if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado' });
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
  if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado' });
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
  if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado' });
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
      { publicKey: emailjsPublicKey, privateKey: emailjsPrivateKey }
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
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
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
      { publicKey: emailjsPublicKey, privateKey: emailjsPrivateKey }
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
    console.log('✅ Usuario encontrado:', { id: usuario.id, nombre: usuario.nombre, email: usuario.correo });
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

// ========== REGISTRAR ROUTERS ==========
app.use('/api/reservas', reservasRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);
app.use('/api', loginRouter);

// ========== ✅ RUTAS DE USUARIOS INTEGRADAS DIRECTAMENTE (NO ROUTER) ==========

// Ruta para obtener todos los usuarios (solo super_admin)
app.get('/api/usuarios', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    console.log('📋 [USUARIOS] Obteniendo todos los usuarios (super_admin)...');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id, 
        dni, 
        nombre, 
        correo, 
        usuario, 
        rol, 
        telefono, 
        fecha_creacion, 
        fecha_actualizacion,
        polideportivo_id,
        polideportivos (id, nombre, direccion)
      `)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('❌ [USUARIOS] Error obteniendo usuarios:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener usuarios: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Obtenidos ${usuarios?.length || 0} usuarios`);
    
    res.json({ 
      success: true, 
      data: usuarios || [] 
    });
  } catch (error) {
    console.error('❌ [USUARIOS] Error en GET /api/usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Ruta para cambiar rol de usuario (solo super_admin)
app.put('/api/usuarios/cambiar-rol/:id', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevoRol, passwordConfirmacion, polideportivo_id } = req.body;
    
    console.log(`👑 [USUARIOS] Cambiando rol del usuario ${id} a ${nuevoRol}...`);

    // Validaciones
    if (!nuevoRol || !passwordConfirmacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos: nuevoRol y passwordConfirmacion son obligatorios' 
      });
    }

    // Validar rol permitido
    const rolesPermitidos = Object.values(ROLES);
    if (!rolesPermitidos.includes(nuevoRol)) {
      return res.status(400).json({ 
        success: false, 
        error: `Rol no válido. Debe ser: ${rolesPermitidos.join(', ')}` 
      });
    }

    // Si es admin_poli, validar polideportivo
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO) {
      if (!polideportivo_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Para asignar admin_poli se requiere polideportivo_id' 
        });
      }
      
      // Verificar que el polideportivo existe
      const { data: poliExistente, error: poliError } = await supabase
        .from('polideportivos')
        .select('id, nombre')
        .eq('id', polideportivo_id)
        .single();
        
      if (poliError || !poliExistente) {
        return res.status(404).json({ 
          success: false, 
          error: 'Polideportivo no encontrado' 
        });
      }
    }

    const adminId = req.user.id;

    // 1. Verificar contraseña del super admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('pass')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }

    const passwordValida = await bcrypt.compare(passwordConfirmacion, adminData.pass);
    if (!passwordValida) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña incorrecta. No tienes permisos para realizar esta acción.' 
      });
    }

    // 2. Verificar que el usuario existe
    const { data: usuarioExistente, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, rol, usuario, nombre')
      .eq('id', id)
      .single();

    if (usuarioError || !usuarioExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // 3. No permitir modificar a otro super admin
    if (usuarioExistente.rol === ROLES.SUPER_ADMIN && id !== adminId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'No puedes modificar a otro super administrador' 
      });
    }

    // 4. No permitir que un super admin se quite a sí mismo los privilegios
    if (parseInt(id) === adminId && nuevoRol !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ 
        success: false, 
        error: 'No puedes quitarte a ti mismo los privilegios de super administrador' 
      });
    }

    // 5. Preparar datos para actualizar
    const updateData = {
      rol: nuevoRol,
      fecha_actualizacion: new Date().toISOString()
    };

    // Asignar/remover polideportivo_id según el rol
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO) {
      updateData.polideportivo_id = polideportivo_id;
    } else {
      updateData.polideportivo_id = null;
    }

    // 6. Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, fecha_actualizacion, polideportivo_id,
        polideportivos (id, nombre, direccion)
      `)
      .single();

    if (updateError) {
      console.error('❌ [USUARIOS] Error actualizando usuario:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar usuario: ' + updateError.message 
      });
    }

    // 7. Registrar acción
    console.log(`✅ [USUARIOS] Usuario ${usuarioExistente.usuario} (${usuarioExistente.nombre}) cambiado a rol ${nuevoRol} por super_admin ${adminId}`);

    res.json({ 
      success: true,
      message: `Rol actualizado a ${nuevoRol}${nuevoRol === ROLES.ADMIN_POLIDEPORTIVO ? ` para polideportivo ${polideportivo_id}` : ''}`,
      data: usuarioActualizado
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en PUT /api/usuarios/cambiar-rol:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Ruta para crear nuevo usuario (solo super_admin)
app.post('/api/usuarios', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    const { dni, nombre, correo, usuario, telefono, pass, rol, polideportivo_id } = req.body;

    console.log(`👤 [USUARIOS] Creando nuevo usuario: ${usuario}`);

    // Validaciones básicas
    if (!dni || !nombre || !correo || !usuario || !pass || !rol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios' 
      });
    }

    // Validar rol
    if (!Object.values(ROLES).includes(rol)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rol no válido' 
      });
    }

    // Si es admin_poli, validar polideportivo
    if (rol === ROLES.ADMIN_POLIDEPORTIVO && !polideportivo_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Para rol admin_poli se requiere polideportivo_id' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(pass, 10);

    const datosUsuario = {
      dni,
      nombre,
      correo: correo.toLowerCase(),
      usuario,
      pass: hashedPassword,
      rol,
      fecha_creacion: new Date().toISOString()
    };

    if (telefono) {
      datosUsuario.telefono = telefono;
    }

    if (rol === ROLES.ADMIN_POLIDEPORTIVO) {
      datosUsuario.polideportivo_id = polideportivo_id;
    }

    const { data: nuevoUsuario, error } = await supabase
      .from('usuarios')
      .insert([datosUsuario])
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, polideportivo_id,
        polideportivos (id, nombre)
      `)
      .single();

    if (error) {
      console.error('❌ [USUARIOS] Error creando usuario:', error);
      
      // Manejar errores de duplicados
      if (error.code === '23505') {
        const field = error.message.includes('dni') ? 'DNI' : 
                     error.message.includes('correo') ? 'correo' : 
                     error.message.includes('usuario') ? 'usuario' : 'campo único';
        return res.status(400).json({ 
          success: false, 
          error: `El ${field} ya está registrado` 
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: 'Error al crear usuario: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Usuario creado exitosamente: ${nuevoUsuario.usuario}`);

    res.status(201).json({ 
      success: true, 
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en POST /api/usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Ruta para eliminar usuario (solo super_admin)
app.delete('/api/usuarios/:id', authenticateToken, verificarEsSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ [USUARIOS] Eliminando usuario ID: ${id}`);

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [USUARIOS] Error eliminando usuario:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar usuario: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Usuario ${id} eliminado exitosamente`);

    res.json({ 
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en DELETE /api/usuarios/:id:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Health check de usuarios
app.get('/api/usuarios/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API de usuarios funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      obtenerUsuarios: 'GET /api/usuarios',
      cambiarRol: 'PUT /api/usuarios/cambiar-rol/:id',
      crearUsuario: 'POST /api/usuarios',
      eliminarUsuario: 'DELETE /api/usuarios/:id'
    }
  });
});

// ========== RUTAS DE AUTENTICACIÓN ==========
app.get('/api/auth/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sistema de autenticación funcionando',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    console.log('🔐 Login seguro para:', usuario);
    if (!usuario || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }

    const passwordValid = await bcrypt.compare(password, user.pass);
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }

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

    const accessToken = jwt.sign({ ...userData, type: 'access' }, JWT_SECRET, { expiresIn: '24h' });
    const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    refreshTokens.set(user.id.toString(), refreshToken);

    setCookie(res, 'auth_token', accessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000, path: '/'
    });

    setCookie(res, 'refresh_token', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/'
    });

    console.log('✅ Login seguro exitoso para:', usuario);
    res.json({
      success: true, message: 'Login exitoso', token: accessToken,
      user: userData, expiresIn: 24 * 60 * 60
    });
  } catch (error) {
    console.error('❌ Error en login seguro:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  console.log('✅ Autenticación verificada para usuario:', req.user?.id);
  res.json({ success: true, message: 'Autenticación válida', user: req.user, valid: true });
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const cookies = parseCookies(req);
    const refreshToken = cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Token de refresco requerido' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ success: false, error: 'Token de refresco inválido' });
      const storedToken = refreshTokens.get(decoded.id.toString());
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(403).json({ success: false, error: 'Token de refresco no válido' });
      }

      const { data: user, error } = await supabase
        .from('usuarios')
        .select('id, usuario, nombre, correo, dni, rol, telefono, polideportivo_id')
        .eq('id', decoded.id)
        .single();

      if (error || !user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      const newAccessToken = jwt.sign({ ...user, type: 'access' }, JWT_SECRET, { expiresIn: '24h' });

      setCookie(res, 'auth_token', newAccessToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000, path: '/'
      });

      res.json({ success: true, token: newAccessToken, user: user, expiresIn: 24 * 60 * 60 });
    });
  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    refreshTokens.delete(req.user.id.toString());
    clearCookie(res, 'auth_token');
    clearCookie(res, 'refresh_token');
    res.json({ success: true, message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
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

app.post('/api/recupera/solicitar-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔐 Solicitud de recuperación para:', email);
    if (!email || !validarEmail(email)) {
      return res.status(400).json({ success: false, error: 'Por favor, proporciona un email válido' });
    }

    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario, dni, telefono')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }

    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';
    if (!usuarios || usuarios.length === 0) {
      console.log('📧 Email no encontrado (por seguridad):', email);
      return res.json({ success: true, message: mensajeSeguro });
    }

    const usuario = usuarios[0];
    const codigo = generarCodigo();
    const { error: insertError } = await supabase
      .from('recuperacion_password')
      .insert([{
        email: email, codigo: codigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user_id: usuario.id, user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando código:', insertError);
      return res.status(500).json({ success: false, error: 'Error al generar código de recuperación' });
    }

    try {
      const datosEmail = { email: usuario.correo, nombre_usuario: usuario.nombre, usuario: usuario.usuario, codigo: codigo };
      console.log('👤 USUARIO SOLICITANDO RECUPERACIÓN:', {
        id: usuario.id, nombre: usuario.nombre, usuario: usuario.usuario,
        email: usuario.correo, dni: usuario.dni ? `${usuario.dni.substring(0,3)}...` : 'No disponible',
        telefono: usuario.telefono || 'No disponible', timestamp: new Date().toISOString()
      });

      await enviarEmailRecuperacion(datosEmail);
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        debug: process.env.NODE_ENV === 'development' ? { usuario: usuario.usuario, nombre: usuario.nombre, codigo: codigo } : undefined
      });
    } catch (emailError) {
      console.error('❌ Error enviando email de recuperación:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al enviar el email de recuperación',
        debug: process.env.NODE_ENV === 'development' ? { codigo: codigo, usuario: usuario.usuario } : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error en solicitar-recuperacion:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/recupera/reenviar-codigo', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔄 Reenviando código para:', email);
    if (!email || !validarEmail(email)) {
      return res.status(400).json({ success: false, error: 'Por favor, proporciona un email válido' });
    }

    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }

    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';
    if (!usuarios || usuarios.length === 0) {
      return res.json({ success: true, message: mensajeSeguro });
    }

    const usuario = usuarios[0];
    const nuevoCodigo = generarCodigo();
    const { error: insertError } = await supabase
      .from('recuperacion_password')
      .insert([{
        email: email, codigo: nuevoCodigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user_id: usuario.id, user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando nuevo código:', insertError);
      return res.status(500).json({ success: false, error: 'Error al reenviar el código' });
    }

    try {
      const datosEmail = { email: usuario.correo, nombre_usuario: usuario.nombre, usuario: usuario.usuario, codigo: nuevoCodigo };
      console.log('🔄 REENVIO DE CÓDIGO PARA:', { usuario: usuario.usuario, email: usuario.correo, nuevo_codigo: nuevoCodigo });
      await enviarEmailRecuperacion(datosEmail);
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        debug: process.env.NODE_ENV === 'development' ? { usuario: usuario.usuario, codigo: nuevoCodigo } : undefined
      });
    } catch (emailError) {
      console.error('❌ Error reenviando email de recuperación:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al reenviar el email de recuperación',
        debug: process.env.NODE_ENV === 'development' ? { codigo: nuevoCodigo, usuario: usuario.usuario } : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error en reenviar-codigo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/recupera/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    console.log('🔍 Verificando código para:', email, 'Código:', codigo);
    if (!email || !codigo) {
      return res.status(400).json({ success: false, error: 'Email y código son requeridos' });
    }

    const { data: recuperaciones, error } = await supabase
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
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      console.log('❌ Código no válido para:', email);
      return res.status(400).json({ success: false, error: 'Código inválido, expirado o ya utilizado' });
    }

    const recuperacion = recuperaciones[0];
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('usuario, nombre')
      .eq('id', recuperacion.user_id)
      .single();

    console.log('✅ Código verificado para usuario:', { usuario: usuario?.usuario, nombre: usuario?.nombre, email: recuperacion.email });
    res.json({ 
      success: true, 
      message: 'Código verificado correctamente',
      valido: true,
      usuario: { username: usuario?.usuario, nombre: usuario?.nombre }
    });
  } catch (error) {
    console.error('❌ Error en verificar-codigo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/recupera/cambiar-password', async (req, res) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    console.log('🔄 Cambiando password para:', email);
    if (!email || !codigo || !nuevaPassword) {
      return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
    }
    if (nuevaPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const { data: recuperaciones, error: verificarError } = await supabase
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
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    if (!recuperaciones || recuperaciones.length === 0) {
      return res.status(400).json({ success: false, error: 'Código inválido o expirado' });
    }

    const recuperacion = recuperaciones[0];
    const userId = recuperacion.user_id;
    try {
      const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
      console.log('🔐 Contraseña encriptada correctamente para user_id:', userId);
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ pass: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Error actualizando contraseña:', updateError);
        return res.status(500).json({ success: false, error: 'Error al cambiar la contraseña' });
      }

      await supabase
        .from('recuperacion_password')
        .update({ usado: true })
        .eq('email', email)
        .eq('codigo', codigo);

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('usuario, nombre')
        .eq('id', userId)
        .single();

      console.log('✅ CONTRASEÑA CAMBIADA EXITOSAMENTE:', {
        usuario: usuario?.usuario, nombre: usuario?.nombre, email: email,
        user_id: userId, timestamp: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        message: 'Contraseña cambiada exitosamente',
        actualizado: true,
        usuario: { username: usuario?.usuario, nombre: usuario?.nombre }
      });
    } catch (encryptionError) {
      console.error('❌ Error encriptando contraseña:', encryptionError);
      return res.status(500).json({ success: false, error: 'Error al procesar la contraseña' });
    }
  } catch (error) {
    console.error('❌ Error en cambiar-password:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

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
      to: testData.email, result: result
    });
  } catch (error) {
    console.error('❌ Error en test de recuperación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RUTAS ADMIN_POLI ==========
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
      return res.status(404).json({ success: false, error: 'Polideportivo no encontrado' });
    }
    res.json({ success: true, data: polideportivo });
  } catch (error) {
    console.error('❌ Error obteniendo polideportivo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.get('/api/admin-poli/reservas', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { polideportivo_id } = req.user;
    const { fecha, estado, nombre_usuario, usuario_id } = req.query;
    console.log('📋 Obteniendo reservas del polideportivo (admin_poli):', polideportivo_id);
    
    let query = supabase
      .from('reservas')
      .select(`*, pistas!inner(nombre, tipo), polideportivos!inner(nombre)`)
      .eq('polideportivo_id', polideportivo_id)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });
    
    if (fecha) query = query.eq('fecha', fecha);
    if (estado) query = query.eq('estado', estado);
    if (usuario_id && usuario_id !== '0') query = query.eq('usuario_id', usuario_id);
    else if (nombre_usuario) query = query.ilike('nombre_usuario', `%${nombre_usuario}%`);
    
    const { data: reservas, error } = await query;
    if (error) {
      console.error('❌ Error obteniendo reservas:', error);
      return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    }
    
    const reservasConInfo = await Promise.all((reservas || []).map(async (reserva) => {
      let usuarioInfo = { usuario_login: 'N/A', usuario_email: 'N/A', usuario_telefono: 'N/A' };
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
    
    res.json({ success: true, data: reservasConInfo || [] });
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.put('/api/admin-poli/reservas/:id/confirmar', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    console.log('✅ Confirmando reserva ID:', id, 'para polideportivo:', polideportivo_id);
    
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (reservaError || !reserva) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada o no tienes permisos' });
    }
    if (reserva.estado !== 'pendiente') {
      return res.status(400).json({ success: false, error: 'La reserva ya ha sido confirmada o cancelada' });
    }
    
    const { data: reservaActualizada, error: updateError } = await supabase
      .from('reservas')
      .update({ estado: 'confirmada', fecha_confirmacion: new Date().toISOString() })
      .eq('id', id)
      .select(`*, pistas!inner(nombre), polideportivos!inner(nombre)`)
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ success: false, error: 'Error al confirmar la reserva' });
    }
    
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
      if (datosEmail.email) await enviarEmailConfirmacionReserva(datosEmail);
    } catch (emailError) {
      console.error('⚠️  Error enviando email:', emailError);
    }
    
    res.json({ success: true, message: 'Reserva confirmada correctamente', data: reservaActualizada });
  } catch (error) {
    console.error('❌ Error confirmando reserva:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.put('/api/admin-poli/reservas/:id/cancelar', authenticateToken, verificarEsAdminPoli, async (req, res) => {
  try {
    const { id } = req.params;
    const { polideportivo_id } = req.user;
    console.log('❌ Cancelando reserva ID:', id, 'para polideportivo:', polideportivo_id);
    
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .eq('polideportivo_id', polideportivo_id)
      .single();
    
    if (reservaError || !reserva) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada o no tienes permisos' });
    }
    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ success: false, error: 'La reserva ya está cancelada' });
    }
    
    const { data: reservaActualizada, error: updateError } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada', fecha_cancelacion: new Date().toISOString() })
      .eq('id', id)
      .select(`*, pistas!inner(nombre)`)
      .single();
    
    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ success: false, error: 'Error al cancelar la reserva' });
    }
    
    res.json({ success: true, message: 'Reserva cancelada correctamente', data: reservaActualizada });
  } catch (error) {
    console.error('❌ Error cancelando reserva:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ========== RUTAS ADMIN ==========
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
    secureAuth: true,
    endpoints: {
      auth: '/api/auth/*',
      login: '/api/login',
      usuarios: '/api/usuarios/*',
      reservas: '/api/reservas/*',
      polideportivos: '/api/polideportivos',
      pistas: '/api/pistas',
      registro: '/api/registro',
      recuperacion: '/api/recupera/*',
      admin: '/api/admin/*',
      adminPoli: '/api/admin-poli/*'
    }
  });
});

app.get('/api/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.from('usuarios').select('count').limit(1);
    if (error) throw error;
    res.json({ success: true, message: '✅ Supabase conectado correctamente' });
  } catch (error) {
    console.error('Error Supabase:', error);
    res.status(500).json({ success: false, error: 'Error conectando a Supabase: ' + error.message });
  }
});

app.get('/api/polideportivos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('polideportivos').select('*').order('nombre');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo polideportivos' });
  }
});

app.get('/api/pistas', async (req, res) => {
  try {
    const { polideportivo_id } = req.query;
    let query = supabase.from('pistas').select('*');
    if (polideportivo_id) query = query.eq('polideportivo_id', polideportivo_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo pistas' });
  }
});

app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, correo, usuario, dni, telefono, pass, pass_2 } = req.body;
    console.log('📝 Registro attempt:', usuario);

    if (!nombre || !correo || !usuario || !dni || !pass || !pass_2) {
      return res.status(400).json({ success: false, error: 'Por favor, rellena todos los campos obligatorios' });
    }
    if (!validarEmail(correo)) return res.status(400).json({ success: false, error: 'Email no válido' });
    if (!validarDNI(dni)) return res.status(400).json({ success: false, error: 'DNI no válido. Formato correcto: 12345678X' });

    let telefonoLimpio = null;
    if (telefono && telefono.trim() !== '') {
      if (!validarTelefono(telefono)) return res.status(400).json({ success: false, error: 'Número de teléfono no válido' });
      telefonoLimpio = limpiarTelefono(telefono);
    }

    if (pass !== pass_2) return res.status(400).json({ success: false, error: 'Las contraseñas no coinciden' });
    if (pass.length < 6) return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });

    const rol = ROLES.USUARIO;
    const { data: existingUsers, error: errorCheck } = await supabase
      .from('usuarios')
      .select('usuario, correo, dni')
      .or(`usuario.eq.${usuario},correo.eq.${correo},dni.eq.${dni}`);

    if (errorCheck) {
      console.error('Error verificando duplicados:', errorCheck);
      return res.status(500).json({ success: false, error: 'Error al verificar disponibilidad' });
    }

    if (existingUsers && existingUsers.length > 0) {
      const userExists = existingUsers.find(u => u.usuario === usuario);
      const emailExists = existingUsers.find(u => u.correo === correo);
      const dniExists = existingUsers.find(u => u.dni === dni);
      if (userExists) return res.status(400).json({ success: false, error: 'El nombre de usuario ya está registrado' });
      if (emailExists) return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado' });
      if (dniExists) return res.status(400).json({ success: false, error: 'El DNI ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    const datosUsuario = {
      usuario: usuario.trim(), pass: hashedPassword, nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(), dni: dni.trim().toUpperCase(),
      rol: rol, fecha_creacion: new Date().toISOString()
    };

    if (telefonoLimpio) datosUsuario.telefono = telefonoLimpio;

    const { data: newUser, error: errorInsert } = await supabase
      .from('usuarios')
      .insert([datosUsuario])
      .select(`id, nombre, correo, usuario, dni, telefono, rol, fecha_creacion`)
      .single();

    if (errorInsert) {
      console.error('❌ Error al insertar usuario:', errorInsert);
      return res.status(500).json({ success: false, error: 'Error al registrar el usuario: ' + errorInsert.message });
    }

    const token = jwt.sign(
      { id: newUser.id, usuario: newUser.usuario, nombre: newUser.nombre, email: newUser.correo, rol: newUser.rol },
      JWT_SECRET, { expiresIn: '24h' }
    );

    console.log('✅ Usuario registrado exitosamente:', newUser.usuario);
    res.json({
      success: true, message: `Usuario registrado correctamente como ${rol}`, token: token,
      user: { id: newUser.id, usuario: newUser.usuario, nombre: newUser.nombre, email: newUser.correo,
        dni: newUser.dni, telefono: newUser.telefono, rol: newUser.rol }
    });
  } catch (error) {
    console.error('❌ Error general en registro:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor: ' + error.message });
  }
});

// ========== MANEJO DE ERRORES ==========
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ 
    success: false, error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : err.message
  });
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend ejecutándose en puerto ${PORT}`);
  console.log(`🔐 Sistema de autenticación segura ACTIVADO`);
  console.log(`🌐 Supabase: ${supabaseUrl}`);
  console.log(`🔑 Sistema de roles jerárquicos ACTIVADO`);
  console.log(`   • ${ROLES.SUPER_ADMIN} (nivel ${NIVELES_PERMISO[ROLES.SUPER_ADMIN]})`);
  console.log(`   • ${ROLES.ADMIN_POLIDEPORTIVO} (nivel ${NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]})`);
  console.log(`   • ${ROLES.ADMIN} (nivel ${NIVELES_PERMISO[ROLES.ADMIN]})`);
  console.log(`   • ${ROLES.USUARIO} (nivel ${NIVELES_PERMISO[ROLES.USUARIO]})`);
  console.log(`🔑 Endpoints principales:`);
  console.log(`   • Auth: /api/auth/login, /api/auth/verify`);
  console.log(`   • Usuarios: /api/usuarios/* (con autenticación)`);
  console.log(`   • Reservas: /api/reservas/*`);
  console.log(`   • Polideportivos: /api/polideportivos`);
  console.log(`   • Pistas: /api/pistas`);
  console.log(`   • Registro: /api/registro`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});