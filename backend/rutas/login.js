const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Ruta de login principal - ACEPTA AMBOS CAMPOS: "pass" O "password"
router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  
  // ACEPTAR AMBOS CAMPOS PARA COMPATIBILIDAD
  const { usuario } = req.body;
  const pass = req.body.pass || req.body.password; // <-- CLAVE: Acepta ambos

  console.log('🔐 Login attempt:', usuario, 'Campo usado:', req.body.pass ? 'pass' : 'password');

  if (!usuario || !pass) {
    return res.status(400).json({
      success: false,
      error: 'Por favor, rellena todos los campos'
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

    // DEBUG: Mostrar información del usuario
    console.log('✅ Usuario encontrado en DB:', {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol || 'NO TIENE ROL EN DB',
      polideportivo_id: usuarioEncontrado.polideportivo_id || 'NO TIENE POLI_ID EN DB'
    });

    // Asegurar que el rol tenga valor
    if (!usuarioEncontrado.rol) {
      usuarioEncontrado.rol = 'usuario';
    }

    // Comparar contraseña
    console.log('🔐 Comparando contraseña...');
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
      rol: usuarioEncontrado.rol,
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
        rol: usuarioEncontrado.rol,
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

// Ruta de salud para verificar
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de login funcionando',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;