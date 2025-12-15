const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { usuario, pass } = req.body;

  // DEBUG: Ver qué llega
  console.log('🔐 Login attempt:', usuario);

  // Validación de campos
  if (!usuario || !pass) {
    return res.status(400).json({
      success: false,
      error: 'Por favor, rellena todos los campos'
    });
  }

  try {
    // Buscar el usuario en Supabase
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

    // DEBUG: Ver qué encontró
    console.log('✅ Usuario encontrado:', {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol,
      polideportivo_id: usuarioEncontrado.polideportivo_id
    });

    // Comparar la contraseña
    const coincide = await bcrypt.compare(pass, usuarioEncontrado.pass);

    if (!coincide) {
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
      polideportivo_id: usuarioEncontrado.polideportivo_id
    };

    // DEBUG: Ver payload del token
    console.log('📝 Payload del token:', payload);

    // Generar el token JWT
    const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h'
    });

    // Respuesta exitosa - INCLUYE TODOS LOS DATOS IMPORTANTES
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
        polideportivo_id: usuarioEncontrado.polideportivo_id
      },
      expiresIn: 24 * 60 * 60 // 24 horas en segundos
    };

    // DEBUG: Ver respuesta final
    console.log('✅ Login exitoso - Datos enviados:', {
      usuario: responseData.user.usuario,
      rol: responseData.user.rol,
      polideportivo_id: responseData.user.polideportivo_id
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

module.exports = router;