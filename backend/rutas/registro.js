const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const CLAVE_ADMIN = 'admin1234';

function validarDNI(dni) {
  // Limpiar y formatear el DNI
  const dniLimpio = dni.toString().trim().toUpperCase();
  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const dniRegex = /^(\d{8})([A-Z])$/i;

  const match = dniLimpio.match(dniRegex);
  if (!match) return false;

  const numero = parseInt(match[1], 10);
  const letra = match[2].toUpperCase();
  const letraCalculada = letras[numero % 23];

  return letra === letraCalculada;
}

function limpiarTelefono(telefono) {
  // Eliminar todos los caracteres no numéricos
  return telefono.toString().replace(/\D/g, '');
}

function validarTelefono(telefono) {
  const telefonoLimpio = limpiarTelefono(telefono);
  // Validar que tenga entre 9 y 15 dígitos después de limpiar
  return /^\d{9,15}$/.test(telefonoLimpio);
}

router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  
  // Sanitizar y limpiar todos los datos de entrada
  const nombre = req.body.nombre ? req.body.nombre.toString().trim() : '';
  const correo = req.body.correo ? req.body.correo.toString().trim().toLowerCase() : '';
  const usuario = req.body.usuario ? req.body.usuario.toString().trim() : '';
  const dni = req.body.dni ? req.body.dni.toString().trim().toUpperCase() : '';
  const telefono = req.body.telefono ? req.body.telefono.toString() : '';
  const pass = req.body.pass ? req.body.pass.toString() : '';
  const pass_2 = req.body.pass_2 ? req.body.pass_2.toString() : '';
  const clave_admin = req.body.clave_admin ? req.body.clave_admin.toString() : '';

  console.log('Datos recibidos:', { nombre, correo, usuario, dni, telefono, pass: '***', pass_2: '***', clave_admin: '***' });

  // Validaciones básicas de campos requeridos
  if (!nombre || !correo || !usuario || !dni || !telefono || !pass || !pass_2) {
    return res.status(400).json({ error: 'Por favor, rellena todos los campos' });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo)) {
    return res.status(400).json({ error: 'Formato de correo electrónico no válido' });
  }

  // Validar DNI
  if (!validarDNI(dni)) {
    return res.status(400).json({ error: 'DNI no válido. Formato correcto: 12345678X' });
  }

  // Validar y limpiar teléfono
  if (!validarTelefono(telefono)) {
    return res.status(400).json({ error: 'Número de teléfono no válido. Debe contener entre 9 y 15 dígitos' });
  }
  
  const telefonoLimpio = limpiarTelefono(telefono);

  // Validar contraseñas
  if (pass !== pass_2) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  if (pass.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const rol = clave_admin === CLAVE_ADMIN ? 'admin' : 'usuario';

  try {
    // Verificar duplicados en Supabase
    const verificarDuplicados = async () => {
      const errors = [];

      // Verificar DNI duplicado
      const { data: dniExistente, error: dniError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('dni', dni)
        .limit(1);

      if (dniError) {
        console.error('Error al comprobar DNI:', dniError);
        errors.push('Error al comprobar el DNI');
      } else if (dniExistente && dniExistente.length > 0) {
        errors.push('El DNI ya está registrado');
      }

      // Verificar correo duplicado
      const { data: correoExistente, error: correoError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('correo', correo)
        .limit(1);

      if (correoError) {
        console.error('Error al comprobar correo:', correoError);
        errors.push('Error al comprobar el correo');
      } else if (correoExistente && correoExistente.length > 0) {
        errors.push('El correo ya está registrado');
      }

      // Verificar usuario duplicado
      const { data: usuarioExistente, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('usuario', usuario)
        .limit(1);

      if (usuarioError) {
        console.error('Error al comprobar usuario:', usuarioError);
        errors.push('Error al comprobar el nombre de usuario');
      } else if (usuarioExistente && usuarioExistente.length > 0) {
        errors.push('El nombre de usuario ya está registrado');
      }

      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }
    };

    await verificarDuplicados();

    // Encriptar contraseña y registrar usuario
    const hashedPass = await bcrypt.hash(pass, 10);
    
    const { data: nuevoUsuario, error: insertError } = await supabase
      .from('usuarios')
      .insert([{
        nombre: nombre,
        correo: correo,
        usuario: usuario,
        dni: dni,
        pass: hashedPass,
        rol: rol,
        telefono: telefonoLimpio
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error al registrar usuario:', insertError);
      
      // Manejar errores específicos de Supabase
      if (insertError.code === '23505') { // Código de violación de unique constraint
        return res.status(400).json({ error: 'El usuario, correo o DNI ya está registrado' });
      }
      
      return res.status(500).json({ error: 'Error al registrar el usuario en la base de datos' });
    }

    console.log('Usuario registrado exitosamente:', { id: nuevoUsuario.id, usuario, rol });
    res.json({ 
      mensaje: `Usuario registrado correctamente como ${rol}`,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        correo: nuevoUsuario.correo,
        usuario: nuevoUsuario.usuario,
        rol: nuevoUsuario.rol
      }
    });

  } catch (error) {
    console.error('Error general en el registro:', error);
    
    if (error.message.includes('ya está registrado')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario' });
  }
});

module.exports = router;