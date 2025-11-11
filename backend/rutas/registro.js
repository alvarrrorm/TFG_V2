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
  const conexion = req.app.get('conexion');
  
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
    // Verificar duplicados de manera más eficiente
    const verificarDuplicados = () => {
      return new Promise((resolve, reject) => {
        const queries = [
          { query: 'SELECT id FROM usuarios WHERE dni = ?', value: dni, field: 'DNI' },
          { query: 'SELECT id FROM usuarios WHERE correo = ?', value: correo, field: 'correo' },
          { query: 'SELECT id FROM usuarios WHERE usuario = ?', value: usuario, field: 'nombre de usuario' }
        ];

        let completed = 0;
        const errors = [];

        queries.forEach(({ query, value, field }) => {
          conexion.query(query, [value], (err, resultados) => {
            if (err) {
              console.error(`Error al comprobar ${field}:`, err);
              errors.push(`Error al comprobar el ${field}`);
            } else if (resultados.length > 0) {
              errors.push(`El ${field} ya está registrado`);
            }

            completed++;
            if (completed === queries.length) {
              if (errors.length > 0) {
                reject(new Error(errors.join(', ')));
              } else {
                resolve();
              }
            }
          });
        });
      });
    };

    await verificarDuplicados();

    // Encriptar contraseña y registrar usuario
    const hashedPass = await bcrypt.hash(pass, 10);
    const sql = 'INSERT INTO usuarios (nombre, correo, usuario, dni, pass, rol, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const valores = [nombre, correo, usuario, dni, hashedPass, rol, telefonoLimpio];

    conexion.query(sql, valores, (err, result) => {
      if (err) {
        console.error('Error al registrar usuario:', err);
        
        // Manejar errores específicos de MySQL
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'El usuario, correo o DNI ya está registrado' });
        }
        
        return res.status(500).json({ error: 'Error al registrar el usuario en la base de datos' });
      }

      console.log('Usuario registrado exitosamente:', { id: result.insertId, usuario, rol });
      res.json({ 
        mensaje: `Usuario registrado correctamente como ${rol}`,
        usuario: {
          id: result.insertId,
          nombre,
          correo,
          usuario,
          rol
        }
      });
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