const express = require('express');
const router = express.Router();
const emailjs = require('@emailjs/nodejs');

// Configuración de EmailJS
const emailjsConfig = {
  reserva: {
    serviceId: 'service_lb9lbhi',
    templateId: 'template_hfuxqzm'
  }
};

const emailjsPublicKey = 'cm8peTJ9deE4bwUrS';
const emailjsPrivateKey = 'Td3FXR8CwPdKsuyIuwPF_';

// 👇 FUNCIÓN REUTILIZABLE PARA FORMATEAR FECHA
const formatearFecha = (fechaInput) => {
  if (!fechaInput) return null;
  
  console.log('🔄 Formateando fecha recibida:', fechaInput, 'Tipo:', typeof fechaInput);
  
  if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
    console.log('✅ Fecha ya en formato correcto:', fechaInput);
    return fechaInput;
  }
  
  if (typeof fechaInput === 'string' && fechaInput.includes('T')) {
    try {
      const fechaObj = new Date(fechaInput);
      if (isNaN(fechaObj.getTime())) {
        console.error('❌ Fecha ISO inválida:', fechaInput);
        return null;
      }
      
      const año = fechaObj.getFullYear();
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      
      const fechaFormateada = `${año}-${mes}-${dia}`;
      console.log('📅 Fecha ISO convertida:', fechaInput, '→', fechaFormateada);
      return fechaFormateada;
    } catch (error) {
      console.error('❌ Error formateando fecha ISO:', error);
      return null;
    }
  }
  
  console.error('❌ Formato de fecha no reconocido:', fechaInput);
  return null;
};

// 👇 FUNCIÓN PARA VALIDAR HORA
const validarHora = (hora) => {
  if (!hora) return false;
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hora);
};

// 👇 FUNCIÓN MEJORADA PARA BUSCAR USUARIO EXACTO
const buscarUsuarioExacto = async (supabase, nombreUsuario, usuarioId) => {
  try {
    console.log('🔍 Buscando usuario:', { nombreUsuario, usuarioId });
    
    if (usuarioId && usuarioId !== 0) {
      const { data: usuarioPorId, error: errorPorId } = await supabase
        .from('usuarios')
        .select('id, correo, nombre, usuario')
        .eq('id', usuarioId)
        .single();
      
      if (!errorPorId && usuarioPorId) {
        console.log('✅ Usuario encontrado por ID:', usuarioPorId);
        return usuarioPorId;
      }
    }
    
    if (nombreUsuario) {
      const { data: usuarioPorLogin, error: errorLogin } = await supabase
        .from('usuarios')
        .select('id, correo, nombre, usuario')
        .eq('usuario', nombreUsuario)
        .limit(1);
      
      if (!errorLogin && usuarioPorLogin && usuarioPorLogin.length === 1) {
        console.log('✅ Usuario encontrado por LOGIN:', usuarioPorLogin[0]);
        return usuarioPorLogin[0];
      }
      
      const { data: usuarioPorNombre, error: errorNombre } = await supabase
        .from('usuarios')
        .select('id, correo, nombre, usuario')
        .eq('nombre', nombreUsuario)
        .limit(1);
      
      if (!errorNombre && usuarioPorNombre && usuarioPorNombre.length === 1) {
        console.log('✅ Usuario encontrado por NOMBRE:', usuarioPorNombre[0]);
        return usuarioPorNombre[0];
      }
    }
    
    console.log('❌ Usuario no encontrado:', { nombreUsuario, usuarioId });
    return null;
    
  } catch (error) {
    console.error('❌ Error en buscarUsuarioExacto:', error);
    return null;
  }
};

// 👇 FUNCIÓN PARA CALCULAR DURACIÓN
const calcularDuracion = (horaInicio, horaFin) => {
  const [hInicio, mInicio] = horaInicio.split(':').map(Number);
  const [hFin, mFin] = horaFin.split(':').map(Number);
  
  const minutosInicio = hInicio * 60 + mInicio;
  const minutosFin = hFin * 60 + mFin;
  const duracionMinutos = minutosFin - minutosInicio;
  
  if (duracionMinutos < 60) {
    return `${duracionMinutos} minutos`;
  } else {
    const horas = Math.floor(duracionMinutos / 60);
    const minutos = duracionMinutos % 60;
    if (minutos === 0) {
      return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    }
    return `${horas}h ${minutos}min`;
  }
};

// 👇 FUNCIÓN COMBINADA PARA ENVIAR EMAIL DE CONFIRMACIÓN
const enviarEmailConfirmacion = async (datosEmail) => {
  try {
    console.log('📧 Preparando email de confirmación...');
    console.log('📊 Datos del email:', {
      to_name: datosEmail.to_name,
      to_email: datosEmail.to_email,
      reserva_id: datosEmail.reserva_id
    });

    // Formatear fecha si viene como string ISO
    let fechaFormateada = datosEmail.fecha;
    if (datosEmail.fecha && typeof datosEmail.fecha === 'string' && !datosEmail.fecha.includes(',')) {
      try {
        const fechaObj = new Date(datosEmail.fecha);
        if (!isNaN(fechaObj.getTime())) {
          fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (error) {
        console.warn('⚠️  No se pudo formatear la fecha:', error);
      }
    }

    const templateParams = {
      // 👤 Datos del usuario
      user_name: datosEmail.to_name || 'Cliente',
      user_email: datosEmail.to_email,
      to_email: datosEmail.to_email, // EmailJS necesita este campo
      
      // 📋 Datos de la reserva
      reservation_id: datosEmail.reserva_id || '000000',
      polideportivo_name: datosEmail.polideportivo || 'Polideportivo',
      pista_name: datosEmail.pista || 'Pista',
      reservation_date: fechaFormateada || 'Fecha no disponible',
      reservation_time: datosEmail.horario || 'Horario no disponible',
      reservation_duration: datosEmail.duracion || 'Duración no disponible',
      reservation_price: datosEmail.precio || '€0.00',
      reservation_status: 'Confirmada',
      payment_method: 'Tarjeta de crédito',
      confirmation_date: new Date().toLocaleDateString('es-ES'),
      
      // 🏢 Datos de contacto
      app_name: 'Depo',
      support_email: datosEmail.email_contacto || 'soporte@depo.com',
      support_phone: datosEmail.telefono_contacto || 'N/A',
      support_hours: datosEmail.horario_contacto || 'L-V: 8:00-22:00',
      
      // 📅 Información general
      current_year: datosEmail.anio_actual || new Date().getFullYear().toString()
    };

    console.log('📨 Enviando email con EmailJS...');
    console.log('📋 Template params resumidos:', {
      to_name: templateParams.user_name,
      to_email: templateParams.to_email,
      reservation_id: templateParams.reservation_id,
      polideportivo: templateParams.polideportivo_name,
      fecha: templateParams.reservation_date,
      horario: templateParams.reservation_time,
      precio: templateParams.reservation_price
    });

    // Enviar email usando EmailJS
    const result = await emailjs.send(
      emailjsConfig.reserva.serviceId,     // service_lb9lbhi
      emailjsConfig.reserva.templateId,    // template_hfuxqzm
      templateParams,
      {
        publicKey: emailjsPublicKey,       // cm8peTJ9deE4bwUrS
        privateKey: emailjsPrivateKey      // Td3FXR8CwPdKsuyIuwPF_
      }
    );

    console.log('✅ Email enviado correctamente a:', datosEmail.to_email);
    console.log('📩 Respuesta de EmailJS:', result.status, result.text);
    return result;

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // En desarrollo, simular éxito y mostrar datos
    if (process.env.NODE_ENV !== 'production') {
      console.log('🧪 Modo desarrollo: Simulando envío exitoso');
      console.log('📧 Para:', datosEmail.to_email);
      console.log('📋 Datos que se enviarían:', {
        user_name: datosEmail.to_name,
        reservation_id: datosEmail.reserva_id,
        polideportivo_name: datosEmail.polideportivo,
        reservation_date: datosEmail.fecha,
        reservation_time: datosEmail.horario,
        reservation_price: datosEmail.precio
      });
      return { status: 200, text: 'OK', simulated: true };
    }
    
    throw error;
  }
};

// Crear una reserva
router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const {
    dni_usuario,
    nombre_usuario,
    usuario_id,
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    ludoteca = false,
    estado = 'pendiente',
    precio
  } = req.body;

  console.log('📥 Creando nueva reserva con datos:', {
    nombre_usuario, 
    usuario_id_provided: usuario_id,
    pista_id, 
    fecha, 
    hora_inicio, 
    hora_fin, 
    ludoteca, 
    precio
  });

  if (!nombre_usuario || !pista_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan campos obligatorios' 
    });
  }

  if (!usuario_id || usuario_id === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Usuario no válido. Por favor, inicia sesión nuevamente.' 
    });
  }

  if (!validarHora(hora_inicio) || !validarHora(hora_fin)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Formato de hora inválido' 
    });
  }

  const pistaId = Number(pista_id);
  if (isNaN(pistaId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'ID de pista inválido' 
    });
  }

  const fechaFormateada = formatearFecha(fecha);
  if (!fechaFormateada) {
    return res.status(400).json({ 
      success: false, 
      error: 'Fecha inválida' 
    });
  }

  console.log('📅 Fecha formateada:', fechaFormateada);

  try {
    const { data: pistas, error: pistaError } = await supabase
      .from('pistas')
      .select(`
        *,
        polideportivos!inner(id)
      `)
      .eq('id', pistaId)
      .eq('disponible', true)
      .single();

    if (pistaError || !pistas) {
      console.error('❌ Error al obtener información de la pista:', pistaError);
      return res.status(404).json({ 
        success: false, 
        error: 'Pista no encontrada o no disponible' 
      });
    }

    const polideportivoId = pistas.polideportivo_id;
    console.log('📍 Pista seleccionada:', pistas.nombre, 'Polideportivo:', polideportivoId);

    let usuarioFinalId = 0;
    let usuarioEmail = '';
    let nombreUsuarioReal = nombre_usuario;
    let usuarioEncontrado = null;

    usuarioEncontrado = await buscarUsuarioExacto(supabase, nombre_usuario, usuario_id);

    if (usuarioEncontrado) {
      usuarioFinalId = usuarioEncontrado.id;
      usuarioEmail = usuarioEncontrado.correo;
      nombreUsuarioReal = usuarioEncontrado.nombre || usuarioEncontrado.usuario || nombre_usuario;
      
      console.log('👤 Usuario FINAL encontrado:');
      console.log('   ID:', usuarioFinalId);
      console.log('   Login:', usuarioEncontrado.usuario);
      console.log('   Nombre:', usuarioEncontrado.nombre);
      console.log('   Email:', usuarioEmail);
      
      if (!usuarioEmail) {
        console.log('⚠️  ADVERTENCIA: Usuario encontrado pero SIN EMAIL');
      }
    } else {
      console.log('❌ ALERTA CRÍTICA: Usuario NO encontrado en la base de datos');
      console.log('📝 Datos proporcionados:', { nombre_usuario, usuario_id });
      return res.status(400).json({ 
        success: false, 
        error: 'Usuario no encontrado en el sistema. Por favor, verifica tu sesión.' 
      });
    }

    const { data: reservasConflictivas, error: disponibilidadError } = await supabase
      .from('reservas')
      .select('id')
      .eq('pista_id', pistaId)
      .eq('fecha', fechaFormateada)
      .neq('estado', 'cancelada')
      .or(`and(hora_inicio.lt.${hora_fin},hora_fin.gt.${hora_inicio}),and(hora_inicio.gte.${hora_inicio},hora_inicio.lt.${hora_fin}),and(hora_fin.gt.${hora_inicio},hora_fin.lte.${hora_fin})`);

    if (disponibilidadError) {
      console.error('❌ Error al comprobar disponibilidad:', disponibilidadError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al comprobar disponibilidad' 
      });
    }
    
    if (reservasConflictivas && reservasConflictivas.length > 0) {
      console.log('🚫 Pista no disponible - Conflictos encontrados:', reservasConflictivas.length);
      return res.status(409).json({ 
        success: false, 
        error: 'La pista no está disponible en el horario seleccionado' 
      });
    }

    const { data: reservasUsuario, error: usuarioReservaError } = await supabase
      .from('reservas')
      .select('id')
      .eq('usuario_id', usuarioFinalId)
      .eq('fecha', fechaFormateada)
      .neq('estado', 'cancelada')
      .or(`and(hora_inicio.lt.${hora_fin},hora_fin.gt.${hora_inicio}),and(hora_inicio.gte.${hora_inicio},hora_inicio.lt.${hora_fin}),and(hora_fin.gt.${hora_inicio},hora_fin.lte.${hora_fin})`);

    if (usuarioReservaError) {
      console.error('❌ Error al comprobar reservas del usuario:', usuarioReservaError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al comprobar reservas del usuario' 
      });
    }
    
    if (reservasUsuario && reservasUsuario.length > 0) {
      console.log('🚫 Usuario ya tiene reserva en ese horario');
      return res.status(409).json({ 
        success: false, 
        error: 'Ya tienes otra reserva en este horario' 
      });
    }

    let precioFinal = precio;
    if (precio === undefined) {
      const precioHora = parseFloat(pistas.precio);
      if (isNaN(precioHora)) {
        return res.status(500).json({ 
          success: false, 
          error: 'Precio de la pista inválido' 
        });
      }

      const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
      const [hFin, mFin] = hora_fin.split(':').map(Number);
      const duracion = ((hFin * 60 + mFin) - (hInicio * 60 + mInicio)) / 60;
      
      if (duracion <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'La hora de fin debe ser posterior a la hora de inicio' 
        });
      }

      precioFinal = parseFloat((precioHora * duracion).toFixed(2));

      if (ludoteca) {
        precioFinal += 5;
      }
    }

    console.log('💰 Precio calculado:', precioFinal);

    const { data: nuevaReserva, error: insertError } = await supabase
      .from('reservas')
      .insert([{
        pista_id: pistaId,
        polideportivo_id: polideportivoId,
        usuario_id: usuarioFinalId,
        nombre_usuario: nombreUsuarioReal,
        fecha: fechaFormateada,
        hora_inicio: hora_inicio,
        hora_fin: hora_fin,
        precio: precioFinal,
        estado: estado,
        email_usuario: usuarioEmail
      }])
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .single();

    if (insertError) {
      console.error('❌ Error al crear reserva:', insertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al crear reserva: ' + insertError.message 
      });
    }

    console.log('✅ Reserva creada con ID:', nuevaReserva.id);

    const reservaConLudoteca = {
      ...nuevaReserva,
      ludoteca: ludoteca,
      email: usuarioEmail,
      usuario_id: usuarioFinalId,
      pistaNombre: nuevaReserva.pistas?.nombre,
      pistaTipo: nuevaReserva.pistas?.tipo,
      polideportivo_nombre: nuevaReserva.polideportivos?.nombre
    };

    console.log('🎉 Reserva creada exitosamente');
    console.log('📊 Datos FINALES de la reserva:');
    console.log('   ID Reserva:', nuevaReserva.id);
    console.log('   ID Usuario:', nuevaReserva.usuario_id);
    console.log('   Nombre Usuario:', nuevaReserva.nombre_usuario);
    console.log('   Email guardado:', usuarioEmail || 'NO TIENE');

    res.status(201).json({ 
      success: true, 
      data: reservaConLudoteca,
      message: 'Reserva creada correctamente'
    });

  } catch (error) {
    console.error('❌ Error general al crear reserva:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Listar todas las reservas o por nombre de usuario
router.get('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { nombre_usuario } = req.query;

  console.log('📋 Obteniendo reservas para usuario:', nombre_usuario);

  try {
    let query = supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (nombre_usuario) {
      query = query.eq('nombre_usuario', nombre_usuario);
    }

    const { data: reservas, error } = await query;

    if (error) {
      console.error('❌ Error al obtener reservas:', error);
      return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    }
    
    console.log(`📊 Se encontraron ${reservas?.length || 0} reservas`);
    
    const reservasConLudoteca = (reservas || []).map(reserva => ({
      ...reserva,
      ludoteca: false,
      pistaNombre: reserva.pistas?.nombre,
      pistaTipo: reserva.pistas?.tipo,
      polideportivo_nombre: reserva.polideportivos?.nombre
    }));

    res.json({ success: true, data: reservasConLudoteca });
  } catch (error) {
    console.error('❌ Error al obtener reservas:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
  }
});

// Obtener reserva por ID
router.get('/:id', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log('🔍 Obteniendo reserva con ID:', id);

  try {
    const { data: reserva, error } = await supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error al obtener reserva:', error);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (!reserva) {
      console.log('❌ Reserva no encontrada ID:', id);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    console.log('✅ Reserva encontrada:', reserva.id);

    const reservaConLudoteca = {
      ...reserva,
      ludoteca: false,
      pistaNombre: reserva.pistas?.nombre,
      pistaTipo: reserva.pistas?.tipo,
      polideportivo_nombre: reserva.polideportivos?.nombre
    };

    res.json({ success: true, data: reservaConLudoteca });
  } catch (error) {
    console.error('❌ Error al obtener reserva:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
  }
});

// Obtener disponibilidad
router.get('/disponibilidad', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { fecha, polideportivo } = req.query;

  console.log('📅 Consultando disponibilidad - Fecha:', fecha, 'Polideportivo:', polideportivo);

  if (!fecha || !polideportivo) {
    return res.status(400).json({ success: false, error: 'Fecha y polideportivo son requeridos' });
  }

  const fechaFormateada = formatearFecha(fecha);
  if (!fechaFormateada) {
    return res.status(400).json({ success: false, error: 'Fecha inválida' });
  }

  console.log('📅 Fecha formateada para consulta:', fechaFormateada);

  try {
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .eq('fecha', fechaFormateada)
      .eq('polideportivo_id', polideportivo)
      .neq('estado', 'cancelada')
      .order('hora_inicio');

    if (error) {
      console.error('❌ Error al obtener disponibilidad:', error);
      return res.status(500).json({ success: false, error: 'Error al obtener disponibilidad' });
    }
    
    console.log(`📊 Se encontraron ${reservas?.length || 0} reservas activas para la fecha`);
    
    const reservasFormateadas = (reservas || []).map(reserva => ({
      ...reserva,
      pistaNombre: reserva.pistas?.nombre,
      pistaTipo: reserva.pistas?.tipo,
      polideportivo_nombre: reserva.polideportivos?.nombre
    }));

    res.json({ success: true, data: reservasFormateadas });
  } catch (error) {
    console.error('❌ Error al obtener disponibilidad:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener disponibilidad' });
  }
});

// Eliminar una reserva
router.delete('/:id', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log('🗑️ Eliminando reserva ID:', id);

  try {
    const { data: reserva, error: selectError } = await supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre),
        polideportivos!inner(nombre)
      `)
      .eq('id', id)
      .single();

    if (selectError || !reserva) {
      console.log('❌ Reserva no encontrada para eliminar ID:', id);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const { error: deleteError } = await supabase
      .from('reservas')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error al eliminar reserva:', deleteError);
      return res.status(500).json({ success: false, error: 'Error al eliminar reserva' });
    }
    
    console.log('✅ Reserva eliminada correctamente ID:', id);
    
    const reservaConLudoteca = {
      ...reserva,
      ludoteca: false,
      pistaNombre: reserva.pistas?.nombre,
      polideportivo_nombre: reserva.polideportivos?.nombre
    };

    res.json({ 
      success: true, 
      data: reservaConLudoteca, 
      message: 'Reserva eliminada correctamente' 
    });
  } catch (error) {
    console.error('❌ Error al eliminar reserva:', error);
    return res.status(500).json({ success: false, error: 'Error al eliminar reserva' });
  }
});

// 👇 RUTA MEJORADA PARA CONFIRMAR RESERVA Y ENVIAR EMAIL CON TEMPLATE CORRECTO
router.put('/:id/confirmar', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log('✅ Confirmando reserva ID:', id);

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  try {
    // 1. Obtener los datos COMPLETOS de la reserva
    const { data: reserva, error: queryError } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', reservaId)
      .single();

    if (queryError || !reserva) {
      console.error('❌ Error obteniendo datos de reserva:', queryError);
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada' 
      });
    }

    const reservaCompleta = reserva;

    console.log('👤 Datos obtenidos para el email:');
    console.log('   Reserva ID:', reservaCompleta.id);
    console.log('   Usuario ID en reserva:', reservaCompleta.usuario_id);
    console.log('   Nombre Usuario:', reservaCompleta.nombre_usuario);
    console.log('   Email guardado en reserva:', reservaCompleta.email_usuario);
    console.log('   Polideportivo:', reservaCompleta.polideportivos?.nombre);
    console.log('   Pista:', reservaCompleta.pistas?.nombre);
    console.log('   Fecha:', reservaCompleta.fecha);
    console.log('   Horario:', reservaCompleta.hora_inicio, '-', reservaCompleta.hora_fin);
    console.log('   Precio:', reservaCompleta.precio);

    if (reservaCompleta.estado !== 'pendiente') {
      return res.status(400).json({ 
        success: false, 
        error: 'La reserva ya ha sido confirmada o cancelada' 
      });
    }

    let emailParaEnviar = '';
    let nombreParaEmail = reservaCompleta.nombre_usuario;
    
    if (reservaCompleta.email_usuario) {
      emailParaEnviar = reservaCompleta.email_usuario;
      console.log('📧 Usando email guardado en reserva:', emailParaEnviar);
    }
    else if (reservaCompleta.usuario_id && reservaCompleta.usuario_id !== 0) {
      console.log('🔍 Buscando usuario por ID:', reservaCompleta.usuario_id);
      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, correo, nombre, usuario')
        .eq('id', reservaCompleta.usuario_id)
        .single();
      
      if (!usuarioError && usuario && usuario.correo) {
        emailParaEnviar = usuario.correo;
        nombreParaEmail = usuario.nombre || usuario.usuario || reservaCompleta.nombre_usuario;
        console.log('📧 Email obtenido por usuario_id:', emailParaEnviar);
      } else {
        console.log('⚠️  Usuario no encontrado o sin email');
      }
    }

    const { error: updateError } = await supabase
      .from('reservas')
      .update({ 
        estado: 'confirmada',
        fecha_confirmacion: new Date().toISOString()
      })
      .eq('id', reservaId);

    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    console.log('✅ Estado de reserva actualizado a: confirmada');

    let emailEnviado = false;
    let mensajeEmail = '';
    
    if (emailParaEnviar) {
      const duracion = calcularDuracion(reservaCompleta.hora_inicio, reservaCompleta.hora_fin);
      
      const datosEmail = {
        to_name: nombreParaEmail,
        to_email: emailParaEnviar,
        reserva_id: reservaCompleta.id.toString().padStart(6, '0'),
        polideportivo: reservaCompleta.polideportivos?.nombre || 'Polideportivo',
        pista: reservaCompleta.pistas?.nombre || 'Pista',
        fecha: reservaCompleta.fecha,
        horario: `${reservaCompleta.hora_inicio} - ${reservaCompleta.hora_fin}`,
        duracion: duracion,
        precio: `€${parseFloat(reservaCompleta.precio).toFixed(2)}`,
        email_contacto: 'info@polideportivo.com',
        telefono_contacto: '+34 912 345 678',
        horario_contacto: 'L-V: 8:00-22:00, S-D: 9:00-20:00',
        anio_actual: new Date().getFullYear().toString()
      };

      console.log('📤 Enviando email con datos:', datosEmail);

      try {
        await enviarEmailConfirmacion(datosEmail);
        emailEnviado = true;
        mensajeEmail = 'Email de confirmación enviado correctamente';
        console.log('✅ Email enviado exitosamente');
        
      } catch (emailError) {
        console.error('⚠️  Error enviando email:', emailError);
        mensajeEmail = 'Reserva confirmada, pero error enviando email';
      }
      
    } else {
      console.log('⚠️  No se pudo obtener email para enviar');
      mensajeEmail = 'Reserva confirmada, pero no se encontró email del usuario';
    }

    const { data: reservaActualizada } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', reservaId)
      .single();

    const reservaConLudoteca = {
      ...reservaActualizada,
      ludoteca: false,
      pistaNombre: reservaActualizada.pistas?.nombre,
      polideportivo_nombre: reservaActualizada.polideportivos?.nombre
    };

    if (emailEnviado) {
      res.json({
        success: true,
        message: '✅ Reserva confirmada y email de confirmación enviado correctamente',
        data: reservaConLudoteca
      });
    } else {
      res.json({
        success: true,
        message: '✅ Reserva confirmada correctamente',
        data: reservaConLudoteca,
        warning: mensajeEmail
      });
    }

  } catch (error) {
    console.error('❌ Error en confirmar reserva:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// 👇 RUTA PARA REENVIAR EMAIL DE CONFIRMACIÓN
router.post('/:id/reenviar-email', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log(`📧 Reenviando email para reserva ID: ${id}`);

  try {
    const { data: reserva, error: queryError } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', id)
      .single();

    if (queryError || !reserva) {
      console.error('❌ Error obteniendo datos de reserva:', queryError);
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada' 
      });
    }

    if (reserva.estado !== 'confirmada') {
      return res.status(400).json({ 
        success: false, 
        error: 'Solo se pueden reenviar emails de reservas confirmadas' 
      });
    }

    let emailParaEnviar = '';
    
    if (reserva.email_usuario) {
      emailParaEnviar = reserva.email_usuario;
    }
    else if (reserva.usuario_id && reserva.usuario_id !== 0) {
      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, correo, nombre, usuario')
        .eq('id', reserva.usuario_id)
        .single();
      
      if (!usuarioError && usuario && usuario.correo) {
        emailParaEnviar = usuario.correo;
      }
    }

    if (!emailParaEnviar) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede reenviar el email - usuario no tiene email registrado' 
      });
    }

    const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin);
    
    const datosEmail = {
      to_name: reserva.nombre_usuario,
      to_email: emailParaEnviar,
      reserva_id: reserva.id.toString().padStart(6, '0'),
      polideportivo: reserva.polideportivos?.nombre || 'Polideportivo',
      pista: reserva.pistas?.nombre || 'Pista',
      fecha: reserva.fecha,
      horario: `${reserva.hora_inicio} - ${reserva.hora_fin}`,
      duracion: duracion,
      precio: `€${parseFloat(reserva.precio).toFixed(2)}`,
      email_contacto: 'info@polideportivo.com',
      telefono_contacto: '+34 912 345 678',
      horario_contacto: 'L-V: 8:00-22:00, S-D: 9:00-20:00',
      anio_actual: new Date().getFullYear().toString()
    };

    console.log('📧 Reenviando email a:', emailParaEnviar);

    try {
      await enviarEmailConfirmacion(datosEmail);

      console.log('✅ Email reenviado exitosamente a:', emailParaEnviar);

      res.json({
        success: true,
        message: 'Email de confirmación reenviado exitosamente'
      });

    } catch (emailError) {
      console.error('❌ Error reenviando email:', emailError);
      res.status(500).json({ 
        success: false, 
        error: 'Error reenviando el email' 
      });
    }

  } catch (error) {
    console.error('❌ Error en reenviar-email:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Cancelar reserva
router.put('/:id/cancelar', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log('❌ Cancelando reserva ID:', id);

  try {
    const { error: updateError } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .eq('estado', 'pendiente');

    if (updateError) {
      console.error('❌ Error al cancelar reserva:', updateError);
      return res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
    }

    const { data: reserva, error: selectError } = await supabase
      .from('reservas')
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .eq('id', id)
      .single();

    if (selectError || !reserva) {
      console.error('❌ Error al obtener reserva actualizada:', selectError);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva actualizada' });
    }
    
    console.log('✅ Reserva cancelada correctamente ID:', id);
    
    const reservaConLudoteca = {
      ...reserva,
      ludoteca: false,
      pistaNombre: reserva.pistas?.nombre,
      pistaTipo: reserva.pistas?.tipo,
      polideportivo_nombre: reserva.polideportivos?.nombre
    };

    res.json({ 
      success: true, 
      data: reservaConLudoteca, 
      message: 'Reserva cancelada correctamente' 
    });
  } catch (error) {
    console.error('❌ Error al cancelar reserva:', error);
    return res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
  }
});

// 👇 RUTA ACTUALIZAR RESERVA
router.put('/:id', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;
  const {
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado,
    precio,
    ludoteca = false
  } = req.body;

  console.log('📥 Actualizando reserva ID:', id);
  console.log('Datos recibidos:', {
    pista_id, fecha, hora_inicio, hora_fin, estado, precio, ludoteca
  });

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  try {
    const { data: reservaActual, error: getError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', reservaId)
      .single();

    if (getError || !reservaActual) {
      console.error('❌ Error al obtener reserva:', getError);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    console.log('📋 Reserva actual:', reservaActual);
    
    if (pista_id || fecha || hora_inicio || hora_fin) {
      const pistaId = pista_id || reservaActual.pista_id;
      const fechaReserva = fecha ? formatearFecha(fecha) : reservaActual.fecha;
      const horaInicio = hora_inicio || reservaActual.hora_inicio;
      const horaFin = hora_fin || reservaActual.hora_fin;

      console.log('🔍 Verificando disponibilidad con:', {
        pistaId, fechaReserva, horaInicio, horaFin, reservaId
      });

      if (!fechaReserva) {
        return res.status(400).json({ success: false, error: 'Fecha inválida' });
      }

      if (hora_inicio && !validarHora(hora_inicio)) {
        return res.status(400).json({ success: false, error: 'Formato de hora de inicio inválido' });
      }

      if (hora_fin && !validarHora(hora_fin)) {
        return res.status(400).json({ success: false, error: 'Formato de hora de fin inválido' });
      }

      const { data: reservasConflictivas, error: disponibilidadError } = await supabase
        .from('reservas')
        .select('id')
        .eq('pista_id', pistaId)
        .eq('fecha', fechaReserva)
        .neq('id', reservaId)
        .neq('estado', 'cancelada')
        .or(`and(hora_inicio.lt.${horaFin},hora_fin.gt.${horaInicio}),and(hora_inicio.gte.${horaInicio},hora_inicio.lt.${horaFin}),and(hora_fin.gt.${horaInicio},hora_fin.lte.${horaFin})`);

      if (disponibilidadError) {
        console.error('❌ Error al comprobar disponibilidad:', disponibilidadError);
        return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
      }
      
      if (reservasConflictivas && reservasConflictivas.length > 0) {
        console.log('🚫 Conflicto de disponibilidad encontrado:', reservasConflictivas.length);
        return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });
      }

      console.log('✅ Disponibilidad verificada - Sin conflictos');
    }

    let nuevoPolideportivoId = null;
    if (pista_id && pista_id !== reservaActual.pista_id) {
      console.log('🔄 Cambiando pista, obteniendo nuevo polideportivo_id');
      const { data: pista, error: pistaError } = await supabase
        .from('pistas')
        .select('polideportivo_id')
        .eq('id', pista_id)
        .single();

      if (pistaError || !pista) {
        return res.status(400).json({ success: false, error: 'Pista no encontrada' });
      }

      nuevoPolideportivoId = pista.polideportivo_id;
      console.log('📍 Nuevo polideportivo_id:', nuevoPolideportivoId);
    }

    const updateData = {};

    if (pista_id !== undefined) updateData.pista_id = pista_id;
    if (fecha !== undefined) {
      const fechaFormateada = formatearFecha(fecha);
      if (!fechaFormateada) {
        return res.status(400).json({ success: false, error: 'Fecha inválida' });
      }
      updateData.fecha = fechaFormateada;
    }
    if (hora_inicio !== undefined) {
      if (!validarHora(hora_inicio)) {
        return res.status(400).json({ success: false, error: 'Formato de hora de inicio inválido' });
      }
      updateData.hora_inicio = hora_inicio;
    }
    if (hora_fin !== undefined) {
      if (!validarHora(hora_fin)) {
        return res.status(400).json({ success: false, error: 'Formato de hora de fin inválido' });
      }
      updateData.hora_fin = hora_fin;
    }
    if (precio !== undefined) {
      const precioNum = parseFloat(precio);
      if (isNaN(precioNum)) {
        return res.status(400).json({ success: false, error: 'Precio inválido' });
      }
      updateData.precio = precioNum;
    }
    if (estado !== undefined) updateData.estado = estado;
    if (nuevoPolideportivoId !== null) updateData.polideportivo_id = nuevoPolideportivoId;

    if (Object.keys(updateData).length === 0) {
      console.log('❌ No hay campos para actualizar');
      return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
    }

    console.log('🔄 Campos a actualizar:', updateData);

    const { data: reservaActualizada, error: updateError } = await supabase
      .from('reservas')
      .update(updateData)
      .eq('id', reservaId)
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar reserva:', updateError);
      return res.status(500).json({ success: false, error: 'Error al actualizar reserva en la base de datos' });
    }

    console.log('✅ Reserva actualizada en BD. ID:', reservaActualizada.id);

    const reservaConLudoteca = {
      ...reservaActualizada,
      ludoteca: ludoteca,
      pistaNombre: reservaActualizada.pistas?.nombre,
      pistaTipo: reservaActualizada.pistas?.tipo,
      polideportivo_nombre: reservaActualizada.polideportivos?.nombre
    };

    console.log('🎉 Reserva actualizada correctamente ID:', reservaId);
    
    res.json({ 
      success: true, 
      data: reservaConLudoteca, 
      message: 'Reserva actualizada correctamente' 
    });

  } catch (error) {
    console.error('❌ Error al actualizar reserva:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;