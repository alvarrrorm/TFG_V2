const express = require('express');
const router = express.Router();

// 👇 FUNCIÓN REUTILIZABLE PARA FORMATEAR FECHA
const formatearFecha = (fechaInput) => {
  if (!fechaInput) return null;
  
  console.log('🔄 Formateando fecha recibida:', fechaInput, 'Tipo:', typeof fechaInput);
  
  // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
  if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
    console.log('✅ Fecha ya en formato correcto:', fechaInput);
    return fechaInput;
  }
  
  // Si es un string ISO (con hora y timezone), extraer solo la fecha
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
  
  // Si es un objeto Date
  if (fechaInput instanceof Date) {
    if (isNaN(fechaInput.getTime())) {
      console.error('❌ Objeto Date inválido');
      return null;
    }
    
    const año = fechaInput.getFullYear();
    const mes = String(fechaInput.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaInput.getDate()).padStart(2, '0');
    
    const fechaFormateada = `${año}-${mes}-${dia}`;
    console.log('📅 Objeto Date convertido:', fechaInput, '→', fechaFormateada);
    return fechaFormateada;
  }
  
  // Si es un timestamp numérico
  if (typeof fechaInput === 'number') {
    try {
      const fechaObj = new Date(fechaInput);
      if (isNaN(fechaObj.getTime())) {
        console.error('❌ Timestamp inválido:', fechaInput);
        return null;
      }
      
      const año = fechaObj.getFullYear();
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      
      const fechaFormateada = `${año}-${mes}-${dia}`;
      console.log('📅 Timestamp convertido:', fechaInput, '→', fechaFormateada);
      return fechaFormateada;
    } catch (error) {
      console.error('❌ Error formateando timestamp:', error);
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

// Crear una reserva
router.post('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const {
    dni_usuario,
    nombre_usuario,
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    ludoteca = false,
    estado = 'pendiente',
    precio
  } = req.body;

  console.log('📥 Creando nueva reserva con datos:', {
    nombre_usuario, pista_id, fecha, hora_inicio, hora_fin, ludoteca, precio
  });

  // Validaciones básicas
  if (!nombre_usuario || !pista_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }

  if (!validarHora(hora_inicio) || !validarHora(hora_fin)) {
    return res.status(400).json({ success: false, error: 'Formato de hora inválido' });
  }

  const pistaId = Number(pista_id);
  if (isNaN(pistaId)) {
    return res.status(400).json({ success: false, error: 'ID de pista inválido' });
  }

  // Formatear fecha
  const fechaFormateada = formatearFecha(fecha);
  if (!fechaFormateada) {
    return res.status(400).json({ success: false, error: 'Fecha inválida' });
  }

  console.log('📅 Fecha formateada:', fechaFormateada);

  try {
    // Primero obtener información de la pista y su polideportivo
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
      return res.status(404).json({ success: false, error: 'Pista no encontrada o no disponible' });
    }

    const polideportivoId = pistas.polideportivo_id;
    console.log('📍 Pista seleccionada:', pistas.nombre, 'Polideportivo:', polideportivoId);

    // 👇 OBTENER EL USUARIO_ID REAL BASADO EN EL NOMBRE_USUARIO
    const { data: usuarios, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, correo, nombre')
      .or(`nombre.eq.${nombre_usuario},usuario.eq.${nombre_usuario}`)
      .limit(1);

    if (usuarioError) {
      console.error('❌ Error al obtener información del usuario:', usuarioError);
      return res.status(500).json({ success: false, error: 'Error al obtener información del usuario' });
    }

    let usuarioId = 0;
    let usuarioEmail = '';
    let nombreUsuarioReal = nombre_usuario;

    if (usuarios && usuarios.length > 0) {
      usuarioId = usuarios[0].id;
      usuarioEmail = usuarios[0].correo;
      nombreUsuarioReal = usuarios[0].nombre || nombre_usuario;
      console.log('👤 Usuario encontrado - ID:', usuarioId, 'Email:', usuarioEmail, 'Nombre:', nombreUsuarioReal);
    } else {
      console.log('⚠️  Usuario no encontrado, usando ID temporal 0');
      console.log('💡 Buscando usuario con nombre:', nombre_usuario);
    }

    // Comprobar disponibilidad de la pista
    const { data: reservasConflictivas, error: disponibilidadError } = await supabase
      .from('reservas')
      .select('id')
      .eq('pista_id', pistaId)
      .eq('fecha', fechaFormateada)
      .neq('estado', 'cancelada')
      .or(`and(hora_inicio.lt.${hora_fin},hora_fin.gt.${hora_inicio}),and(hora_inicio.gte.${hora_inicio},hora_inicio.lt.${hora_fin}),and(hora_fin.gt.${hora_inicio},hora_fin.lte.${hora_fin})`);

    if (disponibilidadError) {
      console.error('❌ Error al comprobar disponibilidad:', disponibilidadError);
      return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
    }
    
    if (reservasConflictivas && reservasConflictivas.length > 0) {
      console.log('🚫 Pista no disponible - Conflictos encontrados:', reservasConflictivas.length);
      return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });
    }

    // Comprobar que el usuario no tenga otra reserva en ese horario
    const { data: reservasUsuario, error: usuarioReservaError } = await supabase
      .from('reservas')
      .select('id')
      .eq('nombre_usuario', nombre_usuario)
      .eq('fecha', fechaFormateada)
      .neq('estado', 'cancelada')
      .or(`and(hora_inicio.lt.${hora_fin},hora_fin.gt.${hora_inicio}),and(hora_inicio.gte.${hora_inicio},hora_inicio.lt.${hora_fin}),and(hora_fin.gt.${hora_inicio},hora_fin.lte.${hora_fin})`);

    if (usuarioReservaError) {
      console.error('❌ Error al comprobar reservas del usuario:', usuarioReservaError);
      return res.status(500).json({ success: false, error: 'Error al comprobar reservas del usuario' });
    }
    
    if (reservasUsuario && reservasUsuario.length > 0) {
      console.log('🚫 Usuario ya tiene reserva en ese horario');
      return res.status(409).json({ success: false, error: 'Ya tienes otra reserva en este horario' });
    }

    // Calcular precio si no se envió
    let precioFinal = precio;
    if (precio === undefined) {
      const precioHora = parseFloat(pistas.precio);
      if (isNaN(precioHora)) {
        return res.status(500).json({ success: false, error: 'Precio de la pista inválido' });
      }

      // Calcular duración en horas
      const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
      const [hFin, mFin] = hora_fin.split(':').map(Number);
      const duracion = ((hFin * 60 + mFin) - (hInicio * 60 + mInicio)) / 60;
      
      if (duracion <= 0) {
        return res.status(400).json({ success: false, error: 'La hora de fin debe ser posterior a la hora de inicio' });
      }

      precioFinal = parseFloat((precioHora * duracion).toFixed(2));

      // Añadir suplemento de ludoteca
      if (ludoteca) {
        precioFinal += 5;
      }
    }

    console.log('💰 Precio calculado:', precioFinal);

    // 👇 INSERTAR RESERVA CON USUARIO_ID REAL
    const { data: nuevaReserva, error: insertError } = await supabase
      .from('reservas')
      .insert([{
        pista_id: pistaId,
        polideportivo_id: polideportivoId,
        usuario_id: usuarioId,
        nombre_usuario: nombreUsuarioReal,
        fecha: fechaFormateada,
        hora_inicio: hora_inicio,
        hora_fin: hora_fin,
        precio: precioFinal,
        estado: estado
      }])
      .select(`
        *,
        pistas!inner(nombre, tipo),
        polideportivos!inner(nombre)
      `)
      .single();

    if (insertError) {
      console.error('❌ Error al crear reserva:', insertError);
      return res.status(500).json({ success: false, error: 'Error al crear reserva' });
    }

    console.log('✅ Reserva creada con ID:', nuevaReserva.id);

    const reservaConLudoteca = {
      ...nuevaReserva,
      ludoteca: ludoteca,
      email: usuarioEmail,
      pistaNombre: nuevaReserva.pistas?.nombre,
      pistaTipo: nuevaReserva.pistas?.tipo,
      polideportivo_nombre: nuevaReserva.polideportivos?.nombre
    };

    console.log('🎉 Reserva creada exitosamente');
    console.log('📊 Datos reserva:', {
      id: nuevaReserva.id,
      usuario_id: nuevaReserva.usuario_id,
      nombre_usuario: nuevaReserva.nombre_usuario,
      email_disponible: !!usuarioEmail
    });

    res.status(201).json({ success: true, data: reservaConLudoteca });

  } catch (error) {
    console.error('❌ Error general al crear reserva:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
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

  // Formatear fecha
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
    // Primero obtener la reserva
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

    // Eliminar la reserva
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

// 👇 RUTA COMPLETAMENTE CORREGIDA PARA CONFIRMAR RESERVA Y ENVIAR EMAIL
router.put('/:id/confirmar', async (req, res) => {
  const supabase = req.app.get('supabase');
  const enviarEmailConfirmacion = req.app.get('enviarEmailConfirmacion');
  const obtenerEmailUsuario = req.app.get('obtenerEmailUsuario');
  const { id } = req.params;

  console.log('✅ Confirmando reserva ID:', id);

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  try {
    // 1. Primero actualizamos el estado de la reserva
    const { error: updateError } = await supabase
      .from('reservas')
      .update({ estado: 'confirmada' })
      .eq('id', reservaId)
      .eq('estado', 'pendiente');

    if (updateError) {
      console.error('❌ Error actualizando reserva:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }

    // 2. Obtenemos los datos COMPLETOS de la reserva
    const { data: reservas, error: queryError } = await supabase
      .from('reservas')
      .select(`
        *,
        polideportivos!inner(nombre),
        pistas!inner(nombre)
      `)
      .eq('id', reservaId)
      .single();

    if (queryError || !reservas) {
      console.error('❌ Error obteniendo datos de reserva:', queryError);
      return res.status(404).json({ 
        success: false, 
        error: 'Reserva no encontrada' 
      });
    }

    const reservaCompleta = reservas;

    console.log('👤 Datos obtenidos para el email:');
    console.log('   Usuario ID:', reservaCompleta.usuario_id);
    console.log('   Nombre Usuario:', reservaCompleta.nombre_usuario);
    console.log('   Polideportivo:', reservaCompleta.polideportivos?.nombre);
    console.log('   Pista:', reservaCompleta.pistas?.nombre);
    console.log('   Fecha:', reservaCompleta.fecha);
    console.log('   Horario:', reservaCompleta.hora_inicio, '-', reservaCompleta.hora_fin);
    console.log('   Precio:', reservaCompleta.precio);

    // 👇 OBTENER EL EMAIL DEL USUARIO DESDE LA BASE DE DATOS
    try {
      const usuario = await obtenerEmailUsuario(reservaCompleta.usuario_id);
      
      if (usuario && usuario.correo) {
        const reservaConEmail = {
          ...reservaCompleta,
          email: usuario.correo,
          nombre_usuario: usuario.nombre || reservaCompleta.nombre_usuario,
          polideportivo_nombre: reservaCompleta.polideportivos?.nombre,
          pista_nombre: reservaCompleta.pistas?.nombre
        };

        console.log('📧 Email del usuario obtenido:', usuario.correo);

        // Enviar email
        try {
          await enviarEmailConfirmacion(reservaConEmail);
          console.log('✅ Email enviado exitosamente');
          
          // Respuesta de éxito con email
          const reservaActualizada = {
            ...reservaCompleta,
            ludoteca: false,
            pistaNombre: reservaCompleta.pistas?.nombre,
            polideportivo_nombre: reservaCompleta.polideportivos?.nombre
          };

          res.json({
            success: true,
            message: 'Reserva confirmada y email de confirmación enviado correctamente',
            data: reservaActualizada
          });
          
        } catch (emailError) {
          console.error('⚠️  Reserva confirmada pero error enviando email:', emailError);
          // Respuesta de éxito con error de email
          const reservaActualizada = {
            ...reservaCompleta,
            ludoteca: false,
            pistaNombre: reservaCompleta.pistas?.nombre,
            polideportivo_nombre: reservaCompleta.polideportivos?.nombre
          };

          res.json({
            success: true,
            message: 'Reserva confirmada correctamente',
            data: reservaActualizada,
            warning: 'No se pudo enviar el email de confirmación - error en el servicio de email'
          });
        }
        
      } else {
        console.log('⚠️  Usuario no tiene email registrado o no se encontró');
        console.log('💡 Usuario ID en reserva:', reservaCompleta.usuario_id);
        // Respuesta de éxito sin email
        const reservaActualizada = {
          ...reservaCompleta,
          ludoteca: false,
          pistaNombre: reservaCompleta.pistas?.nombre,
          polideportivo_nombre: reservaCompleta.polideportivos?.nombre
        };

        res.json({
          success: true,
          message: 'Reserva confirmada correctamente',
          data: reservaActualizada,
          warning: 'No se pudo enviar el email de confirmación - usuario no encontrado en el sistema'
        });
      }
    } catch (error) {
      console.error('❌ Error obteniendo email del usuario:', error);
      // Respuesta de éxito con error
      const reservaActualizada = {
        ...reservaCompleta,
        ludoteca: false,
        pistaNombre: reservaCompleta.pistas?.nombre,
        polideportivo_nombre: reservaCompleta.polideportivos?.nombre
      };

      res.json({
        success: true,
        message: 'Reserva confirmada correctamente',
        data: reservaActualizada,
        warning: 'No se pudo enviar el email de confirmación - error al obtener información del usuario'
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

// 👇 RUTA CORREGIDA PARA REENVIAR EMAIL DE CONFIRMACIÓN
router.post('/:id/reenviar-email', async (req, res) => {
  const supabase = req.app.get('supabase');
  const enviarEmailConfirmacion = req.app.get('enviarEmailConfirmacion');
  const obtenerEmailUsuario = req.app.get('obtenerEmailUsuario');
  const { id } = req.params;

  console.log(`📧 Reenviando email para reserva ID: ${id}`);

  try {
    // Obtener datos básicos de la reserva
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

    // Verificar que la reserva esté confirmada
    if (reserva.estado !== 'confirmada') {
      return res.status(400).json({ 
        success: false, 
        error: 'Solo se pueden reenviar emails de reservas confirmadas' 
      });
    }

    // Obtener email del usuario
    try {
      const usuario = await obtenerEmailUsuario(reserva.usuario_id);
      
      if (!usuario || !usuario.correo) {
        return res.status(400).json({ 
          success: false, 
          error: 'No se puede reenviar el email - usuario no tiene email registrado' 
        });
      }

      const reservaConEmail = {
        ...reserva,
        email: usuario.correo,
        nombre_usuario: usuario.nombre || reserva.nombre_usuario,
        polideportivo_nombre: reserva.polideportivos?.nombre,
        pista_nombre: reserva.pistas?.nombre
      };

      console.log('📧 Reenviando email a:', usuario.correo);

      // Enviar email
      try {
        await enviarEmailConfirmacion(reservaConEmail);

        console.log('✅ Email reenviado exitosamente a:', usuario.correo);

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
      console.error('❌ Error obteniendo email del usuario:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo información del usuario' 
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

    // Obtener reserva actualizada
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
    // Primero obtener la reserva actual
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
    
    // Verificar disponibilidad si se cambian datos de horario/pista
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

    // Obtener el polideportivo_id si se cambia la pista
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

    // Preparar datos para actualizar
    const updateData = {};

    // Campos a actualizar
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

    // Actualizar la reserva
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