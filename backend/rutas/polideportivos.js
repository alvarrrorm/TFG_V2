const express = require('express');
const router = express.Router();

// Obtener todos los polideportivos
router.get('/', (req, res) => {
  const conexion = req.app.get('conexion');

  conexion.query(`
    SELECT * FROM polideportivos 
    ORDER BY nombre ASC
  `, (error, results) => {
    if (error) {
      console.error('Error al obtener polideportivos:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener polideportivos' 
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// Obtener un polideportivo por ID
router.get('/:id', (req, res) => {
  const conexion = req.app.get('conexion');
  const { id } = req.params;

  conexion.query(`
    SELECT * FROM polideportivos 
    WHERE id = ?
  `, [id], (error, results) => {
    if (error) {
      console.error('Error al obtener polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener polideportivo' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  });
});

// Crear nuevo polideportivo
router.post('/', (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  const conexion = req.app.get('conexion');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

  // Verificar si ya existe un polideportivo con el mismo nombre
  conexion.query('SELECT id FROM polideportivos WHERE nombre = ?', [nombre], (error, results) => {
    if (error) {
      console.error('Error al verificar polideportivo existente:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar polideportivo existente' 
      });
    }

    if (results.length > 0) {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe un polideportivo con ese nombre' 
      });
    }

    // Insertar nuevo polideportivo
    conexion.query(
      'INSERT INTO polideportivos (nombre, direccion, telefono) VALUES (?, ?, ?)',
      [nombre.trim(), direccion.trim(), telefono ? telefono.trim() : null],
      (error, results) => {
        if (error) {
          console.error('Error al crear polideportivo:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al crear polideportivo' 
          });
        }

        // Obtener el polideportivo recién creado
        conexion.query('SELECT * FROM polideportivos WHERE id = ?', [results.insertId], (error, polideportivoResults) => {
          if (error || polideportivoResults.length === 0) {
            console.error('Error al obtener polideportivo creado:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al obtener polideportivo creado' 
            });
          }

          res.status(201).json({
            success: true,
            data: polideportivoResults[0]
          });
        });
      }
    );
  });
});

// Actualizar polideportivo
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono } = req.body;
  const conexion = req.app.get('conexion');

  if (!nombre || !direccion) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre y dirección son obligatorios' 
    });
  }

  // Verificar que el polideportivo existe
  conexion.query('SELECT id FROM polideportivos WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error al verificar polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar polideportivo' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    // Verificar si ya existe otro polideportivo con el mismo nombre
    conexion.query('SELECT id FROM polideportivos WHERE nombre = ? AND id != ?', [nombre, id], (error, nombreResults) => {
      if (error) {
        console.error('Error al verificar nombre de polideportivo:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al verificar nombre de polideportivo' 
        });
      }

      if (nombreResults.length > 0) {
        return res.status(409).json({ 
          success: false,
          error: 'Ya existe otro polideportivo con ese nombre' 
        });
      }

      // Actualizar polideportivo
      conexion.query(
        'UPDATE polideportivos SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?',
        [nombre.trim(), direccion.trim(), telefono ? telefono.trim() : null, id],
        (error, updateResults) => {
          if (error) {
            console.error('Error al actualizar polideportivo:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al actualizar polideportivo' 
            });
          }

          // Obtener polideportivo actualizado
          conexion.query('SELECT * FROM polideportivos WHERE id = ?', [id], (error, polideportivoResults) => {
            if (error || polideportivoResults.length === 0) {
              console.error('Error al obtener polideportivo actualizado:', error);
              return res.status(500).json({ 
                success: false,
                error: 'Error al obtener polideportivo actualizado' 
              });
            }

            res.json({
              success: true,
              data: polideportivoResults[0]
            });
          });
        }
      );
    });
  });
});

// Eliminar polideportivo
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const conexion = req.app.get('conexion');

  // Verificar que el polideportivo existe
  conexion.query('SELECT id FROM polideportivos WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error al verificar polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar polideportivo' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Polideportivo no encontrado' 
      });
    }

    // Verificar si hay pistas asociadas a este polideportivo
    conexion.query('SELECT COUNT(*) as count FROM pistas WHERE polideportivo_id = ?', [id], (error, pistaResults) => {
      if (error) {
        console.error('Error al verificar pistas asociadas:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al verificar pistas asociadas' 
        });
      }

      const pistaCount = pistaResults[0].count;
      if (pistaCount > 0) {
        return res.status(409).json({ 
          success: false,
          error: `No se puede eliminar el polideportivo porque tiene ${pistaCount} pista(s) asociada(s). Elimine primero las pistas.` 
        });
      }

      // Eliminar polideportivo
      conexion.query('DELETE FROM polideportivos WHERE id = ?', [id], (error, deleteResults) => {
        if (error) {
          console.error('Error al eliminar polideportivo:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al eliminar polideportivo' 
          });
        }

        res.json({ 
          success: true,
          message: 'Polideportivo eliminado correctamente' 
        });
      });
    });
  });
});

module.exports = router;