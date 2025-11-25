const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const CLAVE_ADMIN = 'admin1234';
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';

// Función para validar DNI
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

// Función para limpiar teléfono
function limpiarTelefono(telefono) {
  if (!telefono) return '';
  return telefono.toString().replace(/\D/g, '');
}

// Función para validar teléfono
function validarTelefono(telefono) {
  const telefonoLimpio = limpiarTelefono(telefono);
  return /^\d{9,15}$/.test(telefonoLimpio);
}

// Función para validar email
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// RUTA DE REGISTRO
router.post('/', async (req, res) => {
  try {
    // Obtener Supabase desde la app
    const supabase = req.app.get('supabase');
    
    if (!supabase) {
      return res.status(500).json({ 
        success: false,
        error: 'Error de configuración del servidor' 
      });
    }

    // ✅ RECIBIR LOS CAMPOS EXACTOS DEL FRONTEND
    const { 
      nombre, 
      correo, 
      usuario, 
      dni, 
      telefono, 
      pass, 
      pass_2, 
      clave_admin 
    } = req.body;

    console.log('📝 Datos recibidos en registro:', { 
      nombre, 
      correo, 
      usuario, 
      dni, 
      telefono: telefono || 'No proporcionado', 
      pass: pass ? '***' : 'FALTANTE', 
      pass_2: pass_2 ? '***' : 'FALTANTE', 
      clave_admin: clave_admin ? '***' : 'No proporcionada' 
    });

    // ========== VALIDACIONES ==========

    // Validar campos obligatorios
    if (!nombre || !correo || !usuario || !dni || !pass || !pass_2) {
      return res.status(400).json({ 
        success: false,
        error: 'Por favor, rellena todos los campos obligatorios' 
      });
    }

    // Validar formato de email
    if (!validarEmail(correo)) {
      return res.status(400).json({ 
        success: false,
        error: 'Formato de correo electrónico no válido' 
      });
    }

    // Validar DNI
    if (!validarDNI(dni)) {
      return res.status(400).json({ 
        success: false,
        error: 'DNI no válido. Formato correcto: 12345678X' 
      });
    }

    // Validar y limpiar teléfono (si se proporciona)
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

    // Validar contraseñas
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

    // Determinar rol
    const rol = (clave_admin === CLAVE_ADMIN) ? 'admin' : 'user';

    // ========== VERIFICAR DUPLICADOS ==========

    console.log('🔍 Verificando duplicados...');

    // Verificar usuario duplicado
    const { data: usuarioExistente, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('usuario')
      .eq('usuario', usuario)
      .limit(1);

    if (errorUsuario) {
      console.error('Error al verificar usuario:', errorUsuario);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar disponibilidad del usuario' 
      });
    }

    if (usuarioExistente && usuarioExistente.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El nombre de usuario ya está registrado' 
      });
    }

    // Verificar correo duplicado
    const { data: correoExistente, error: errorCorreo } = await supabase
      .from('usuarios')
      .select('correo')
      .eq('correo', correo)
      .limit(1);

    if (errorCorreo) {
      console.error('Error al verificar correo:', errorCorreo);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar disponibilidad del correo' 
      });
    }

    if (correoExistente && correoExistente.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El correo electrónico ya está registrado' 
      });
    }

    // Verificar DNI duplicado
    const { data: dniExistente, error: errorDNI } = await supabase
      .from('usuarios')
      .select('dni')
      .eq('dni', dni)
      .limit(1);

    if (errorDNI) {
      console.error('Error al verificar DNI:', errorDNI);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar disponibilidad del DNI' 
      });
    }

    if (dniExistente && dniExistente.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El DNI ya está registrado' 
      });
    }

    // ========== CREAR USUARIO ==========

    console.log('✅ No hay duplicados, creando usuario...');

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(pass, 10);
    
    // Preparar datos del usuario
    const datosUsuario = {
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      usuario: usuario.trim(),
      dni: dni.trim().toUpperCase(),
      password_hash: hashedPassword,
      rol: rol,
      fecha_creacion: new Date().toISOString()
    };
    
    // Solo agregar teléfono si se proporcionó y es válido
    if (telefonoLimpio) {
      datosUsuario.telefono = telefonoLimpio;
    }

    console.log('📦 Insertando usuario en base de datos:', {
      usuario: datosUsuario.usuario,
      correo: datosUsuario.correo,
      dni: datosUsuario.dni,
      rol: datosUsuario.rol,
      tieneTelefono: !!datosUsuario.telefono
    });

    // Insertar usuario en Supabase
    const { data: nuevoUsuario, error: errorInsercion } = await supabase
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

    if (errorInsercion) {
      console.error('❌ Error al insertar usuario en Supabase:', errorInsercion);
      
      // Manejar errores específicos de Supabase
      if (errorInsercion.code === '23505') {
        return res.status(400).json({ 
          success: false,
          error: 'El usuario, correo o DNI ya está registrado' 
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: 'Error al registrar el usuario en la base de datos: ' + errorInsercion.message 
      });
    }

    // ========== GENERAR TOKEN Y RESPUESTA ==========

    console.log('✅ Usuario creado exitosamente:', { 
      id: nuevoUsuario.id, 
      usuario: nuevoUsuario.usuario, 
      rol: nuevoUsuario.rol 
    });

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: nuevoUsuario.id, 
        usuario: nuevoUsuario.usuario,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.correo,
        rol: nuevoUsuario.rol
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Respuesta exitosa
    res.json({ 
      success: true,
      message: `Usuario registrado correctamente como ${rol}`,
      token: token,
      user: {
        id: nuevoUsuario.id,
        usuario: nuevoUsuario.usuario,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.correo,
        dni: nuevoUsuario.dni,
        telefono: nuevoUsuario.telefono,
        rol: nuevoUsuario.rol,
        fecha_creacion: nuevoUsuario.fecha_creacion
      }
    });

  } catch (error) {
    console.error('❌ Error general en el registro:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor al registrar el usuario: ' + error.message 
    });
  }
});

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Router de registro funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;