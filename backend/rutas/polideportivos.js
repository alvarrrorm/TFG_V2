const express = require('express');
const router = express.Router();

// Importar middlewares y roles desde usuarios
const { verificarRol, filtrarPorPolideportivo, ROLES, NIVELES_PERMISO } = require('./usuarios');

// Middleware de autenticación (si no está importado de server)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Token de autenticación requerido' 
    });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Token inválido o expirado' 
      });
    }
    
    req.user = user;
    next();
  });
};

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
      console.error('Error al obtener polideportivos:', error);
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
    console.error('Error al obtener polideportivos:', error);
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
      console.error('Error al obtener polideportivo:', error);
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
    console.error('Error al obtener polideportivo:', error);
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

  console.log(`🏢 Creando polideportivo por super_admin ${req.user?.id}:`, { nombre });

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
      console.error('Error al crear polideportivo:', insertError);
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
    console.error('Error al crear polideportivo:', error);
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

  console.log(`🔄 Actualizando polideportivo ${id} por super_admin ${req.user?.id}`);

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
      console.error('Error al actualizar polideportivo:', updateError);
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
    console.error('Error al actualizar polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar polideportivo' 
    });
  }
});

// Eliminar polideportivo (solo super_admin)
router.delete('/:id', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  const { id } = req.params;
  const supabase = req.app.get('supabase');

  console.log(`🗑️ Eliminando polideportivo ${id} por super_admin ${req.user?.id}`);

  try {
    // Verificar que el polideportivo existe
    const { data: polideportivo, error: checkError } = await supabase
      .from('polideportivos')
      .select('id, nombre')
      .eq('id', id)
      .single();

    if (checkError || !polideportivo) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    // Verificar si hay pistas asociadas a este polideportivo
    const { data: pistas, error: pistasError } = await supabase
      .from('pistas')
      .select('id, nombre')
      .eq('polideportivo_id', id);

    if (pistasError) {
      console.error('Error al verificar pistas asociadas:', pistasError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar pistas asociadas' 
      });
    }

    if (pistas && pistas.length > 0) {
      const pistasNombres = pistas.map(p => p.nombre).join(', ');
      return res.status(409).json({ 
        success: false,
        error: `No se puede eliminar el polideportivo porque tiene ${pistas.length} pista(s) asociada(s): ${pistasNombres}. Elimine primero las pistas.` 
      });
    }

    // Verificar si hay administradores asignados a este polideportivo
    const { data: adminsAsignados, error: adminsError } = await supabase
      .from('usuarios')
      .select('id, nombre, usuario')
      .eq('polideportivo_id', id)
      .eq('rol', ROLES.ADMIN_POLIDEPORTIVO);

    if (adminsError) {
      console.error('Error al verificar administradores:', adminsError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar administradores asignados' 
      });
    }

    if (adminsAsignados && adminsAsignados.length > 0) {
      const adminsNombres = adminsAsignados.map(a => a.nombre || a.usuario).join(', ');
      return res.status(409).json({ 
        success: false,
        error: `No se puede eliminar el polideportivo porque tiene ${adminsAsignados.length} administrador(es) asignado(s): ${adminsNombres}. Reasigne primero los administradores.` 
      });
    }

    // Eliminar polideportivo
    const { error: deleteError } = await supabase
      .from('polideportivos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error al eliminar polideportivo:', deleteError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al eliminar polideportivo' 
      });
    }

    console.log(`✅ Polideportivo eliminado: ${id} - ${polideportivo.nombre}`);

    res.json({ 
      success: true,
      message: 'Polideportivo eliminado correctamente',
      data: { id, nombre: polideportivo.nombre }
    });

  } catch (error) {
    console.error('Error al eliminar polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al eliminar polideportivo' 
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
        pistas (id, nombre, tipo, precio, disponible),
        reservas!inner(count),
        usuarios!inner(count)  # Para contar admins asignados
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

    // Contar reservas activas (pendientes y confirmadas) para hoy
    const hoy = new Date().toISOString().split('T')[0];
    const { count: reservasHoy, error: reservasError } = await supabase
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

    const estadisticas = {
      total_pistas: polideportivo.pistas?.length || 0,
      pistas_disponibles: pistasDisponibles || 0,
      total_reservas: polideportivo.reservas?.[0]?.count || 0,
      reservas_hoy: reservasHoy || 0,
      total_admins: polideportivo.usuarios?.[0]?.count || 0
    };

    // Formatear respuesta
    const respuesta = {
      ...polideportivo,
      pistas: polideportivo.pistas || [],
      estadisticas
    };

    // Eliminar campos de conteo para limpiar la respuesta
    delete respuesta.reservas;
    delete respuesta.usuarios;

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

module.exports = router;