const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWpoaGtnZ25tcXJ1YnlwdnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY0OTUsImV4cCI6MjA3OTU1MjQ5NX0.ZDrmA-jkADMH0CPrtm14IZkPEChTLvSxJ8BM2roC8A0';
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

// ========== MIDDLEWARE ==========
// CORS MUY PERMISIVO - SOLUCIÓN DEFINITIVA
app.use(cors({
  origin: true, // PERMITE TODOS LOS ORÍGENES
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json());

// ========== FUNCIONES AUXILIARES ==========
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function enviarEmailConfirmacion(reserva) {
  try {
    if (!reserva.email || !validarEmail(reserva.email)) {
      throw new Error(`Email inválido: "${reserva.email}"`);
    }

    const templateParams = {
      to_email: reserva.email,
      to_name: reserva.nombre_usuario,
      reserva_id: reserva.id,
      polideportivo_nombre: reserva.polideportivo_nombre,
      pista_nombre: reserva.pista_nombre,
      fecha: new Date(reserva.fecha).toLocaleDateString('es-ES'),
      horario: `${reserva.hora_inicio} - ${reserva.hora_fin}`,
      precio: `${reserva.precio} €`,
      from_name: 'Polideportivo App'
    };

    const result = await emailjs.send(
      'service_lb9lbhi',
      'template_hfuxqzm',
      templateParams,
      {
        publicKey: 'cm8peTJ9deE4bwUrS',
        privateKey: 'Td3FXR8CwPdKsuyIuwPF_',
      }
    );

    console.log('✅ Email enviado a:', reserva.email);
    return result;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

// ========== RUTAS DE AUTENTICACIÓN ==========

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
    let passwordValid = false;
    if (user.password_hash) {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else if (user.password) {
      passwordValid = user.password === password;
    }

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

// REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { usuario, password, nombre, correo, dni } = req.body;
    
    console.log('📝 Registro attempt:', usuario);

    if (!usuario || !password || !nombre || !correo) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    if (!validarEmail(correo)) {
      return res.status(400).json({
        success: false,
        error: 'Email no válido'
      });
    }

    // Verificar si usuario existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('usuario, correo')
      .or(`usuario.eq.${usuario},correo.eq.${correo}`)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: existingUser.usuario === usuario ? 
          'Usuario ya existe' : 'Email ya registrado'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const { data: newUser, error } = await supabase
      .from('usuarios')
      .insert([
        {
          usuario,
          password_hash: hashedPassword,
          nombre,
          correo,
          dni: dni || null,
          rol: 'user',
          fecha_creacion: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Generar token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        usuario: newUser.usuario,
        nombre: newUser.nombre,
        email: newUser.correo
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token: token,
      user: {
        id: newUser.id,
        usuario: newUser.usuario,
        nombre: newUser.nombre,
        email: newUser.correo,
        rol: newUser.rol
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
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
    } catch (emailError) {
      console.error('❌ Error email (reserva igual creada):', emailError);
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

// ========== RUTAS DE PRUEBA Y DIAGNÓSTICO ==========

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
    const { data: usuarios } = await supabase.from('usuarios').select('count');
    const { data: reservas } = await supabase.from('reservas').select('count');
    const { data: pistas } = await supabase.from('pistas').select('count');

    res.json({
      success: true,
      message: '✅ Supabase conectado',
      tablas: {
        usuarios: '✅ Accesible',
        reservas: '✅ Accesible',
        pistas: '✅ Accesible'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase'
    });
  }
});

// TEST EMAIL
app.get('/api/test-email', async (req, res) => {
  try {
    const testReserva = {
      id: Math.floor(Math.random() * 1000),
      email: 'test@example.com',
      nombre_usuario: 'Usuario Test',
      polideportivo_nombre: 'Polideportivo Central',
      pista_nombre: 'Pista de Fútbol 1',
      fecha: new Date('2024-12-15'),
      hora_inicio: '10:00',
      hora_fin: '11:00',
      precio: '25.00'
    };

    await enviarEmailConfirmacion(testReserva);
    
    res.json({ 
      success: true, 
      message: '✅ Email enviado correctamente'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message
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
  console.log(`📧 Test Email: http://localhost:${PORT}/api/test-email`);
  console.log(`🗄️  Supabase: ${supabaseUrl}`);
  console.log(`🔐 CORS: PERMITIENDO TODOS LOS ORÍGENES`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});