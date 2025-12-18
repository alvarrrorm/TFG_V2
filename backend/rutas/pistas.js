const express = require('express');
const router = express.Router();

// Importar middlewares y roles desde usuarios
const { verificarRol, filtrarPorPolideportivo, ROLES, NIVELES_PERMISO } = require('./usuarios');

// Middleware de autenticación
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

// Obtener todas las pistas con información del polideportivo (público)
router.get('/', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { polideportivo_id, tipo } = req.query;

  console.log('🎾 Obteniendo pistas, filtros:', { polideportivo_id, tipo });

  try {
    let query = supabase
      .from('pistas')
      .select(`
        *,
        polideportivos:polideportivo_id (id, nombre, direccion, telefono)
      `)
      .order('id');

    // Aplicar filtros si existen
    if (polideportivo_id) {
      query = query.eq('polideportivo_id', polideportivo_id);
    }
    
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data: pistas, error } = await query;

    if (error) {
      console.error('Error al obtener pistas:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas' 
      });
    }

    const pistasFormateadas = (pistas || []).map(pista => ({
      id: pista.id,
      nombre: pista.nombre,
      tipo: pista.tipo,
      precio: parseFloat(pista.precio),
      polideportivo_id: pista.polideportivo_id,
      polideportivo_nombre: pista.polideportivos?.nombre,
      polideportivo_direccion: pista.polideportivos?.direccion,
      polideportivo_telefono: pista.polideportivos?.telefono,
      disponible: pista.disponible === true || pista.disponible === 1,
      created_at: pista.created_at,
      updated_at: pista.updated_at
    }));

    console.log(`✅ Encontradas ${pistasFormateadas.length} pistas`);

    res.json({
      success: true,
      data: pistasFormateadas
    });
  } catch (error) {
    console.error('Error al obtener pistas:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener pistas' 
    });
  }
});

// Obtener pistas disponibles (no en mantenimiento) con información del polideportivo (público)
router.get('/disponibles', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { polideportivo_id, tipo } = req.query;

  console.log('🎾 Obteniendo pistas disponibles, filtros:', { polideportivo_id, tipo });

  try {
    let query = supabase
      .from('pistas')
      .select(`
        id, nombre, tipo, precio, polideportivo_id,
        polideportivos:polideportivo_id (id, nombre)
      `)
      .eq('disponible', true)
      .order('tipo')
      .order('nombre');

    // Aplicar filtros si existen
    if (polideportivo_id) {
      query = query.eq('polideportivo_id', polideportivo_id);
    }
    
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data: pistas, error } = await query;

    if (error) {
      console.error('Error al obtener pistas disponibles:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas disponibles' 
      });
    }

    const pistasFormateadas = (pistas || []).map(pista => ({
      ...pista,
      polideportivo_nombre: pista.polideportivos?.nombre,
      precio: parseFloat(pista.precio)
    }));

    console.log(`✅ Encontradas ${pistasFormateadas.length} pistas disponibles`);

    res.json({
      success: true,
      data: pistasFormateadas
    });
  } catch (error) {
    console.error('Error al obtener pistas disponibles:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener pistas disponibles' 
    });
  }
});

// Obtener una pista por ID (público)
router.get('/:id', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  console.log('🔍 Obteniendo pista ID:', id);

  try {
    const { data: pista, error } = await supabase
      .from('pistas')
      .select(`
        *,
        polideportivos:polideportivo_id (id, nombre, direccion, telefono)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pista' 
      });
    }

    if (!pista) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    const pistaFormateada = {
      id: pista.id,
      nombre: pista.nombre,
      tipo: pista.tipo,
      precio: parseFloat(pista.precio),
      polideportivo_id: pista.polideportivo_id,
      polideportivo_nombre: pista.polideportivos?.nombre,
      polideportivo_direccion: pista.polideportivos?.direccion,
      polideportivo_telefono: pista.polideportivos?.telefono,
      disponible: pista.disponible === true || pista.disponible === 1,
      created_at: pista.created_at,
      updated_at: pista.updated_at
    };

    console.log(`✅ Pista encontrada: ${pistaFormateada.nombre}`);

    res.json({
      success: true,
      data: pistaFormateada
    });
  } catch (error) {
    console.error('Error al obtener pista:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener pista' 
    });
  }
});

// ============================================
// RUTAS PARA USUARIOS AUTENTICADOS
// ============================================

// Agregar nueva pista (super_admin puede crear en cualquier polideportivo, admin_poli solo en el suyo)
router.post('/', 
  authenticateToken,
  async (req, res) => {
    const { nombre, tipo, precio, descripcion, polideportivo_id } = req.body;
    const supabase = req.app.get('supabase');
    const user = req.user;

    console.log('➕ Creando pista:', { 
      nombre, 
      tipo, 
      precio, 
      descripcion,
      polideportivo_id,
      user_rol: user.rol,
      user_poli_id: user.polideportivo_id 
    });

    // Validaciones básicas
    if (!nombre || !tipo || precio === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Nombre, tipo y precio son obligatorios' 
      });
    }

    if (isNaN(parseFloat(precio)) || parseFloat(precio) <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio debe ser un número válido mayor a 0' 
      });
    }

    // Determinar el polideportivo_id basado en el rol del usuario
    let polideportivoIdFinal;

    if (user.rol === ROLES.SUPER_ADMIN) {
      // Super_admin puede especificar cualquier polideportivo
      if (!polideportivo_id) {
        return res.status(400).json({ 
          success: false,
          error: 'El super_admin debe especificar un polideportivo_id' 
        });
      }
      polideportivoIdFinal = polideportivo_id;
    } else if (user.rol === ROLES.ADMIN_POLIDEPORTIVO) {
      // Admin_poli solo puede crear pistas en su propio polideportivo
      if (!user.polideportivo_id) {
        return res.status(403).json({ 
          success: false,
          error: 'No tienes un polideportivo asignado' 
        });
      }
      polideportivoIdFinal = user.polideportivo_id;
      
      // Si intenta especificar otro polideportivo, lo ignoramos y usamos el suyo
      if (polideportivo_id && polideportivo_id !== user.polideportivo_id) {
        console.warn(`⚠️ Admin_poli ${user.id} intentó crear pista en polideportivo ${polideportivo_id}, pero se usará ${user.polideportivo_id}`);
      }
    } else {
      // Otros roles no pueden crear pistas
      return res.status(403).json({ 
        success: false,
        error: 'No tienes permisos para crear pistas' 
      });
    }

    try {
      // Verificar que el polideportivo existe
      const { data: polideportivo, error: polideportivoError } = await supabase
        .from('polideportivos')
        .select('id, nombre')
        .eq('id', polideportivoIdFinal)
        .single();

      if (polideportivoError || !polideportivo) {
        return res.status(400).json({ 
          success: false,
          error: 'El polideportivo no existe' 
        });
      }

      // Verificar si ya existe una pista con el mismo nombre en el mismo polideportivo
      const { data: pistaExistente, error: pistaError } = await supabase
        .from('pistas')
        .select('id')
        .eq('nombre', nombre.trim())
        .eq('polideportivo_id', polideportivoIdFinal)
        .single();

      if (pistaExistente) {
        return res.status(409).json({ 
          success: false,
          error: 'Ya existe una pista con ese nombre en este polideportivo' 
        });
      }

      // Validar que el tipo sea permitido
      const tiposPermitidos = ['Fútbol', 'Baloncesto', 'Tenis', 'Padel', 'Voley', 'Futbol Sala'];
      if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ 
          success: false,
          error: `Tipo no válido. Tipos permitidos: ${tiposPermitidos.join(', ')}` 
        });
      }

      // Insertar la nueva pista
      const nuevaPistaData = {
        nombre: nombre.trim(),
        tipo: tipo.trim(),
        precio: parseFloat(precio),
        polideportivo_id: polideportivoIdFinal,
        disponible: true
      };

      // Agregar descripción si se proporciona
      if (descripcion && descripcion.trim()) {
        nuevaPistaData.descripcion = descripcion.trim();
      }

      const { data: nuevaPista, error: insertError } = await supabase
        .from('pistas')
        .insert([nuevaPistaData])
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .single();

      if (insertError) {
        console.error('Error al agregar pista:', insertError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al agregar pista: ' + insertError.message 
        });
      }

      console.log(`✅ Pista creada: ${nuevaPista.id} - ${nuevaPista.nombre} en polideportivo ${polideportivo.nombre}`);

      const respuesta = {
        id: nuevaPista.id,
        nombre: nuevaPista.nombre,
        tipo: nuevaPista.tipo,
        precio: parseFloat(nuevaPista.precio),
        descripcion: nuevaPista.descripcion || null,
        polideportivo_id: nuevaPista.polideportivo_id,
        polideportivo_nombre: nuevaPista.polideportivos?.nombre,
        polideportivo_direccion: nuevaPista.polideportivos?.direccion,
        disponible: nuevaPista.disponible === true || nuevaPista.disponible === 1,
        created_at: nuevaPista.created_at,
        updated_at: nuevaPista.updated_at
      };

      res.status(201).json({
        success: true,
        data: respuesta,
        message: 'Pista creada correctamente'
      });

    } catch (error) {
      console.error('Error al agregar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al agregar pista' 
      });
    }
});

// ============================================
// RUTAS PARA ADMIN_POLI Y SUPER_ADMIN
// ============================================

// Obtener pistas de MI polideportivo (para admin_poli)
router.get('/mi-polideportivo/pistas', 
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), 
  filtrarPorPolideportivo, 
  async (req, res) => {
    const supabase = req.app.get('supabase');
    const { tipo, disponible } = req.query;

    console.log('🏢 Admin_poli obteniendo pistas de su polideportivo:', req.user?.polideportivo_id);

    if (!req.user?.polideportivo_id) {
      return res.status(403).json({ 
        success: false,
        error: 'No tienes un polideportivo asignado' 
      });
    }

    try {
      let query = supabase
        .from('pistas')
        .select(`
          *,
          polideportivos:polideportivo_id (id, nombre, direccion, telefono),
          reservas!left(count)  # Contar reservas de esta pista
        `)
        .eq('polideportivo_id', req.user.polideportivo_id)
        .order('tipo')
        .order('nombre');

      // Aplicar filtros si existen
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      if (disponible !== undefined) {
        query = query.eq('disponible', disponible === 'true');
      }

      const { data: pistas, error } = await query;

      if (error) {
        console.error('Error al obtener pistas del polideportivo:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al obtener pistas del polideportivo' 
        });
      }

      // Obtener estadísticas de reservas por pista
      const pistasConEstadisticas = await Promise.all((pistas || []).map(async (pista) => {
        // Obtener reservas activas de hoy para esta pista
        const hoy = new Date().toISOString().split('T')[0];
        const { count: reservasHoy, error: reservasError } = await supabase
          .from('reservas')
          .select('*', { count: 'exact', head: true })
          .eq('pista_id', pista.id)
          .eq('fecha', hoy)
          .in('estado', ['pendiente', 'confirmada']);

        // Obtener ingresos mensuales de esta pista
        const inicioMes = new Date();
        inicioMes.setDate(1);
        const { data: reservasMes, error: reservasMesError } = await supabase
          .from('reservas')
          .select('precio')
          .eq('pista_id', pista.id)
          .eq('estado', 'confirmada')
          .gte('fecha', inicioMes.toISOString().split('T')[0]);

        let ingresosMes = 0;
        if (reservasMes && !reservasMesError) {
          ingresosMes = reservasMes.reduce((total, reserva) => total + parseFloat(reserva.precio || 0), 0);
        }

        return {
          id: pista.id,
          nombre: pista.nombre,
          tipo: pista.tipo,
          precio: parseFloat(pista.precio),
          descripcion: pista.descripcion,
          polideportivo_id: pista.polideportivo_id,
          polideportivo_nombre: pista.polideportivos?.nombre,
          polideportivo_direccion: pista.polideportivos?.direccion,
          polideportivo_telefono: pista.polideportivos?.telefono,
          disponible: pista.disponible === true || pista.disponible === 1,
          created_at: pista.created_at,
          updated_at: pista.updated_at,
          estadisticas: {
            total_reservas: pista.reservas?.[0]?.count || 0,
            reservas_hoy: reservasHoy || 0,
            ingresos_mes: parseFloat(ingresosMes.toFixed(2)),
            popularidad: pista.reservas?.[0]?.count > 10 ? 'alta' : 
                        pista.reservas?.[0]?.count > 5 ? 'media' : 'baja'
          }
        };
      }));

      console.log(`✅ Encontradas ${pistasConEstadisticas.length} pistas en el polideportivo`);

      res.json({
        success: true,
        data: pistasConEstadisticas
      });
    } catch (error) {
      console.error('Error al obtener pistas del polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas del polideportivo' 
      });
    }
});

// ✅ CORREGIDO: Cambiar estado de mantenimiento - FUNCIONANDO
router.patch('/:id/mantenimiento', 
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), 
  async (req, res) => {
    const { id } = req.params;
    const { enMantenimiento } = req.body;
    const supabase = req.app.get('supabase');
    const user = req.user;

    console.log(`🛠️ Cambiando mantenimiento pista ${id}, enMantenimiento:`, enMantenimiento, 'usuario:', user.rol);

    // Verificar que el campo es booleano
    if (typeof enMantenimiento !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        error: 'El campo enMantenimiento debe ser un valor booleano (true/false)' 
      });
    }

    try {
      // Verificar que la pista existe
      let query = supabase
        .from('pistas')
        .select('id, polideportivo_id, nombre, disponible')
        .eq('id', id);

      // Si es admin_poli, solo puede modificar pistas de su polideportivo
      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pista, error: pistaError } = await query.single();

      if (pistaError || !pista) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
        });
      }

      console.log(`ℹ️ Pista actual estado: disponible = ${pista.disponible}, nuevo: enMantenimiento = ${enMantenimiento}`);

      // ✅ CORRECCIÓN: SI enMantenimiento = true, entonces disponible = false
      // ✅ SI enMantenimiento = false, entonces disponible = true
      const nuevoDisponible = !enMantenimiento;

      const updateData = { 
        disponible: nuevoDisponible,
        updated_at: new Date().toISOString()
      };

      // Actualizar estado en la base de datos
      const { data: pistaActualizada, error: updateError } = await supabase
        .from('pistas')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .single();

      if (updateError) {
        console.error('Error al actualizar estado:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar estado de mantenimiento: ' + updateError.message 
        });
      }

      console.log(`✅ Estado actualizado pista ${id}: disponible = ${pistaActualizada.disponible}`);

      const respuesta = {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        descripcion: pistaActualizada.descripcion,
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        created_at: pistaActualizada.created_at,
        updated_at: pistaActualizada.updated_at
      };

      res.json({
        success: true,
        data: respuesta,
        message: `Pista ${enMantenimiento ? 'puesta en mantenimiento' : 'reactivada'} correctamente`
      });

    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar estado de mantenimiento' 
      });
    }
});

// Actualizar precio de pista (admin_poli puede hacerlo en su polideportivo, super_admin en cualquiera)
router.patch('/:id/precio', 
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), 
  async (req, res) => {
    const { id } = req.params;
    const { precio } = req.body;
    const supabase = req.app.get('supabase');
    const user = req.user;

    console.log(`💰 Actualizando precio pista ${id}, nuevo precio:`, precio, 'usuario:', user.rol);

    if (precio === undefined || isNaN(parseFloat(precio))) {
      return res.status(400).json({ 
        success: false,
        error: 'Precio debe ser un número válido' 
      });
    }

    if (parseFloat(precio) <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio debe ser mayor a 0' 
      });
    }

    try {
      // Verificar que la pista existe
      let query = supabase
        .from('pistas')
        .select('id, polideportivo_id, nombre')
        .eq('id', id);

      // Si es admin_poli, solo puede modificar pistas de su polideportivo
      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pista, error: pistaError } = await query.single();

      if (pistaError || !pista) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
        });
      }

      // Actualizar precio
      const { data: pistaActualizada, error: updateError } = await supabase
        .from('pistas')
        .update({ 
          precio: parseFloat(precio),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .single();

      if (updateError) {
        console.error('Error al actualizar precio:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar precio' 
        });
      }

      console.log(`✅ Precio actualizado pista ${id}: ${pista.nombre} - $${parseFloat(precio).toFixed(2)}`);

      const respuesta = {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        descripcion: pistaActualizada.descripcion,
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        created_at: pistaActualizada.created_at,
        updated_at: pistaActualizada.updated_at
      };

      res.json({
        success: true,
        data: respuesta,
        message: 'Precio actualizado correctamente'
      });

    } catch (error) {
      console.error('Error al actualizar precio:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar precio' 
      });
    }
});

// ============================================
// RUTAS PARA SUPER_ADMIN Y ADMIN_POLI (edición completa)
// ============================================

// Actualizar pista completa (super_admin en cualquier pista, admin_poli solo en las de su polideportivo)
router.put('/:id', 
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), 
  async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, precio, descripcion } = req.body;
    const supabase = req.app.get('supabase');
    const user = req.user;

    console.log(`✏️ Actualizando pista ${id}:`, { 
      nombre, 
      tipo, 
      precio, 
      descripcion,
      user_rol: user.rol,
      user_poli_id: user.polideportivo_id 
    });

    try {
      // Verificar que la pista existe y tiene permisos para editarla
      let query = supabase
        .from('pistas')
        .select('id, polideportivo_id, nombre')
        .eq('id', id);

      // Si es admin_poli, solo puede modificar pistas de su polideportivo
      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pistaExistente, error: pistaError } = await query.single();

      if (pistaError || !pistaExistente) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
        });
      }

      // Preparar datos para actualizar
      const updateData = {};
      
      if (nombre !== undefined) updateData.nombre = nombre.trim();
      
      if (tipo !== undefined) {
        // Validar tipo
        const tiposPermitidos = ['Fútbol', 'Baloncesto', 'Tenis', 'Padel', 'Voley', 'Futbol Sala'];
        if (!tiposPermitidos.includes(tipo)) {
          return res.status(400).json({ 
            success: false,
            error: `Tipo no válido. Tipos permitidos: ${tiposPermitidos.join(', ')}` 
          });
        }
        updateData.tipo = tipo.trim();
      }
      
      if (precio !== undefined) {
        if (isNaN(parseFloat(precio)) || parseFloat(precio) <= 0) {
          return res.status(400).json({ 
            success: false,
            error: 'El precio debe ser un número válido mayor a 0' 
          });
        }
        updateData.precio = parseFloat(precio);
      }
      
      if (descripcion !== undefined) {
        updateData.descripcion = descripcion && descripcion.trim() ? descripcion.trim() : null;
      }
      
      updateData.updated_at = new Date().toISOString();

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionaron campos para actualizar' 
        });
      }

      // Si se cambia el nombre, verificar que no exista otra pista con el mismo nombre en el mismo polideportivo
      if (nombre !== undefined) {
        const polideportivoId = user.rol === ROLES.SUPER_ADMIN ? pistaExistente.polideportivo_id : user.polideportivo_id;
        
        const { data: pistaConMismoNombre, error: nombreError } = await supabase
          .from('pistas')
          .select('id')
          .eq('nombre', nombre.trim())
          .eq('polideportivo_id', polideportivoId)
          .neq('id', id)
          .single();

        if (pistaConMismoNombre) {
          return res.status(409).json({ 
            success: false,
            error: 'Ya existe una pista con ese nombre en este polideportivo' 
          });
        }
      }

      // Realizar actualización
      const { data: pistaActualizada, error: updateError } = await supabase
        .from('pistas')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          polideportivos:polideportivo_id (nombre, direccion)
        `)
        .single();

      if (updateError) {
        console.error('Error al actualizar pista:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar pista' 
        });
      }

      console.log(`✅ Pista actualizada: ${id} - ${pistaActualizada.nombre}`);

      const respuesta = {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        descripcion: pistaActualizada.descripcion,
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        created_at: pistaActualizada.created_at,
        updated_at: pistaActualizada.updated_at
      };

      res.json({
        success: true,
        data: respuesta,
        message: 'Pista actualizada correctamente'
      });

    } catch (error) {
      console.error('Error al actualizar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar pista' 
      });
    }
});

// Eliminar pista (solo super_admin)
router.delete('/:id', 
  verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), 
  async (req, res) => {
    const { id } = req.params;
    const supabase = req.app.get('supabase');

    console.log(`🗑️ Super_admin eliminando pista ID: ${id}`);

    try {
      // Verificar que la pista existe
      const { data: pista, error: pistaError } = await supabase
        .from('pistas')
        .select('id, nombre, polideportivo_id')
        .eq('id', id)
        .single();

      if (pistaError || !pista) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada' 
        });
      }

      // Verificar si hay reservas asociadas a esta pista
      const { data: reservas, error: reservasError } = await supabase
        .from('reservas')
        .select('id')
        .eq('pista_id', id)
        .neq('estado', 'cancelada')
        .limit(1);

      if (reservasError) {
        console.error('Error al verificar reservas:', reservasError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al verificar reservas asociadas' 
        });
      }

      if (reservas && reservas.length > 0) {
        return res.status(409).json({ 
          success: false,
          error: 'No se puede eliminar la pista porque tiene reservas activas' 
        });
      }

      // Eliminar pista
      const { error: deleteError } = await supabase
        .from('pistas')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error al eliminar pista:', deleteError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al eliminar pista' 
        });
      }

      console.log(`✅ Pista eliminada: ${id} - ${pista.nombre}`);

      res.json({ 
        success: true,
        message: 'Pista eliminada correctamente',
        data: { id, nombre: pista.nombre }
      });

    } catch (error) {
      console.error('Error al eliminar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al eliminar pista' 
      });
    }
});

module.exports = router;