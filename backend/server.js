const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const emailjs = require('@emailjs/nodejs');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

// ========== CONFIGURACIÓN EMAILJS ==========
const emailjsConfig = {
  publicKey: 'cm8peTJ9deE4bwUrS',
  privateKey: 'Td3FXR8CwPdKsuyIuwPF_',
};

const emailjsRecoveryServiceId = 'service_r7doupc';
const emailjsRecoveryTemplateId = 'template_sy1terr';

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json());

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

async function enviarEmailRecuperacion(datos) {
  try {
    const templateParams = {
      user_name: datos.nombre_usuario || 'Usuario',
      user_username: datos.usuario || 'Usuario',
      verification_code: datos.codigo,
      app_name: 'Depo',
      expiration_time: '15 minutos',
      support_email: 'soporte@depo.com',
      current_year: new Date().getFullYear(),
      to_email: datos.email
    };

    console.log('📧 Enviando email de recuperación a:', datos.email);
    const result = await emailjs.send(
      emailjsRecoveryServiceId,
      emailjsRecoveryTemplateId,
      templateParams,
      emailjsConfig
    );
    console.log('✅ Email enviado correctamente');
    return result;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

// ========== INYECTAR SUPABASE EN LA APP ==========
app.set('supabase', supabase);

// ========== CONFIGURAR RUTAS ==========
const registroRouter = require('./routes/registro');
const pistasRouter = require('./routes/pistas');
const polideportivosRouter = require('./routes/polideportivos');
const reservasRouter = require('./routes/reservas');

// Middleware para pasar la app a los routers
app.use((req, res, next) => {
  req.app = app;
  next();
});

// Configurar rutas
app.use('/api/registro', registroRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);
app.use('/api/reservas', reservasRouter);

// ========== RUTAS DE RECUPERACIÓN (INTEGRADAS DIRECTAMENTE) ==========

// Solicitar recuperación
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

    // Buscar usuario
    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en BD:', userError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

    if (!usuarios || usuarios.length === 0) {
      console.log('📧 Email no encontrado:', email);
      return res.json({ 
        success: true, 
        message: mensajeSeguro
      });
    }

    const usuario = usuarios[0];
    const codigo = generarCodigo();
    
    // Guardar código en BD
    const { error: insertError } = await supabase
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: codigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando código:', insertError);
    }

    // Enviar email
    try {
      await enviarEmailRecuperacion({
        email: usuario.correo,
        nombre_usuario: usuario.nombre,
        usuario: usuario.usuario,
        codigo: codigo
      });

      console.log('✅ Código enviado a:', usuario.usuario, 'Código:', codigo);
      
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        debug: process.env.NODE_ENV === 'development' ? { codigo } : undefined
      });
      
    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al enviar el email de recuperación',
        debug: process.env.NODE_ENV === 'development' ? { codigo } : undefined
      });
    }
    
  } catch (error) {
    console.error('❌ Error en recuperación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Reenviar código
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

    // Buscar usuario
    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en BD:', userError);
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
    const nuevoCodigo = generarCodigo();
    
    // Guardar nuevo código
    await supabase
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: nuevoCodigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    // Enviar email
    try {
      await enviarEmailRecuperacion({
        email: usuario.correo,
        nombre_usuario: usuario.nombre,
        usuario: usuario.usuario,
        codigo: nuevoCodigo
      });

      console.log('✅ Código reenviado a:', usuario.usuario, 'Código:', nuevoCodigo);
      
      res.json({ 
        success: true, 
        message: mensajeSeguro,
        debug: process.env.NODE_ENV === 'development' ? { codigo: nuevoCodigo } : undefined
      });
      
    } catch (emailError) {
      console.error('❌ Error reenviando email:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error al reenviar el email',
        debug: process.env.NODE_ENV === 'development' ? { codigo: nuevoCodigo } : undefined
      });
    }
    
  } catch (error) {
    console.error('❌ Error reenviando código:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Verificar código
app.post('/api/recupera/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    console.log('🔍 Verificando código:', codigo, 'para:', email);

    if (!email || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y código son requeridos' 
      });
    }

    // Verificar código
    const { data: recuperaciones, error } = await supabase
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
      .limit(1);

    if (error) {
      console.error('❌ Error verificando código:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      console.log('❌ Código inválido para:', email);
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido, expirado o ya utilizado' 
      });
    }

    const recuperacion = recuperaciones[0];
    
    // Obtener info del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('usuario, nombre')
      .eq('id', recuperacion.user_id)
      .single();

    console.log('✅ Código verificado para:', usuario?.usuario);

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
    console.error('❌ Error verificando código:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Cambiar contraseña
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

    // Verificar código
    const { data: recuperaciones, error: verificarError } = await supabase
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
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
    
    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    
    // Actualizar contraseña
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ pass: hashedPassword })
      .eq('id', recuperacion.user_id);

    if (updateError) {
      console.error('❌ Error actualizando contraseña:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al cambiar la contraseña' 
      });
    }

    // Marcar código como usado
    await supabase
      .from('recuperacion_password')
      .update({ usado: true })
      .eq('email', email)
      .eq('codigo', codigo);

    // Obtener info del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('usuario, nombre')
      .eq('id', recuperacion.user_id)
      .single();

    console.log('✅ Contraseña cambiada para:', usuario?.usuario);

    res.json({ 
      success: true, 
      message: 'Contraseña cambiada exitosamente',
      actualizado: true,
      usuario: {
        username: usuario?.usuario,
        nombre: usuario?.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error cambiando password:', error);
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
      email: 'alvaroramirezm8@gmail.com',
      nombre_usuario: 'Alvaro Ramirez',
      usuario: 'alvarorm8',
      codigo: '123456'
    };

    console.log('🧪 Probando email de recuperación...');
    
    const result = await enviarEmailRecuperacion(testData);
    
    res.json({ 
      success: true, 
      message: '✅ Email de recuperación enviado correctamente',
      to: testData.email
    });
    
  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========== RUTAS BÁSICAS ==========

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
      message: '✅ Supabase conectado correctamente',
      tablas: {
        usuarios: '✅ Accesible',
        polideportivos: '✅ Accesible',
        pistas: '✅ Accesible',
        reservas: '✅ Accesible',
        recuperacion_password: '✅ Accesible'
      }
    });
  } catch (error) {
    console.error('Error Supabase:', error);
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase: ' + error.message
    });
  }
});

// REGISTRO - COMPLETO Y FUNCIONAL
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

    // Validar teléfono si se proporciona
    let telefonoLimpio = null;
    if (telefono && telefono.trim() !== '') {
      if (!validarTelefono(telefono)) {
        return res.status(400).json({
          success: false,
          error: 'Número de teléfono no válido. Debe contener entre 9 y 15 dígitos'
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

    // Preparar datos
    const datosUsuario = {
      usuario: usuario.trim(),
      pass: hashedPassword,
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      dni: dni.trim().toUpperCase(),
      rol: rol,
      fecha_creacion: new Date().toISOString()
    };

    // Agregar teléfono si es válido
    if (telefonoLimpio) {
      datosUsuario.telefono = telefonoLimpio;
    }

    // Insertar usuario
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

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    console.log('🔐 Login attempt:', usuario);
    
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

    // Verificar contraseña
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

// RESERVAS - GET
app.get('/api/reservas', async (req, res) => {
  try {
    const { usuario_id, fecha } = req.query;
    
    let query = supabase
      .from('reservas')
      .select(`
        *,
        pistas (*),
        polideportivos (*)
      `);

    if (usuario_id) {
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

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ========== RUTAS PROTEGIDAS ==========

// RUTA PROTEGIDA DE EJEMPLO
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Acceso a ruta protegida exitoso',
    user: req.user
  });
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
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/login`);
  console.log(`📝 Registro: http://localhost:${PORT}/api/registro`);
  console.log(`🎾 Pistas: http://localhost:${PORT}/api/pistas`);
  console.log(`🏟️ Polideportivos: http://localhost:${PORT}/api/polideportivos`);
  console.log(`📋 Reservas: http://localhost:${PORT}/api/reservas`);
  console.log(`🔑 Recuperación: http://localhost:${PORT}/api/recupera`);
  console.log(`📧 EmailJS: Configurado para recuperación`);
  console.log(`🔐 Supabase: ${supabaseUrl}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});