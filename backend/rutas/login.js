const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// ✅ Ruta de login principal - COMPATIBLE CON AMBOS CAMPOS
router.post('/login', async (req, res) => {
  const supabase = req.app.get('supabase');
  
  // ✅ ACEPTAR AMBOS FORMATOS PARA COMPATIBILIDAD
  const { usuario } = req.body;
  const pass = req.body.pass || req.body.password; // Acepta ambos
  
  console.log('🔐 Login attempt (router):', usuario, 'Campo password recibido:', 
    req.body.pass ? 'pass' : (req.body.password ? 'password' : 'ninguno'));

  // Validación
  if (!usuario || !pass) {
    console.log('❌ Faltan datos:', { usuario: !!usuario, password: !!pass });
    return res.status(400).json({
      success: false,
      error: 'Usuario y contraseña requeridos',
      received: {
        usuario: usuario,
        hasPass: !!req.body.pass,
        hasPassword: !!req.body.password
      }
    });
  }

  try {
    // Buscar el usuario
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario.trim())
      .limit(1);

    if (error) {
      console.error('❌ Error en consulta Supabase:', error);
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

    console.log('✅ Usuario encontrado en DB:', {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol || 'NO TIENE ROL',
      polideportivo_id: usuarioEncontrado.polideportivo_id || 'NO TIENE POLI_ID'
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

    // ✅ Datos para el token JWT - INCLUYE POLIDEPORTIVO_ID
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

    // ✅ Respuesta exitosa - INCLUYE POLIDEPORTIVO_ID
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
    console.log('📤 Enviando respuesta:', {
      userId: usuarioEncontrado.id,
      rol: usuarioEncontrado.rol,
      polideportivo_id: usuarioEncontrado.polideportivo_id
    });
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error al procesar el login:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// Ruta de salud para verificar
router.get('/login/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de login funcionando',
    timestamp: new Date().toISOString(),
    accepts: ['pass', 'password'],
    note: 'El campo de contraseña puede enviarse como "pass" o "password"'
  });
});

module.exports = router;