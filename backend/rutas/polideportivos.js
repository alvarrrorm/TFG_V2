const express = require('express');
const router = express.Router();

// Obtener todos los polideportivos
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

// Obtener un polideportivo por ID
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

// Crear nuevo polideportivo
router.post('/', async (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  const supabase = req.app.get('supabase');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

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

    res.status(201).json({
      success: true,
      data: nuevoPolideportivo
    });

  } catch (error) {
    console.error('Error al crear polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al crear polideportivo' 
    });
  }
});

// Actualizar polideportivo
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono } = req.body;
  const supabase = req.app.get('supabase');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

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
        telefono: telefono ? telefono.trim() : null
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

    res.json({
      success: true,
      data: polideportivoActualizado
    });

  } catch (error) {
    console.error('Error al actualizar polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al actualizar polideportivo' 
    });
  }
});

// Eliminar polideportivo
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = req.app.get('supabase');

  try {
    // Verificar que el polideportivo existe
    const { data: polideportivo, error: checkError } = await supabase
      .from('polideportivos')
      .select('id')
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
      .select('id')
      .eq('polideportivo_id', id);

    if (pistasError) {
      console.error('Error al verificar pistas asociadas:', pistasError);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar pistas asociadas' 
      });
    }

    if (pistas && pistas.length > 0) {
      return res.status(409).json({ 
        success: false,
        error: `No se puede eliminar el polideportivo porque tiene ${pistas.length} pista(s) asociada(s). Elimine primero las pistas.` 
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

    res.json({ 
      success: true,
      message: 'Polideportivo eliminado correctamente' 
    });

  } catch (error) {
    console.error('Error al eliminar polideportivo:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al eliminar polideportivo' 
    });
  }
});

module.exports = router;