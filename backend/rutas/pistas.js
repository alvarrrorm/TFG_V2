const express = require('express');
const router = express.Router();

// ✅ CORREGIDO: Importar correctamente desde usuarios
const { verificarRol, ROLES, NIVELES_PERMISO } = require('./usuarios');

// Middleware de autenticación (copia local para evitar problemas de importación)
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

// Middleware para verificar permisos
const verificarPermisosPista = (req, res, next) => {
  const user = req.user;
  
  // Solo super_admin, admin, y admin_poli pueden modificar pistas
  if (user.rol !== ROLES.SUPER_ADMIN && 
      user.rol !== ROLES.ADMIN && 
      user.rol !== ROLES.ADMIN_POLIDEPORTIVO) {
    return res.status(403).json({ 
      success: false,
      error: 'No tienes permisos para modificar pistas' 
    });
  }
  
  next();
};

// Función para obtener el cliente Supabase según el rol
const getSupabaseClient = (req) => {
  const supabasePublic = req.app.get('supabase');
  const supabaseAdmin = req.app.get('supabaseAdmin');
  const user = req.user;

  // Administradores usan Service Role Key (ignora RLS)
  if (user.rol === ROLES.SUPER_ADMIN || user.rol === ROLES.ADMIN || user.rol === ROLES.ADMIN_POLIDEPORTIVO) {
    return supabaseAdmin;
  }
  
  return supabasePublic;
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
      descripcion: pista.descripcion,
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
        id, nombre, tipo, precio, descripcion, polideportivo_id,
        polideportivos:polideportivo_id (id, nombre)
      `)
      .eq('disponible', true)
      .order('tipo')
      .order('nombre');

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
      descripcion: pista.descripcion,
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

// Agregar nueva pista
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

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio debe ser un número válido mayor a 0' 
      });
    }

    // Determinar el polideportivo_id basado en el rol del usuario
    let polideportivoIdFinal;

    if (user.rol === ROLES.SUPER_ADMIN || user.rol === ROLES.ADMIN) {
      if (!polideportivo_id) {
        return res.status(400).json({ 
          success: false,
          error: 'Debes especificar un polideportivo_id' 
        });
      }
      polideportivoIdFinal = polideportivo_id;
    } else if (user.rol === ROLES.ADMIN_POLIDEPORTIVO) {
      if (!user.polideportivo_id) {
        return res.status(403).json({ 
          success: false,
          error: 'No tienes un polideportivo asignado' 
      });
      }
      polideportivoIdFinal = user.polideportivo_id;
      
      if (polideportivo_id && polideportivo_id !== user.polideportivo_id) {
        console.warn(`⚠️ Admin_poli ${user.id} intentó crear pista en polideportivo ${polideportivo_id}, pero se usará ${user.polideportivo_id}`);
      }
    } else {
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
        precio: precioNum,
        polideportivo_id: polideportivoIdFinal,
        disponible: true
      };

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
// RUTAS PARA ACTUALIZAR PISTAS (COMPATIBLES CON FRONTEND)
// ============================================

// ✅ RUTA ÚNICA PARA ACTUALIZAR PISTA (usa el cliente correcto según rol)
router.put('/:id', 
  authenticateToken,
  verificarPermisosPista,
  async (req, res) => {
    const { id } = req.params;
    const { disponible, nombre, tipo, precio, descripcion } = req.body;
    const user = req.user;

    console.log(`🛠️ Actualizando pista ${id}:`, { 
      disponible, 
      nombre, 
      tipo, 
      precio, 
      descripcion: descripcion ? '...' : null,
      user_rol: user.rol 
    });

    try {
      // Obtener el cliente Supabase correcto (Admin para administradores)
      const supabaseClient = getSupabaseClient(req);
      
      // 1. Verificar que la pista existe y tiene permisos
      let query = supabaseClient
        .from('pistas')
        .select('id, polideportivo_id, nombre, disponible, tipo, precio, descripcion, created_at')
        .eq('id', id);

      // Si es admin_poli, solo puede modificar pistas de su polideportivo
      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pista, error: pistaError } = await query.maybeSingle();

      if (pistaError) {
        console.error('❌ Error buscando pista:', pistaError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al buscar la pista' 
        });
      }

      if (!pista) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
        });
      }

      // 2. Preparar datos para actualizar
      const updateData = {};
      
      if (typeof disponible !== 'undefined') {
        updateData.disponible = disponible;
      }
      
      if (nombre !== undefined && nombre.trim() !== '') {
        updateData.nombre = nombre.trim();
        
        // Verificar que no existe otra pista con el mismo nombre en el mismo polideportivo
        const polideportivoId = user.rol === ROLES.ADMIN_POLIDEPORTIVO ? user.polideportivo_id : pista.polideportivo_id;
        
        const { data: pistaConMismoNombre, error: nombreError } = await supabaseClient
          .from('pistas')
          .select('id')
          .eq('nombre', nombre.trim())
          .eq('polideportivo_id', polideportivoId)
          .neq('id', id)
          .maybeSingle();

        if (pistaConMismoNombre) {
          return res.status(409).json({ 
            success: false,
            error: 'Ya existe una pista con ese nombre en este polideportivo' 
          });
        }
      }
      
      if (tipo !== undefined && tipo.trim() !== '') {
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
        const precioNum = parseFloat(precio);
        if (isNaN(precioNum) || precioNum <= 0) {
          return res.status(400).json({ 
            success: false,
            error: 'El precio debe ser un número mayor que 0' 
          });
        }
        updateData.precio = precioNum;
      }
      
      if (descripcion !== undefined) {
        updateData.descripcion = descripcion.trim() || null;
      }
      
      updateData.updated_at = new Date().toISOString();

      // 3. Si no hay nada que actualizar
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionaron campos para actualizar' 
        });
      }

      // 4. Actualizar pista SIN SELECT para evitar el error PGRST116
      const { error: updateError } = await supabaseClient
        .from('pistas')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error al actualizar la pista:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar la pista: ' + updateError.message 
        });
      }

      // 5. Obtener los datos actualizados de la pista en una consulta separada
      const { data: pistaActualizada, error: getError } = await supabaseClient
        .from('pistas')
        .select('*, polideportivos:polideportivo_id (nombre, direccion, telefono)')
        .eq('id', id)
        .maybeSingle();

      if (getError) {
        console.warn('⚠️  No se pudo obtener datos actualizados de la pista:', getError);
        // No fallamos si no podemos obtener los datos actualizados
      }

      console.log(`✅ Pista actualizada:`, pistaActualizada?.nombre || id);

      // 6. Formatear respuesta (usar datos actualizados o los originales si no se pudieron obtener)
      const respuesta = {
        id: pistaActualizada?.id || id,
        nombre: pistaActualizada?.nombre || nombre || pista.nombre,
        tipo: pistaActualizada?.tipo || tipo || pista.tipo,
        precio: pistaActualizada?.precio ? parseFloat(pistaActualizada.precio) : precio || pista.precio,
        descripcion: pistaActualizada?.descripcion || descripcion || pista.descripcion,
        polideportivo_id: pistaActualizada?.polideportivo_id || pista.polideportivo_id,
        polideportivo_nombre: pistaActualizada?.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada?.polideportivos?.direccion,
        polideportivo_telefono: pistaActualizada?.polideportivos?.telefono,
        disponible: typeof disponible !== 'undefined' ? disponible : (pistaActualizada?.disponible || pista.disponible),
        created_at: pistaActualizada?.created_at || pista.created_at,
        updated_at: pistaActualizada?.updated_at || new Date().toISOString()
      };

      res.json({
        success: true,
        data: respuesta,
        message: 'Pista actualizada correctamente'
      });

    } catch (error) {
      console.error('❌ Error al actualizar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor al actualizar pista' 
      });
    }
});

// ✅ RUTA PATCH para compatibilidad con mantenimiento específico
router.patch('/:id/mantenimiento', 
  authenticateToken,
  verificarPermisosPista,
  async (req, res) => {
    const { id } = req.params;
    const { disponible } = req.body;
    const user = req.user;

    console.log(`🛠️ (PATCH/mantenimiento) Cambiando disponibilidad pista ${id} a:`, disponible, 'usuario:', user.rol);

    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        error: 'El campo "disponible" debe ser un valor booleano (true/false)' 
      });
    }

    try {
      const supabaseClient = getSupabaseClient(req);
      
      let query = supabaseClient
        .from('pistas')
        .select('id, polideportivo_id, nombre, disponible, tipo, precio, descripcion, created_at')
        .eq('id', id);

      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pista, error: pistaError } = await query.maybeSingle();

      if (pistaError || !pista) {
        console.error('❌ Pista no encontrada o sin permisos:', pistaError);
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
        });
      }

      // Actualizar SIN SELECT
      const { error: updateError } = await supabaseClient
        .from('pistas')
        .update({ 
          disponible: disponible,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error al actualizar estado:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar estado: ' + updateError.message 
        });
      }

      // Obtener datos actualizados si es posible
      const { data: pistaActualizada, error: getError } = await supabaseClient
        .from('pistas')
        .select('*, polideportivos:polideportivo_id (nombre, direccion, telefono)')
        .eq('id', id)
        .maybeSingle();

      const respuesta = {
        id: pistaActualizada?.id || id,
        nombre: pistaActualizada?.nombre || pista.nombre,
        tipo: pistaActualizada?.tipo || pista.tipo,
        precio: pistaActualizada?.precio ? parseFloat(pistaActualizada.precio) : pista.precio,
        descripcion: pistaActualizada?.descripcion || pista.descripcion,
        polideportivo_id: pistaActualizada?.polideportivo_id || pista.polideportivo_id,
        polideportivo_nombre: pistaActualizada?.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada?.polideportivos?.direccion,
        polideportivo_telefono: pistaActualizada?.polideportivos?.telefono,
        disponible: disponible,
        created_at: pistaActualizada?.created_at || pista.created_at,
        updated_at: pistaActualizada?.updated_at || new Date().toISOString()
      };

      res.json({
        success: true,
        data: respuesta,
        message: `Pista ${disponible ? 'reactivada' : 'puesta en mantenimiento'} correctamente`
      });

    } catch (error) {
      console.error('❌ Error al actualizar estado:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor al actualizar estado' 
      });
    }
});

// ✅ RUTA PATCH para cambiar solo precio
router.patch('/:id/precio', 
  authenticateToken,
  verificarPermisosPista,
  async (req, res) => {
    const { id } = req.params;
    const { precio } = req.body;
    const user = req.user;

    console.log(`💰 Cambiando precio pista ${id}, nuevo precio:`, precio, 'usuario:', user.rol);

    if (precio === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio es obligatorio' 
      });
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum)) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio debe ser un número válido' 
      });
    }

    if (precioNum <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El precio debe ser mayor a 0' 
      });
    }

    try {
      const supabaseClient = getSupabaseClient(req);
      
      let query = supabaseClient
        .from('pistas')
        .select('id, polideportivo_id, nombre, disponible, tipo, precio, descripcion, created_at')
        .eq('id', id);

      if (user.rol === ROLES.ADMIN_POLIDEPORTIVO && user.polideportivo_id) {
        query = query.eq('polideportivo_id', user.polideportivo_id);
      }

      const { data: pista, error: pistaError } = await query.maybeSingle();

      if (pistaError || !pista) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada o no tienes permisos para modificarla' 
      });
      }

      // Actualizar SIN SELECT
      const { error: updateError } = await supabaseClient
        .from('pistas')
        .update({ 
          precio: precioNum,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error al actualizar precio:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar precio: ' + updateError.message 
        });
      }

      // Obtener datos actualizados
      const { data: pistaActualizada, error: getError } = await supabaseClient
        .from('pistas')
        .select('*, polideportivos:polideportivo_id (nombre, direccion, telefono)')
        .eq('id', id)
        .maybeSingle();

      const respuesta = {
        id: pistaActualizada?.id || id,
        nombre: pistaActualizada?.nombre || pista.nombre,
        tipo: pistaActualizada?.tipo || pista.tipo,
        precio: precioNum,
        descripcion: pistaActualizada?.descripcion || pista.descripcion,
        polideportivo_id: pistaActualizada?.polideportivo_id || pista.polideportivo_id,
        polideportivo_nombre: pistaActualizada?.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada?.polideportivos?.direccion,
        polideportivo_telefono: pistaActualizada?.polideportivos?.telefono,
        disponible: pistaActualizada?.disponible || pista.disponible,
        created_at: pistaActualizada?.created_at || pista.created_at,
        updated_at: pistaActualizada?.updated_at || new Date().toISOString()
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
// RUTAS PARA ADMIN_POLI Y SUPER_ADMIN
// ============================================

// Obtener pistas de MI polideportivo (para admin_poli)
router.get('/mi-polideportivo/pistas', 
  authenticateToken,
  async (req, res) => {
    const supabase = req.app.get('supabase');
    const { tipo, disponible } = req.query;

    console.log('🏢 Admin_poli obteniendo pistas de su polideportivo:', req.user?.polideportivo_id);

    if (req.user?.rol !== ROLES.ADMIN_POLIDEPORTIVO || !req.user?.polideportivo_id) {
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
          polideportivos:polideportivo_id (id, nombre, direccion, telefono)
        `)
        .eq('polideportivo_id', req.user.polideportivo_id)
        .order('tipo')
        .order('nombre');

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

      const pistasFormateadas = (pistas || []).map(pista => ({
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
        updated_at: pista.updated_at
      }));

      console.log(`✅ Encontradas ${pistasFormateadas.length} pistas en el polideportivo`);

      res.json({
        success: true,
        data: pistasFormateadas
      });
    } catch (error) {
      console.error('Error al obtener pistas del polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas del polideportivo' 
      });
    }
});

// ✅ ELIMINAR PISTA (solo super_admin)
router.delete('/:id', 
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const supabaseClient = getSupabaseClient(req);
    const user = req.user;

    // Solo super_admin puede eliminar
    if (user.rol !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ 
        success: false,
        error: 'Solo el super administrador puede eliminar pistas' 
      });
    }

    console.log(`🗑️ Super_admin eliminando pista ID: ${id}`);

    try {
      // Verificar que la pista existe
      const { data: pista, error: pistaError } = await supabaseClient
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

      // Verificar si tiene reservas activas
      const { data: reservas, error: reservasError } = await supabaseClient
        .from('reservas')
        .select('id, estado, fecha, hora_inicio, nombre_usuario')
        .eq('pista_id', id)
        .in('estado', ['pendiente', 'confirmada'])
        .gte('fecha', new Date().toISOString().split('T')[0]);

      if (reservasError) {
        console.error('Error verificando reservas:', reservasError);
      }

      if (reservas && reservas.length > 0) {
        const reservasInfo = reservas
          .map(r => `- ${r.nombre_usuario || 'Usuario'} (${r.fecha} ${r.hora_inicio}) - ${r.estado}`)
          .join('\n');
        
        return res.status(409).json({ 
          success: false,
          error: `No se puede eliminar la pista porque tiene ${reservas.length} reserva(s) activa(s)`,
          detalles: {
            total_reservas: reservas.length,
            reservas: reservas
          }
        });
      }

      // Eliminar pista
      const { error: deleteError } = await supabaseClient
        .from('pistas')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error al eliminar pista:', deleteError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al eliminar pista: ' + deleteError.message 
        });
      }

      console.log(`✅ Pista eliminada: ${id} - ${pista.nombre}`);

      res.json({ 
        success: true,
        message: 'Pista eliminada correctamente',
        data: { 
          id, 
          nombre: pista.nombre
        }
      });

    } catch (error) {
      console.error('Error al eliminar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al eliminar pista: ' + error.message 
      });
    }
});

module.exports = router;