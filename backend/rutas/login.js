const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Ruta de login principal - ACEPTA AMBOS: "pass" O "password"
router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  
  // ACEPTAR AMBOS CAMPOS
  const { usuario } = req.body;
  const pass = req.body.pass || req.body.password;

  console.log('🔐 Login attempt:', usuario);

  if (!usuario || !pass) {
    console.log('❌ Campos vacíos recibidos');
    return res.status(400).json({
      success: false,
      error: 'Usuario y contraseña requeridos'
    });
  }

  try {
    // Buscar el usuario
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .limit(1);

    if (error) {
      console.error('Error en consulta Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }

    if (!usuarios || usuarios.length === 0) {
      console.log('❌ Usuario no encontrado:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    const usuarioEncontrado = usuarios[0];

    // Comparar contraseña
    const coincide = await bcrypt.compare(pass, usuarioEncontrado.pass);

    if (!coincide) {
      console.log('❌ Contraseña incorrecta para:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Datos para el token JWT
    const payload = {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol || 'usuario',
      nombre: usuarioEncontrado.nombre,
      correo: usuarioEncontrado.correo,
      dni: usuarioEncontrado.dni,
      telefono: usuarioEncontrado.telefono,
      polideportivo_id: usuarioEncontrado.polideportivo_id || null
    };

    // Generar el token JWT
    const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h'
    });

    // Respuesta exitosa
    const responseData = {
      success: true,
      message: 'Inicio de sesión exitoso',
      token: token,
      user: {
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.nombre,
        usuario: usuarioEncontrado.usuario,
        dni: usuarioEncontrado.dni,
        correo: usuarioEncontrado.correo,
        rol: usuarioEncontrado.rol || 'usuario',
        telefono: usuarioEncontrado.telefono,
        polideportivo_id: usuarioEncontrado.polideportivo_id || null,
        fecha_creacion: usuarioEncontrado.fecha_creacion
      }
    };

    console.log('✅ Login exitoso para:', usuarioEncontrado.usuario);
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error al procesar el login:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Ruta de salud
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de login funcionando',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;