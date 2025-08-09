
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const CLAVE_ADMIN = 'admin1234';

function validarDNI(dni) {
  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const dniRegex = /^(\d{8})([A-Z])$/i;

  const match = dni.match(dniRegex);
  if (!match) return false;

  const numero = parseInt(match[1], 10);
  const letra = match[2].toUpperCase();
  const letraCalculada = letras[numero % 23];

  return letra === letraCalculada;
}

router.post('/', async (req, res) => {
  const conexion = req.app.get('conexion');
  const { nombre, correo, usuario, dni, telefono, pass, pass_2, clave_admin } = req.body;

  if (!nombre || !correo || !usuario || !dni || !telefono || !pass || !pass_2) {
    return res.status(400).json({ error: 'Por favor, rellena todos los campos' });
  }

  if (!validarDNI(dni)) {
    return res.status(400).json({ error: 'DNI no válido' });
  }
  // Validar número de teléfono: solo dígitos, entre 9 y 15 caracteres
  if (!/^\d{9,15}$/.test(telefono)) {
    return res.status(400).json({ error: 'Número de teléfono no válido. Debe contener entre 9 y 15 dígitos' });
  }

  if (pass !== pass_2) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  const rol = clave_admin === CLAVE_ADMIN ? 'admin' : 'usuario';

  try {
    // Verifica si DNI ya existe
    conexion.query('SELECT id FROM usuarios WHERE dni = ?', [dni], async (err, resultados) => {
      if (err) {
        console.error('Error al comprobar DNI:', err);
        return res.status(500).json({ error: 'Error al comprobar el DNI' });
      }
      if (resultados.length > 0) {
        return res.status(400).json({ error: 'El DNI ya está registrado' });
      }

      // Verifica si correo ya existe
      conexion.query('SELECT id FROM usuarios WHERE correo = ?', [correo], async (err, resultados) => {
        if (err) {
          console.error('Error al comprobar correo:', err);
          return res.status(500).json({ error: 'Error al comprobar el correo' });
        }
        if (resultados.length > 0) {
          return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        // Verifica si nombre de usuario ya existe
        conexion.query('SELECT id FROM usuarios WHERE usuario = ?', [usuario], async (err, resultados) => {
          if (err) {
            console.error('Error al comprobar usuario:', err);
            return res.status(500).json({ error: 'Error al comprobar el nombre de usuario' });
          }
          if (resultados.length > 0) {
            return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
          }

          // Encriptar y registrar
          const hashedPass = await bcrypt.hash(pass, 10);
          const sql = 'INSERT INTO usuarios (nombre, correo, usuario, dni, pass, rol, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)';
          const valores = [nombre, correo, usuario, dni, hashedPass, rol, telefono];

          conexion.query(sql, valores, (err) => {
            if (err) {
              console.error('Error al registrar usuario:', err);
              return res.status(500).json({ error: 'Error al registrar el usuario' });
            }

            res.json({ mensaje: `Usuario registrado correctamente como ${rol}` });
          });
        });
      });
    });
  } catch (error) {
    console.error('Error general en el registro:', error);
    res.status(500).json({ error: 'Error interno al registrar el usuario' });
  }
});

module.exports = router;
