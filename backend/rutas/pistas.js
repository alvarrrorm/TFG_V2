const express = require('express');
const router = express.Router();

// Obtener todas las pistas con información del polideportivo
router.get('/', async (req, res) => {
  const supabase = req.app.get('supabase');

  try {
    const { data: pistas, error } = await supabase
      .from('pistas')
      .select(`
        *,
        polideportivos:polideportivo_id (nombre, direccion)
      `)
      .order('id');

    if (error) {
      console.error('Error al obtener pistas:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas' 
      });
    }

    res.json({
      success: true,
      data: pistas.map(pista => ({
        id: pista.id,
        nombre: pista.nombre,
        tipo: pista.tipo,
        precio: parseFloat(pista.precio),
        polideportivo_id: pista.polideportivo_id,
        polideportivo_nombre: pista.polideportivos?.nombre,
        polideportivo_direccion: pista.polideportivos?.direccion,
        disponible: pista.disponible === true || pista.disponible === 1,
        enMantenimiento: pista.disponible === false || pista.disponible === 0
      }))
    });
  } catch (error) {
    console.error('Error al obtener pistas:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener pistas' 
    });
  }
});

// Obtener pistas disponibles (no en mantenimiento) con información del polideportivo
router.get('/disponibles', async (req, res) => {
  const supabase = req.app.get('supabase');

  try {
    const { data: pistas, error } = await supabase
      .from('pistas')
      .select(`
        id, nombre, tipo, precio, polideportivo_id,
        polideportivos:polideportivo_id (nombre)
      `)
      .eq('disponible', true)
      .order('tipo')
      .order('nombre');

    if (error) {
      console.error('Error al obtener pistas disponibles:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas disponibles' 
      });
    }

    res.json({
      success: true,
      data: pistas.map(pista => ({
        ...pista,
        polideportivo_nombre: pista.polideportivos?.nombre,
        precio: parseFloat(pista.precio)
      }))
    });
  } catch (error) {
    console.error('Error al obtener pistas disponibles:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener pistas disponibles' 
    });
  }
});

// Agregar nueva pista con polideportivo
router.post('/', async (req, res) => {
  const { nombre, tipo, precio, polideportivo_id } = req.body;
  const supabase = req.app.get('supabase');

  if (!nombre || !tipo || precio === undefined || !polideportivo_id) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre, tipo, precio y polideportivo son obligatorios' 
    });
  }

  if (isNaN(parseFloat(precio))) {
    return res.status(400).json({ 
      success: false,
      error: 'El precio debe ser un número válido' 
    });
  }

  try {
    // Verificar que el polideportivo existe
    const { data: polideportivo, error: polideportivoError } = await supabase
      .from('polideportivos')
      .select('id')
      .eq('id', polideportivo_id)
      .single();

    if (polideportivoError || !polideportivo) {
      return res.status(400).json({ 
        success: false,
        error: 'El polideportivo seleccionado no existe' 
      });
    }

    // Verificar si ya existe una pista con el mismo nombre en el mismo polideportivo
    const { data: pistaExistente, error: pistaError } = await supabase
      .from('pistas')
      .select('id')
      .eq('nombre', nombre)
      .eq('polideportivo_id', polideportivo_id)
      .single();

    if (pistaExistente) {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe una pista con ese nombre en este polideportivo' 
      });
    }

    // Insertar la nueva pista
    const { data: nuevaPista, error: insertError } = await supabase
      .from('pistas')
      .insert([{
        nombre,
        tipo,
        precio: parseFloat(precio),
        polideportivo_id,
        disponible: true
      }])
      .select(`
        *,
        polideportivos:polideportivo_id (nombre, direccion)
      `)
      .single();

    if (insertError) {
      console.error('Error al agregar pista:', insertError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al agregar pista' 
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: nuevaPista.id,
        nombre: nuevaPista.nombre,
        tipo: nuevaPista.tipo,
        precio: parseFloat(nuevaPista.precio),
        polideportivo_id: nuevaPista.polideportivo_id,
        polideportivo_nombre: nuevaPista.polideportivos?.nombre,
        polideportivo_direccion: nuevaPista.polideportivos?.direccion,
        disponible: nuevaPista.disponible === true || nuevaPista.disponible === 1,
        enMantenimiento: nuevaPista.disponible === false || nuevaPista.disponible === 0
      }
    });

  } catch (error) {
    console.error('Error al agregar pista:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al agregar pista' 
    });
  }
});

// Cambiar estado de mantenimiento
router.patch('/:id/mantenimiento', async (req, res) => {
  const { id } = req.params;
  const { enMantenimiento } = req.body;
  const supabase = req.app.get('supabase');

  if (typeof enMantenimiento !== 'boolean') {
    return res.status(400).json({ 
      success: false,
      error: 'El campo enMantenimiento debe ser un valor booleano (true/false)' 
    });
  }

  try {
    // Verificar que la pista existe
    const { data: pista, error: pistaError } = await supabase
      .from('pistas')
      .select('id')
      .eq('id', id)
      .single();

    if (pistaError || !pista) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    // Actualizar estado
    const { data: pistaActualizada, error: updateError } = await supabase
      .from('pistas')
      .update({ disponible: !enMantenimiento })
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
        error: 'Error al actualizar estado de mantenimiento' 
      });
    }

    res.json({
      success: true,
      data: {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        enMantenimiento: pistaActualizada.disponible === false || pistaActualizada.disponible === 0
      }
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar estado de mantenimiento' 
    });
  }
});

// Actualizar precio de pista
router.patch('/:id/precio', async (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const supabase = req.app.get('supabase');

  if (precio === undefined || isNaN(parseFloat(precio))) {
    return res.status(400).json({ 
      success: false,
      error: 'Precio debe ser un número válido' 
    });
  }

  try {
    const { data: pistaActualizada, error } = await supabase
      .from('pistas')
      .update({ precio: parseFloat(precio) })
      .eq('id', id)
      .select(`
        *,
        polideportivos:polideportivo_id (nombre, direccion)
      `)
      .single();

    if (error) {
      console.error('Error al actualizar precio:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al actualizar precio' 
      });
    }

    if (!pistaActualizada) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    res.json({
      success: true,
      data: {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        enMantenimiento: pistaActualizada.disponible === false || pistaActualizada.disponible === 0
      }
    });

  } catch (error) {
    console.error('Error al actualizar precio:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar precio' 
    });
  }
});

// Actualizar pista completa (incluyendo polideportivo)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, precio, polideportivo_id, disponible } = req.body;
  const supabase = req.app.get('supabase');

  try {
    // Verificar que la pista existe
    const { data: pistaExistente, error: pistaError } = await supabase
      .from('pistas')
      .select('id, polideportivo_id')
      .eq('id', id)
      .single();

    if (pistaError || !pistaExistente) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    // Si se cambia el polideportivo, verificar que existe
    if (polideportivo_id) {
      const { data: polideportivo, error: polideportivoError } = await supabase
        .from('polideportivos')
        .select('id')
        .eq('id', polideportivo_id)
        .single();

      if (polideportivoError || !polideportivo) {
        return res.status(400).json({ 
          success: false,
          error: 'El polideportivo seleccionado no existe' 
        });
      }
    }

    // Preparar datos para actualizar
    const updateData = {};
    
    if (nombre !== undefined) updateData.nombre = nombre;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (precio !== undefined) {
      if (isNaN(parseFloat(precio))) {
        return res.status(400).json({ 
          success: false,
          error: 'El precio debe ser un número válido' 
        });
      }
      updateData.precio = parseFloat(precio);
    }
    if (polideportivo_id !== undefined) updateData.polideportivo_id = polideportivo_id;
    if (disponible !== undefined) updateData.disponible = disponible;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No se proporcionaron campos para actualizar' 
      });
    }

    // Si se cambia el nombre, verificar que no exista otra pista con el mismo nombre en el mismo polideportivo
    if (nombre !== undefined) {
      const polideportivoId = polideportivo_id || pistaExistente.polideportivo_id;
      
      const { data: pistaConMismoNombre, error: nombreError } = await supabase
        .from('pistas')
        .select('id')
        .eq('nombre', nombre)
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

    res.json({
      success: true,
      data: {
        id: pistaActualizada.id,
        nombre: pistaActualizada.nombre,
        tipo: pistaActualizada.tipo,
        precio: parseFloat(pistaActualizada.precio),
        polideportivo_id: pistaActualizada.polideportivo_id,
        polideportivo_nombre: pistaActualizada.polideportivos?.nombre,
        polideportivo_direccion: pistaActualizada.polideportivos?.direccion,
        disponible: pistaActualizada.disponible === true || pistaActualizada.disponible === 1,
        enMantenimiento: pistaActualizada.disponible === false || pistaActualizada.disponible === 0
      }
    });

  } catch (error) {
    console.error('Error al actualizar pista:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar pista' 
    });
  }
});

// Eliminar pista
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = req.app.get('supabase');

  try {
    const { error, count } = await supabase
      .from('pistas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al eliminar pista' 
      });
    }

    res.json({ 
      success: true,
      message: 'Pista eliminada correctamente' 
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