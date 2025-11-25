const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { usuario, pass } = req.body;

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

    // Comparar la contraseña (bcrypt.compare es async)
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
      rol: usuarioEncontrado.rol
    };

    // Generar el token JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'tu_clave_secreta', {
      expiresIn: '8h'
    });

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      userData: {
        nombre: usuarioEncontrado.nombre,
        usuario: usuarioEncontrado.usuario,
        dni: usuarioEncontrado.dni || '',
        rol: usuarioEncontrado.rol,
        correo: usuarioEncontrado.correo
      }
    });

  } catch (error) {
    console.error('Error al procesar el login:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;