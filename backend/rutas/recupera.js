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
async function enviarEmailRecuperacionPassword(datosRecuperacion) {
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
    return result;

  } catch (error) {
    console.error('❌ Error enviando email de recuperación:', error);
    throw error;
  }
}

// Generar código de 6 dígitos
function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Middleware para obtener supabase
router.use((req, res, next) => {
  req.supabase = req.app.get('supabase');
  if (!req.supabase) {
    console.error('❌ Supabase no configurado en la app');
    return res.status(500).json({ 
      success: false, 
      error: 'Error de configuración del servidor' 
    });
  }
  next();
});

// Ruta para solicitar recuperación de contraseña
router.post('/solicitar-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    const supabase = req.supabase;

    console.log('🔐 Solicitud de recuperación para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    // Verificar si el usuario existe y obtener TODOS LOS DATOS
    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario, dni, telefono')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    // Por seguridad, siempre devolvemos el mismo mensaje
    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

    if (!usuarios || usuarios.length === 0) {
      console.log('📧 Email no encontrado (por seguridad):', email);
      return res.json({ 
        success: true, 
        message: mensajeSeguro
      });
    }

    const usuario = usuarios[0];
    
    // Generar código de 6 dígitos
    const codigo = generarCodigo();
    
    // Guardar código en la base de datos CON EL USER_ID para seguimiento
    const { error: insertError } = await supabase
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: codigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando código:', insertError);
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
    const supabase = req.supabase;

    console.log('🔄 Reenviando código para:', email);

    if (!email || !validarEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Por favor, proporciona un email válido' 
      });
    }

    // Verificar si el usuario existe
    const { data: usuarios, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, usuario')
      .eq('correo', email)
      .limit(1);

    if (userError) {
      console.error('❌ Error en base de datos:', userError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    const mensajeSeguro = 'Si el email existe en nuestro sistema, recibirás un código de verificación';

    if (!usuarios || usuarios.length === 0) {
      return res.json({ 
        success: true, 
        message: mensajeSeguro
      });
    }

    const usuario = usuarios[0];
    
    // Generar NUEVO código de 6 dígitos
    const nuevoCodigo = generarCodigo();
    
    // Guardar NUEVO código en la base de datos
    const { error: insertError } = await supabase
      .from('recuperacion_password')
      .insert([{
        email: email,
        codigo: nuevoCodigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
        user_id: usuario.id,
        user_username: usuario.usuario
      }]);

    if (insertError) {
      console.error('❌ Error guardando nuevo código:', insertError);
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
    const supabase = req.supabase;

    console.log('🔍 Verificando código para:', email, 'Código:', codigo);

    if (!email || !codigo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y código son requeridos' 
      });
    }

    // Verificar código en la base de datos
    const { data: recuperaciones, error } = await supabase
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
      .order('creado', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error verificando código:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      console.log('❌ Código no válido para:', email);
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido, expirado o ya utilizado' 
      });
    }

    const recuperacion = recuperaciones[0];
    
    // Obtener información del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('usuario, nombre')
      .eq('id', recuperacion.user_id)
      .single();

    console.log('✅ Código verificado para usuario:', {
      usuario: usuario?.usuario,
      nombre: usuario?.nombre,
      email: recuperacion.email
    });

    res.json({ 
      success: true, 
      message: 'Código verificado correctamente',
      valido: true,
      usuario: {
        username: usuario?.usuario,
        nombre: usuario?.nombre
      }
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
    const supabase = req.supabase;

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

    // Verificar que el código es válido
    const { data: recuperaciones, error: verificarError } = await supabase
      .from('recuperacion_password')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expiracion', new Date().toISOString())
      .order('creado', { ascending: false })
      .limit(1);

    if (verificarError) {
      console.error('❌ Error verificando código:', verificarError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    if (!recuperaciones || recuperaciones.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código inválido o expirado' 
      });
    }

    const recuperacion = recuperaciones[0];
    const userId = recuperacion.user_id;

    try {
      // ENCRIPTAR LA NUEVA CONTRASEÑA CON BCRYPT
      const hashedPassword = await encriptarPassword(nuevaPassword);
      
      console.log('🔐 Contraseña encriptada correctamente para user_id:', userId);

      // Actualizar contraseña del usuario
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ pass: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Error actualizando contraseña:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al cambiar la contraseña' 
        });
      }

      // Marcar código como usado
      await supabase
        .from('recuperacion_password')
        .update({ usado: true })
        .eq('email', email)
        .eq('codigo', codigo);

      // Obtener información del usuario para el log
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('usuario, nombre')
        .eq('id', userId)
        .single();

      // Log de la operación completada
      console.log('✅ CONTRASEÑA CAMBIADA EXITOSAMENTE:', {
        usuario: usuario?.usuario,
        nombre: usuario?.nombre,
        email: email,
        user_id: userId,
        timestamp: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        message: 'Contraseña cambiada exitosamente',
        actualizado: true,
        usuario: {
          username: usuario?.usuario,
          nombre: usuario?.nombre
        }
      });

    } catch (encryptionError) {
      console.error('❌ Error encriptando contraseña:', encryptionError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al procesar la contraseña' 
      });
    }
    
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

// Ruta de health check para el router
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Router de recuperación funcionando',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;