const express = require('express');
const router = express.Router();

// Importar middlewares y roles desde usuarios
const { verificarRol, filtrarPorPolideportivo, ROLES, NIVELES_PERMISO } = require('./usuarios');

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Obtener todos los polideportivos (público)
router.get('/', async (req, res) => {
  const supabase = req.app.get('supabase');

  try {
    const { data: polideportivos, error } = await supabase
      .from('polideportivos')
      .select('*')
      .order('nombre');

    if (error) {
      console.error('❌ Error al obtener polideportivos:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener polideportivos' 
      });
    }

    res.json({
      success: true,
      data: polideportivos
    });
  } catch (error) {
    console.error('❌ Error al obtener polideportivos:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener polideportivos' 
    });
  }
});

// Obtener un polideportivo por ID (público)
router.get('/:id', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  try {
    const { data: polideportivo, error } = await supabase
      .from('polideportivos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error al obtener polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener polideportivo' 
      });
    }

    if (!polideportivo) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    res.json({
      success: true,
      data: polideportivo
    });
  } catch (error) {
    console.error('❌ Error al obtener polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener polideportivo' 
    });
  }
});

// ============================================
// RUTAS PARA SUPER_ADMIN (solo super_admin)
// ============================================

// Crear nuevo polideportivo (solo super_admin)
router.post('/', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  const supabase = req.app.get('supabase');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

  console.log(`🏢 [POST] Creando polideportivo por super_admin ${req.user?.id}:`, { nombre });

  try {
    // Verificar si ya existe un polideportivo con el mismo nombre
    const { data: polideportivoExistente, error: checkError } = await supabase
      .from('polideportivos')
      .select('id')
      .eq('nombre', nombre)
      .single();

    if (polideportivoExistente) {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe un polideportivo con ese nombre' 
      });
    }

    // Insertar nuevo polideportivo
    const { data: nuevoPolideportivo, error: insertError } = await supabase
      .from('polideportivos')
      .insert([{
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono ? telefono.trim() : null
      }])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error al crear polideportivo:', insertError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al crear polideportivo' 
      });
    }

    console.log(`✅ Polideportivo creado: ${nuevoPolideportivo.id} - ${nuevoPolideportivo.nombre}`);

    res.status(201).json({
      success: true,
      data: nuevoPolideportivo,
      message: 'Polideportivo creado correctamente'
    });

  } catch (error) {
    console.error('❌ Error al crear polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al crear polideportivo' 
    });
  }
});

// Actualizar polideportivo (solo super_admin)
router.put('/:id', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono } = req.body;
  const supabase = req.app.get('supabase');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

  console.log(`🔄 [PUT] Actualizando polideportivo ${id} por super_admin ${req.user?.id}`);

  try {
    // Verificar que el polideportivo existe
    const { data: polideportivoExistente, error: checkError } = await supabase
      .from('polideportivos')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !polideportivoExistente) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    // Verificar si ya existe otro polideportivo con el mismo nombre
    const { data: polideportivoConMismoNombre, error: nombreError } = await supabase
      .from('polideportivos')
      .select('id')
      .eq('nombre', nombre)
      .neq('id', id)
      .single();

    if (polideportivoConMismoNombre) {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe otro polideportivo con ese nombre' 
      });
    }

    // Actualizar polideportivo
    const { data: polideportivoActualizado, error: updateError } = await supabase
      .from('polideportivos')
      .update({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono ? telefono.trim() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar polideportivo:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar polideportivo' 
      });
    }

    console.log(`✅ Polideportivo actualizado: ${id} - ${nombre}`);

    res.json({
      success: true,
      data: polideportivoActualizado,
      message: 'Polideportivo actualizado correctamente'
    });

  } catch (error) {
    console.error('❌ Error al actualizar polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar polideportivo' 
    });
  }
});

// ✅ CORREGIDA: Eliminar polideportivo (solo super_admin) - CON LOGGING DETALLADO
router.delete('/:id', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  const { id } = req.params;
  const supabase = req.app.get('supabase');

  console.log(`=== 🗑️ [DELETE] SOLICITUD ELIMINAR POLIDEPORTIVO ===`);
  console.log(`📋 ID Polideportivo: ${id}`);
  console.log(`👤 Usuario ID: ${req.user?.id}`);
  console.log(`👑 Rol Usuario: ${req.user?.rol}`);
  console.log(`📧 Email Usuario: ${req.user?.correo}`);
  console.log(`🔑 Headers Auth: ${req.headers['authorization']?.substring(0, 20)}...`);

  try {
    // 1. Verificar que el polideportivo existe
    console.log(`🔍 Verificando existencia del polideportivo ${id}...`);
    const { data: polideportivo, error: checkError } = await supabase
      .from('polideportivos')
      .select('id, nombre')
      .eq('id', id)
      .single();

    if (checkError || !polideportivo) {
      console.error(`❌ Polideportivo ${id} no encontrado en BD. Error:`, checkError);
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    console.log(`✅ Polideportivo encontrado: ${polideportivo.nombre} (ID: ${polideportivo.id})`);

    // 2. Verificar si hay pistas asociadas a este polideportivo
    console.log(`🔍 Verificando pistas asociadas al polideportivo ${id}...`);
    const { data: pistas, error: pistasError } = await supabase
      .from('pistas')
      .select('id, nombre')
      .eq('polideportivo_id', id);

    if (pistasError) {
      console.error('❌ Error al verificar pistas asociadas:', pistasError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar pistas asociadas' 
      });
    }

    if (pistas && pistas.length > 0) {
      const pistasNombres = pistas.map(p => p.nombre).join(', ');
      console.error(`❌ NO se puede eliminar: ${pistas.length} pistas asociadas encontradas:`, pistasNombres);
      return res.status(409).json({ 
        success: false,
        error: `No se puede eliminar el polideportivo porque tiene ${pistas.length} pista(s) asociada(s): ${pistasNombres}. Elimine primero las pistas.` 
      });
    }

    console.log(`✅ No hay pistas asociadas al polideportivo ${id}`);

    // 3. Verificar si hay administradores asignados a este polideportivo
    console.log(`🔍 Verificando administradores asignados al polideportivo ${id}...`);
    const { data: adminsAsignados, error: adminsError } = await supabase
      .from('usuarios')
      .select('id, nombre, usuario, correo')
      .eq('polideportivo_id', id)
      .eq('rol', ROLES.ADMIN_POLIDEPORTIVO);

    if (adminsError) {
      console.error('❌ Error al verificar administradores:', adminsError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar administradores asignados' 
      });
    }

    if (adminsAsignados && adminsAsignados.length > 0) {
      const adminsNombres = adminsAsignados.map(a => a.nombre || a.usuario).join(', ');
      console.error(`❌ NO se puede eliminar: ${adminsAsignados.length} administradores asignados encontrados:`, adminsNombres);
      return res.status(409).json({ 
        success: false,
        error: `No se puede eliminar el polideportivo porque tiene ${adminsAsignados.length} administrador(es) asignado(s): ${adminsNombres}. Reasigne primero los administradores.` 
      });
    }

    console.log(`✅ No hay administradores asignados al polideportivo ${id}`);

    // 4. Eliminar polideportivo - VERSIÓN ROBUSTA
    console.log(`🚀 Iniciando eliminación del polideportivo ${id}...`);
    
    // Primero, obtener todos los datos del polideportivo para logging
    const { data: poliCompleto, error: fetchError } = await supabase
      .from('polideportivos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!fetchError && poliCompleto) {
      console.log(`📊 Datos completos del polideportivo a eliminar:`, poliCompleto);
    }

    // Intento de eliminación
    const { error: deleteError, count } = await supabase
      .from('polideportivos')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (deleteError) {
      console.error(`❌ ERROR CRÍTICO al eliminar polideportivo en Supabase:`, deleteError);
      console.error(`🔧 Detalles del error:`, {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint
      });
      
      return res.status(500).json({ 
        success: false,
        error: `Error al eliminar polideportivo: ${deleteError.message || 'Error de base de datos'}`,
        details: deleteError.details,
        code: deleteError.code
      });
    }

    console.log(`✅ ELIMINACIÓN EXITOSA: Polideportivo eliminado de la BD`);
    console.log(`📊 Resultado: ${count || 1} fila(s) afectada(s)`);
    console.log(`🗑️ Polideportivo eliminado: ${id} - ${polideportivo.nombre}`);

    // 5. Verificar que realmente se eliminó
    console.log(`🔍 Verificando que el polideportivo ya no existe...`);
    const { data: verificacion, error: verifyError } = await supabase
      .from('polideportivos')
      .select('id')
      .eq('id', id)
      .single();

    if (!verifyError && verificacion) {
      console.error(`⚠️ ADVERTENCIA: El polideportivo ${id} sigue existiendo después de la eliminación`);
    } else {
      console.log(`✅ Verificación OK: Polideportivo ${id} correctamente eliminado`);
    }

    res.json({ 
      success: true,
      message: 'Polideportivo eliminado correctamente',
      data: { 
        id, 
        nombre: polideportivo.nombre,
        timestamp: new Date().toISOString(),
        deleted_by: req.user?.id
      }
    });

  } catch (error) {
    console.error('❌ ERROR GENERAL en ruta DELETE /polideportivos/:id:', error);
    console.error('🔧 Stack trace:', error.stack);
    
    return res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor al eliminar polideportivo',
      internal_error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// RUTAS ESPECIALES PARA ADMIN_POLI
// ============================================

// Obtener detalles de MI polideportivo (para admin_poli)
router.get('/mi-polideportivo', verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), async (req, res) => {
  const supabase = req.app.get('supabase');
  const adminId = req.user?.id;

  console.log(`🏢 Admin_poli ${adminId} solicitando su polideportivo`);

  try {
    // Obtener el polideportivo asignado al admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('polideportivo_id')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData || !adminData.polideportivo_id) {
      return res.status(404).json({ 
        success: false,
        error: 'No tienes un polideportivo asignado' 
      });
    }

    // Obtener los detalles del polideportivo
    const { data: polideportivo, error: poliError } = await supabase
      .from('polideportivos')
      .select(`
        *,
        pistas (id, nombre, tipo, precio, disponible)
      `)
      .eq('id', adminData.polideportivo_id)
      .single();

    if (poliError || !polideportivo) {
      console.error('Error al obtener polideportivo:', poliError);
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    // Contar reservas
    const { count: totalReservas, error: reservasError } = await supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .eq('polideportivo_id', polideportivo.id);

    // Contar reservas activas para hoy
    const hoy = new Date().toISOString().split('T')[0];
    const { count: reservasHoy, error: reservasHoyError } = await supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .eq('polideportivo_id', polideportivo.id)
      .eq('fecha', hoy)
      .in('estado', ['pendiente', 'confirmada']);

    // Contar pistas disponibles
    const { count: pistasDisponibles, error: pistasError } = await supabase
      .from('pistas')
      .select('*', { count: 'exact', head: true })
      .eq('polideportivo_id', polideportivo.id)
      .eq('disponible', true);

    // Contar administradores asignados
    const { count: totalAdmins, error: adminsError } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('polideportivo_id', polideportivo.id)
      .eq('rol', ROLES.ADMIN_POLIDEPORTIVO);

    const estadisticas = {
      total_pistas: polideportivo.pistas?.length || 0,
      pistas_disponibles: pistasDisponibles || 0,
      total_reservas: totalReservas || 0,
      reservas_hoy: reservasHoy || 0,
      total_admins: totalAdmins || 0
    };

    // Formatear respuesta
    const respuesta = {
      ...polideportivo,
      pistas: polideportivo.pistas || [],
      estadisticas
    };

    res.json({
      success: true,
      data: respuesta
    });

  } catch (error) {
    console.error('Error al obtener mi polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener polideportivo' 
    });
  }
});

// Obtener estadísticas de mi polideportivo (para admin_poli)
router.get('/mi-polideportivo/estadisticas', verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), async (req, res) => {
  const supabase = req.app.get('supabase');
  const { periodo = 'mes' } = req.query; // dia, semana, mes, año
  const adminId = req.user?.id;

  console.log(`📊 Estadísticas para admin_poli ${adminId}, periodo: ${periodo}`);

  try {
    // Obtener el polideportivo asignado al admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('polideportivo_id')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData || !adminData.polideportivo_id) {
      return res.status(404).json({ 
        success: false,
        error: 'No tienes un polideportivo asignado' 
      });
    }

    const polideportivoId = adminData.polideportivo_id;
    const hoy = new Date();
    let fechaInicio = new Date();
    
    // Calcular fecha de inicio según el periodo
    switch (periodo) {
      case 'dia':
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio.setDate(fechaInicio.getDate() - 7);
        break;
      case 'mes':
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
        break;
      case 'año':
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
        break;
      default:
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    }

    // Estadísticas de reservas
    const { data: reservasData, error: reservasError } = await supabase
      .from('reservas')
      .select('estado, precio, fecha')
      .eq('polideportivo_id', polideportivoId)
      .gte('fecha', fechaInicio.toISOString().split('T')[0])
      .lte('fecha', hoy.toISOString().split('T')[0]);

    if (reservasError) {
      console.error('Error al obtener estadísticas de reservas:', reservasError);
    }

    // Calcular estadísticas
    let totalReservas = 0;
    let reservasConfirmadas = 0;
    let reservasPendientes = 0;
    let reservasCanceladas = 0;
    let ingresosTotales = 0;
    const reservasPorDia = {};

    if (reservasData) {
      totalReservas = reservasData.length;
      reservasData.forEach(reserva => {
        if (reserva.estado === 'confirmada') {
          reservasConfirmadas++;
          ingresosTotales += parseFloat(reserva.precio || 0);
        } else if (reserva.estado === 'pendiente') {
          reservasPendientes++;
        } else if (reserva.estado === 'cancelada') {
          reservasCanceladas++;
        }

        // Agrupar por día
        const fecha = reserva.fecha;
        if (reservasPorDia[fecha]) {
          reservasPorDia[fecha]++;
        } else {
          reservasPorDia[fecha] = 1;
        }
      });
    }

    // Estadísticas de pistas
    const { data: pistasData, error: pistasError } = await supabase
      .from('pistas')
      .select('id, nombre, tipo, precio, disponible')
      .eq('polideportivo_id', polideportivoId);

    if (pistasError) {
      console.error('Error al obtener estadísticas de pistas:', pistasError);
    }

    let totalPistas = 0;
    let pistasDisponibles = 0;
    const pistasPorTipo = {};

    if (pistasData) {
      totalPistas = pistasData.length;
      pistasData.forEach(pista => {
        if (pista.disponible) {
          pistasDisponibles++;
        }

        if (pistasPorTipo[pista.tipo]) {
          pistasPorTipo[pista.tipo]++;
        } else {
          pistasPorTipo[pista.tipo] = 1;
        }
      });
    }

    const estadisticas = {
      periodo: {
        tipo: periodo,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_fin: hoy.toISOString().split('T')[0]
      },
      reservas: {
        total: totalReservas,
        confirmadas: reservasConfirmadas,
        pendientes: reservasPendientes,
        canceladas: reservasCanceladas,
        tasa_confirmacion: totalReservas > 0 ? (reservasConfirmadas / totalReservas * 100).toFixed(1) + '%' : '0%',
        por_dia: reservasPorDia
      },
      ingresos: {
        total: parseFloat(ingresosTotales.toFixed(2)),
        promedio_por_reserva: reservasConfirmadas > 0 ? parseFloat((ingresosTotales / reservasConfirmadas).toFixed(2)) : 0
      },
      pistas: {
        total: totalPistas,
        disponibles: pistasDisponibles,
        tasa_disponibilidad: totalPistas > 0 ? (pistasDisponibles / totalPistas * 100).toFixed(1) + '%' : '0%',
        por_tipo: pistasPorTipo
      }
    };

    res.json({
      success: true,
      data: estadisticas
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener estadísticas' 
    });
  }
});

// ============================================
// RUTA PARA OBTENER POLIDEPORTIVOS CON ESTADÍSTICAS (para admin/super_admin)
// ============================================

router.get('/con-estadisticas', verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), async (req, res) => {
  const supabase = req.app.get('supabase');
  const usuario = req.user;

  try {
    let query = supabase
      .from('polideportivos')
      .select('*');

    // Si no es super_admin, filtrar por su polideportivo asignado
    if (usuario.rol !== ROLES.SUPER_ADMIN) {
      query = query.eq('id', usuario.polideportivo_id);
    }

    const { data: polideportivos, error } = await query.order('nombre');

    if (error) {
      console.error('Error al obtener polideportivos:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener polideportivos' 
      });
    }

    // Para cada polideportivo, obtener estadísticas
    const polideportivosConEstadisticas = await Promise.all(
      polideportivos.map(async (poli) => {
        // Contar pistas
        const { count: totalPistas, error: pistasError } = await supabase
          .from('pistas')
          .select('*', { count: 'exact', head: true })
          .eq('polideportivo_id', poli.id);

        // Contar pistas disponibles
        const { count: pistasDisponibles, error: disponiblesError } = await supabase
          .from('pistas')
          .select('*', { count: 'exact', head: true })
          .eq('polideportivo_id', poli.id)
          .eq('disponible', true);

        // Contar reservas del mes actual
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        
        const { count: reservasMes, error: reservasError } = await supabase
          .from('reservas')
          .select('*', { count: 'exact', head: true })
          .eq('polideportivo_id', poli.id)
          .gte('fecha', primerDiaMes.toISOString().split('T')[0])
          .lte('fecha', ultimoDiaMes.toISOString().split('T')[0]);

        return {
          ...poli,
          estadisticas: {
            total_pistas: totalPistas || 0,
            pistas_disponibles: pistasDisponibles || 0,
            reservas_mes_actual: reservasMes || 0
          }
        };
      })
    );

    res.json({
      success: true,
      data: polideportivosConEstadisticas
    });

  } catch (error) {
    console.error('Error al obtener polideportivos con estadísticas:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener polideportivos' 
    });
  }
});

module.exports = router;