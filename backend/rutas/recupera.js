const express = require('express');
const router = express.Router();
const emailjs = require('@emailjs/nodejs');
const bcrypt = require('bcrypt');

// Configuración de EmailJS para recuperación
const emailjsConfig = {
  publicKey: 'cm8peTJ9deE4bwUrS',
  privateKey: 'Td3FXR8CwPdKsuyIuwPF_',
};

const emailjsRecoveryServiceId = 'service_r7doupc';
const emailjsRecoveryTemplateId = 'template_sy1terr'; 

// Validar email
function validarEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para encriptar contraseña
async function encriptarPassword(password) {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('❌ Error encriptando contraseña:', error);
    throw new Error('Error al encriptar la contraseña');
  }
}

// Función para enviar email de recuperación
function enviarEmailRecuperacionPassword(datosRecuperacion) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validar datos requeridos
      if (!datosRecuperacion.email || !validarEmail(datosRecuperacion.email)) {
        throw new Error(`Email inválido para recuperación: "${datosRecuperacion.email}"`);
      }

      if (!datosRecuperacion.codigo) {
        throw new Error('Código de verificación requerido');
      }

      // Datos para la plantilla de recuperación
      const templateParams = {
        user_name: datosRecuperacion.nombre_usuario || 'Usuario',
        user_username: datosRecuperacion.usuario || 'Usuario',
        verification_code: datosRecuperacion.codigo,
        app_name: 'Depo',
        expiration_time: '15 minutos',
        support_email: 'soporte@depo.com',
        current_year: new Date().getFullYear(),
        to_email: datosRecuperacion.email
      };

      console.log('🔐 Enviando email de recuperación a:', datosRecuperacion.email);
      console.log('👤 Usuario:', datosRecuperacion.usuario);
      console.log('📝 Código de verificación:', datosRecuperacion.codigo);
      
      // Enviar email con EmailJS
      const result = await emailjs.send(
        emailjsRecoveryServiceId,
        emailjsRecoveryTemplateId,
        templateParams,
        emailjsConfig
      );

      console.log('✅ Email de recuperación enviado con EmailJS');
      resolve(result);

    } catch (error) {
      console.error('❌ Error enviando email de recuperación:', error);
      reject(error);
    }
  });
}

// Generar código de 6 dígitos
function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Ruta para solicitar recuperación de contraseña
router.post('/solicitar-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔐 Solicitud de recuperación para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    const db = req.app.get('conexion');

    // Verificar si el usuario existe y obtener TODOS LOS DATOS
    const sql = 'SELECT id, nombre, correo, usuario, dni, telefono FROM usuarios WHERE correo = ?';
    db.query(sql, [email], async (err, results) => {
      if (err) {
        console.error('❌ Error en base de datos:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error interno del servidor' 
        });
      }

      // Por seguridad, siempre devolvemos el mismo mensaje
      const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

      if (results.length === 0) {
        console.log('📧 Email no encontrado (por seguridad):', email);
        return res.json({ 
          success: true, 
          message: mensajeSeguro
        });
      }

      const usuario = results[0];
      
      // Generar código de 6 dígitos
      const codigo = generarCodigo();
      
      // Guardar código en la base de datos CON EL USER_ID para seguimiento
      const insertSql = 'INSERT INTO recuperacion_password (email, codigo, expiracion, user_id, user_username) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, ?)';
      db.query(insertSql, [email, codigo, usuario.id, usuario.usuario], async (err, result) => {
        if (err) {
          console.error('❌ Error guardando código:', err);
          // Continuamos aunque falle el guardado
        }

        // Enviar email de recuperación CON TODA LA INFORMACIÓN DEL USUARIO
        try {
          const datosEmail = {
            email: usuario.correo,
            nombre_usuario: usuario.nombre,
            usuario: usuario.usuario,
            codigo: codigo
          };

          // Log de seguridad - quién está solicitando recuperación
          console.log('👤 USUARIO SOLICITANDO RECUPERACIÓN:', {
            id: usuario.id,
            nombre: usuario.nombre,
            usuario: usuario.usuario,
            email: usuario.correo,
            dni: usuario.dni ? `${usuario.dni.substring(0, 3)}...` : 'No disponible',
            telefono: usuario.telefono || 'No disponible',
            timestamp: new Date().toISOString()
          });

          await enviarEmailRecuperacionPassword(datosEmail);
          
          res.json({ 
            success: true, 
            message: mensajeSeguro,
            // Solo en desarrollo mostramos info adicional
            debug: process.env.NODE_ENV === 'development' ? {
              usuario: usuario.usuario,
              nombre: usuario.nombre,
              codigo: codigo
            } : undefined
          });
          
        } catch (emailError) {
          console.error('❌ Error enviando email de recuperación:', emailError);
          res.status(500).json({ 
            success: false, 
            error: 'Error al enviar el email de recuperación',
            // En desarrollo mostramos el código para testing
            debug: process.env.NODE_ENV === 'development' ? {
              codigo: codigo,
              usuario: usuario.usuario
            } : undefined
          });
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error en solicitar-recuperacion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para reenviar código
router.post('/reenviar-codigo', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔄 Reenviando código para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    const db = req.app.get('conexion');

    // Verificar si el usuario existe
    const sql = 'SELECT id, nombre, correo, usuario FROM usuarios WHERE correo = ?';
    db.query(sql, [email], async (err, results) => {
      if (err) {
        console.error('❌ Error en base de datos:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error interno del servidor' 
        });
      }

      const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

      if (results.length === 0) {
        return res.json({ 
          success: true, 
          message: mensajeSeguro
        });
      }

      const usuario = results[0];
      
      // Generar NUEVO código de 6 dígitos
      const nuevoCodigo = generarCodigo();
      
      // Guardar NUEVO código en la base de datos
      const insertSql = 'INSERT INTO recuperacion_password (email, codigo, expiracion, user_id, user_username) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, ?)';
      db.query(insertSql, [email, nuevoCodigo, usuario.id, usuario.usuario], async (err, result) => {
        if (err) {
          console.error('❌ Error guardando nuevo código:', err);
        }

        // Enviar NUEVO email de recuperación
        try {
          const datosEmail = {
            email: usuario.correo,
            nombre_usuario: usuario.nombre,
            usuario: usuario.usuario,
            codigo: nuevoCodigo
          };

          console.log('🔄 REENVIO DE CÓDIGO PARA:', {
            usuario: usuario.usuario,
            email: usuario.correo,
            nuevo_codigo: nuevoCodigo
          });

          await enviarEmailRecuperacionPassword(datosEmail);
          
          res.json({ 
            success: true, 
            message: mensajeSeguro,
            debug: process.env.NODE_ENV === 'development' ? {
              usuario: usuario.usuario,
              codigo: nuevoCodigo
            } : undefined
          });
          
        } catch (emailError) {
          console.error('❌ Error reenviando email de recuperación:', emailError);
          res.status(500).json({ 
            success: false, 
            error: 'Error al reenviar el email de recuperación',
            debug: process.env.NODE_ENV === 'development' ? {
              codigo: nuevoCodigo,
              usuario: usuario.usuario
            } : undefined
          });
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error en reenviar-codigo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para verificar código de recuperación
router.post('/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo } = req.body;

    console.log('🔍 Verificando código para:', email);

    if (!email || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y código son requeridos' 
      });
    }

    const db = req.app.get('conexion');

    // Verificar código en la base de datos CON INFORMACIÓN DEL USUARIO
    const sql = `
      SELECT rp.*, u.usuario, u.nombre 
      FROM recuperacion_password rp 
      LEFT JOIN usuarios u ON rp.user_id = u.id 
      WHERE rp.email = ? AND rp.codigo = ? AND rp.expiracion > NOW() AND rp.usado = 0 
      ORDER BY rp.creado DESC LIMIT 1
    `;
    
    db.query(sql, [email, codigo], (err, results) => {
      if (err) {
        console.error('❌ Error verificando código:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error interno del servidor' 
        });
      }

      if (results.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Código inválido, expirado o ya utilizado' 
        });
      }

      const recuperacion = results[0];
      
      console.log('✅ Código verificado para usuario:', {
        usuario: recuperacion.usuario,
        nombre: recuperacion.nombre,
        email: recuperacion.email
      });

      res.json({ 
        success: true, 
        message: 'Código verificado correctamente',
        valido: true,
        // Enviamos info del usuario al frontend para confirmación
        usuario: {
          username: recuperacion.usuario,
          nombre: recuperacion.nombre
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error en verificar-codigo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para cambiar contraseña después de verificación
router.post('/cambiar-password', async (req, res) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;

    console.log('🔄 Cambiando password para:', email);

    if (!email || !codigo || !nuevaPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son requeridos' 
      });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    const db = req.app.get('conexion');

    // Verificar que el código es válido y obtener info del usuario
    const verificarSql = `
      SELECT rp.*, u.id as user_id, u.usuario, u.nombre 
      FROM recuperacion_password rp 
      LEFT JOIN usuarios u ON rp.user_id = u.id 
      WHERE rp.email = ? AND rp.codigo = ? AND rp.expiracion > NOW() AND rp.usado = 0 
      ORDER BY rp.creado DESC LIMIT 1
    `;
    
    db.query(verificarSql, [email, codigo], async (err, results) => {
      if (err) {
        console.error('❌ Error verificando código:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error interno del servidor' 
        });
      }

      if (results.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Código inválido o expirado' 
        });
      }

      const recuperacion = results[0];
      const userId = recuperacion.user_id;

      try {
        // 👇 ENCRIPTAR LA NUEVA CONTRASEÑA CON BCRYPT
        const hashedPassword = await encriptarPassword(nuevaPassword);
        
        console.log('🔐 Contraseña encriptada correctamente para usuario:', recuperacion.usuario);

        // Actualizar contraseña del usuario CON LA CONTRASEÑA ENCRIPTADA
        const updateSql = 'UPDATE usuarios SET pass = ? WHERE id = ?';
        db.query(updateSql, [hashedPassword, userId], (err, result) => {
          if (err) {
            console.error('❌ Error actualizando contraseña:', err);
            return res.status(500).json({ 
              success: false, 
              error: 'Error al cambiar la contraseña' 
            });
          }

          if (result.affectedRows === 0) {
            return res.status(400).json({ 
              success: false, 
              error: 'Usuario no encontrado' 
            });
          }

          // Marcar código como usado
          const marcarUsadoSql = 'UPDATE recuperacion_password SET usado = 1 WHERE email = ? AND codigo = ?';
          db.query(marcarUsadoSql, [email, codigo]);

          // Log de la operación completada
          console.log('✅ CONTRASEÑA CAMBIADA EXITOSAMENTE:', {
            usuario: recuperacion.usuario,
            nombre: recuperacion.nombre,
            email: email,
            user_id: userId,
            contraseña_encriptada: true,
            timestamp: new Date().toISOString()
          });

          res.json({ 
            success: true, 
            message: 'Contraseña cambiada exitosamente',
            actualizado: true,
            usuario: {
              username: recuperacion.usuario,
              nombre: recuperacion.nombre
            }
          });
        });

      } catch (encryptionError) {
        console.error('❌ Error encriptando contraseña:', encryptionError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al procesar la contraseña' 
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error en cambiar-password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para probar el email de recuperación
router.get('/test', async (req, res) => {
  try {
    const testData = {
      email: 'alvaroramirezm8@gmail.com',
      nombre_usuario: 'Alvaro Ramirez',
      usuario: 'alvarorm8',
      codigo: '123456'
    };

    console.log('🧪 Probando email de recuperación...');
    
    const result = await enviarEmailRecuperacionPassword(testData);
    
    res.json({ 
      success: true, 
      message: '✅ Email de recuperación enviado correctamente',
      to: testData.email,
      usuario: testData.usuario,
      codigo: testData.codigo,
      servicio: 'Recuperación de contraseñas'
    });
    
  } catch (error) {
    console.error('❌ Error en test de recuperación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ruta para probar la encriptación
router.get('/test-encriptacion', async (req, res) => {
  try {
    const testPassword = 'miContraseña123';
    console.log('🧪 Probando encriptación...');
    console.log('📝 Contraseña original:', testPassword);
    
    const hashedPassword = await encriptarPassword(testPassword);
    console.log('🔐 Contraseña encriptada:', hashedPassword);
    
    // Verificar que funciona la comparación
    const esValida = await bcrypt.compare(testPassword, hashedPassword);
    console.log('✅ Comparación exitosa:', esValida);
    
    res.json({ 
      success: true, 
      message: 'Encriptación funcionando correctamente',
      original: testPassword,
      encriptada: hashedPassword,
      comparacion_valida: esValida
    });
    
  } catch (error) {
    console.error('❌ Error en test de encriptación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;