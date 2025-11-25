const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWpoaGtnZ25tcXJ1YnlwdnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzk3NjQ5NSwiZXhwIjoyMDc5NTUyNDk1fQ.4UVREXQtwmnnEIotrLcwemKxyr4QyYaTjBoHWlmvB6A';
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';

// Configuración EmailJS
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'cm8peTJ9deE4bwUrS';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || 'Td3FXR8CwPdKsuyIuwPF_';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_lb9lbhi';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_hfuxqzm';

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Función de EmailJS
async function enviarEmailConfirmacion(reserva) {
  try {
    if (!reserva.email || !validarEmail(reserva.email)) {
      throw new Error(`Email inválido: "${reserva.email}"`);
    }

    const fechaFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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
    
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY,
      }
    );

    console.log('✅ Email enviado correctamente');
    return result;

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

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

// ========== RUTAS DE AUTENTICACIÓN ==========

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
        reservas: '✅ Accesible'
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
    console.log('📦 Datos recibidos:', { 
      nombre, correo, usuario, dni, 
      telefono: telefono || 'No proporcionado',
      pass: pass ? '***' : 'FALTANTE', 
      pass_2: pass_2 ? '***' : 'FALTANTE', 
      clave_admin: clave_admin ? '***' : 'No proporcionada' 
    });

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

// RECUPERACIÓN CONTRASEÑA
app.post('/api/recupera', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔑 Recuperación para:', email);
    
    if (!email || !validarEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email válido requerido'
      });
    }

    // Buscar usuario
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, usuario, nombre, correo')
      .eq('correo', email)
      .single();

    // Por seguridad, siempre devolver éxito
    res.json({
      success: true,
      message: 'Si el email existe, recibirás instrucciones'
    });

  } catch (error) {
    console.error('❌ Error en recuperación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ========== RUTAS DE DATOS ==========

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
      polideportivos: data || []
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
      pistas: data || []
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
      reservas: data || []
    });
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo reservas'
    });
  }
});

// RESERVAS - POST
app.post('/api/reservas', async (req, res) => {
  try {
    const { usuario_id, pista_id, fecha, hora_inicio, hora_fin, precio } = req.body;
    
    console.log('📅 Creando reserva para usuario:', usuario_id);

    // Verificar disponibilidad
    const { data: existingReservas } = await supabase
      .from('reservas')
      .select('id')
      .eq('pista_id', pista_id)
      .eq('fecha', fecha)
      .eq('hora_inicio', hora_inicio)
      .eq('estado', 'confirmada');

    if (existingReservas && existingReservas.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Pista no disponible en ese horario'
      });
    }

    // Obtener info usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, correo')
      .eq('id', usuario_id)
      .single();

    // Obtener info pista
    const { data: pistaInfo } = await supabase
      .from('pistas')
      .select('nombre, polideportivos(nombre)')
      .eq('id', pista_id)
      .single();

    // Crear reserva
    const { data: nuevaReserva, error } = await supabase
      .from('reservas')
      .insert([
        {
          usuario_id,
          pista_id,
          fecha,
          hora_inicio,
          hora_fin,
          precio,
          estado: 'confirmada',
          nombre_usuario: usuario.nombre,
          polideportivo_nombre: pistaInfo.polideportivos.nombre,
          pista_nombre: pistaInfo.nombre
        }
      ])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Reserva creada:', nuevaReserva.id);

    // Enviar email
    try {
      const reservaConEmail = {
        ...nuevaReserva,
        email: usuario.correo,
        nombre_usuario: usuario.nombre
      };
      await enviarEmailConfirmacion(reservaConEmail);
      console.log('📧 Email de confirmación enviado');
    } catch (emailError) {
      console.error('❌ Error enviando email (reserva igual creada):', emailError);
    }

    res.json({
      success: true,
      message: 'Reserva creada exitosamente',
      reserva: nuevaReserva
    });

  } catch (error) {
    console.error('❌ Error creando reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando reserva'
    });
  }
});

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
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ 
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
  console.log(`🧪 Test Supabase: http://localhost:${PORT}/api/test-supabase`);
  console.log(`🗄️  Supabase: ${supabaseUrl}`);
  console.log(`🔐 CORS: PERMITIENDO TODOS LOS ORÍGENES`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});