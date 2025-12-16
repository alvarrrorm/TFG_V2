const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Ruta de login
router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { usuario, pass } = req.body;

  console.log('🔐 Login attempt:', usuario);

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
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    const usuarioEncontrado = usuarios[0];

    // DEBUG IMPORTANTE
    console.log('✅ Usuario encontrado en DB:', {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol || 'NO TIENE ROL EN DB',
      polideportivo_id: usuarioEncontrado.polideportivo_id || 'NO TIENE POLI_ID EN DB',
      tieneRol: !!usuarioEncontrado.rol,
      tienePolideportivo: !!usuarioEncontrado.polideportivo_id
    });

    // Verificar si la columna 'rol' existe y tiene valor
    if (!usuarioEncontrado.rol) {
      console.error('❌ CRÍTICO: Usuario no tiene rol en la base de datos');
      // Asignar rol por defecto
      usuarioEncontrado.rol = 'usuario';
    }

    // Verificar si es admin_poli pero no tiene polideportivo
    if (usuarioEncontrado.rol === 'admin_poli' && !usuarioEncontrado.polideportivo_id) {
      console.warn('⚠️ ADVERTENCIA: admin_poli sin polideportivo asignado');
    }

    // Comparar contraseña
    const coincide = await bcrypt.compare(pass, usuarioEncontrado.pass);

    if (!coincide) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Datos para el token JWT - Asegurar todos los campos
    const payload = {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol || 'usuario', // Asegurar que siempre tenga rol
      nombre: usuarioEncontrado.nombre,
      correo: usuarioEncontrado.correo,
      dni: usuarioEncontrado.dni,
      telefono: usuarioEncontrado.telefono,
      polideportivo_id: usuarioEncontrado.polideportivo_id || null
    };

    // DEBUG: Ver payload del token
    console.log('📝 Payload del token:', payload);

    // Generar el token JWT
    const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h'
    });

    // Respuesta exitosa - CON DATOS COMPLETOS Y VERIFICADOS
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
        rol: usuarioEncontrado.rol || 'usuario', // ← AQUÍ ES CLAVE
        telefono: usuarioEncontrado.telefono,
        polideportivo_id: usuarioEncontrado.polideportivo_id || null,
        fecha_creacion: usuarioEncontrado.fecha_creacion
      },
      expiresIn: 24 * 60 * 60
    };

    // DEBUG: Ver respuesta final
    console.log('✅ Login exitoso - Datos enviados al frontend:', {
      usuario: responseData.user.usuario,
      rol: responseData.user.rol,
      polideportivo_id: responseData.user.polideportivo_id,
      tieneRol: !!responseData.user.rol,
      tienePolideportivo: !!responseData.user.polideportivo_id
    });

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