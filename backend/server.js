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

// ========== CONFIGURACIÓN EMAILJS ==========
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

// ========== FUNCIONES DE AUTENTICACIÓN ==========
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

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========== INYECTAR FUNCIONES EN LA APP ==========
app.set('supabase', supabase);
app.set('ROLES', ROLES);
app.set('NIVELES_PERMISO', NIVELES_PERMISO);

// ========== REGISTRAR ROUTERS PRINCIPALES ==========
app.use('/api/reservas', reservasRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);
app.use('/api/usuarios', usuariosRouter.router); 
app.use('/api', loginRouter);


// ========== RUTA PARA CAMBIAR ROL DE USUARIOS ==========
app.put('/api/usuarios/cambiar-rol/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevoRol, passwordConfirmacion, polideportivo_id } = req.body;
    const usuarioAutenticado = req.user;

    console.log('👑 Cambiando rol del usuario:', {
      usuarioAutenticado: usuarioAutenticado.usuario,
      usuarioTarget: id,
      nuevoRol: nuevoRol,
      polideportivo_id: polideportivo_id
    });

    // Solo super_admin puede cambiar roles
    if (usuarioAutenticado.rol !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Solo los super administradores pueden cambiar roles'
      });
    }

    // Verificar que el usuario autenticado confirme su contraseña
    const { data: adminUser, error: adminError } = await supabase
      .from('usuarios')
      .select('pass')
      .eq('id', usuarioAutenticado.id)
      .single();

    if (adminError || !adminUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario administrador no encontrado'
      });
    }

    const passwordValid = await bcrypt.compare(passwordConfirmacion, adminUser.pass);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta'
      });
    }

    // Verificar que el usuario a modificar existe
    const { data: usuarioTarget, error: targetError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (targetError || !usuarioTarget) {
      return res.status(404).json({
        success: false,
        error: 'Usuario a modificar no encontrado'
      });
    }

    // Validar el nuevo rol
    const rolesValidos = [ROLES.SUPER_ADMIN, ROLES.ADMIN_POLIDEPORTIVO, ROLES.USUARIO];
    if (!rolesValidos.includes(nuevoRol)) {
      return res.status(400).json({
        success: false,
        error: 'Rol no válido. Roles permitidos: super_admin, admin_poli, usuario'
      });
    }

    // Preparar datos de actualización
    const updateData = {
      rol: nuevoRol,
      updated_at: new Date().toISOString()
    };

    // Si el nuevo rol es admin_poli, verificar que se proporciona polideportivo_id
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO) {
      if (!polideportivo_id) {
        return res.status(400).json({
          success: false,
          error: 'Para asignar rol admin_poli, se requiere un polideportivo_id'
        });
      }

      // Verificar que el polideportivo existe
      const { data: polideportivo, error: poliError } = await supabase
        .from('polideportivos')
        .select('id')
        .eq('id', polideportivo_id)
        .single();

      if (poliError || !polideportivo) {
        return res.status(404).json({
          success: false,
          error: 'Polideportivo no encontrado'
        });
      }

      updateData.polideportivo_id = polideportivo_id;
    } else {
      // Si no es admin_poli, quitar el polideportivo_id
      updateData.polideportivo_id = null;
    }

    // Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select('id, usuario, nombre, correo, dni, telefono, rol, polideportivo_id, fecha_creacion')
      .single();

    if (updateError) {
      console.error('❌ Error actualizando usuario:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar el rol del usuario: ' + updateError.message
      });
    }

    console.log('✅ Rol actualizado exitosamente:', {
      usuario: usuarioActualizado.usuario,
      nuevoRol: usuarioActualizado.rol,
      polideportivo_id: usuarioActualizado.polideportivo_id
    });

    res.json({
      success: true,
      message: `Rol actualizado correctamente a ${nuevoRol}`,
      data: usuarioActualizado
    });

  } catch (error) {
    console.error('❌ Error cambiando rol:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// ========== RUTA PARA OBTENER USUARIOS ==========
app.get('/api/usuarios', authenticateToken, async (req, res) => {
  try {
    const usuarioAutenticado = req.user;

    console.log('👥 Obteniendo usuarios, usuario autenticado:', usuarioAutenticado.rol);

    // Solo super_admin puede ver todos los usuarios
    if (usuarioAutenticado.rol !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Solo los super administradores pueden ver todos los usuarios'
      });
    }

    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nombre,
        usuario,
        correo,
        dni,
        telefono,
        rol,
        polideportivo_id,
        fecha_creacion
      `)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener usuarios: ' + error.message
      });
    }

    console.log(`✅ ${usuarios.length} usuarios obtenidos`);

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

// ========== RUTAS DE AUTENTICACIÓN SEGURA ==========

// Login seguro
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

    // Preparar datos del usuario
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

    // Generar token de acceso
    const accessToken = jwt.sign(
      { 
        ...userData,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

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

// Verificar autenticación
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  console.log('✅ Autenticación verificada para usuario:', req.user?.id);
  res.json({
    success: true,
    message: 'Autenticación válida',
    user: req.user,
    valid: true
  });
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
      usuarios: '/api/usuarios/*',
      reservas: '/api/reservas/*',
      polideportivos: '/api/polideportivos',
      pistas: '/api/pistas',
      registro: '/api/registro'
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

// POLIDEPORTIVOS (público)
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

// REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, correo, usuario, dni, telefono, pass, pass_2 } = req.body;
    
    console.log('📝 Registro attempt:', usuario);

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

    if (telefono && telefono.trim() !== '') {
      datosUsuario.telefono = telefono.trim();
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
  console.log(`🔐 Sistema de autenticación ACTIVADO`);
  console.log(`🔑 Sistema de roles jerárquicos ACTIVADO`);
  console.log(`   • ${ROLES.SUPER_ADMIN} (nivel ${NIVELES_PERMISO[ROLES.SUPER_ADMIN]})`);
  console.log(`   • ${ROLES.ADMIN_POLIDEPORTIVO} (nivel ${NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]})`);
  console.log(`   • ${ROLES.ADMIN} (nivel ${NIVELES_PERMISO[ROLES.ADMIN]})`);
  console.log(`   • ${ROLES.USUARIO} (nivel ${NIVELES_PERMISO[ROLES.USUARIO]})`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
});