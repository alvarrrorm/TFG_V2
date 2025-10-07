const express = require('express');
const router = express.Router();

// Obtener todas las pistas con información del polideportivo
router.get('/', (req, res) => {
  const conexion = req.app.get('conexion');

  conexion.query(`
    SELECT p.*, poli.nombre as polideportivo_nombre, poli.direccion as polideportivo_direccion 
    FROM pistas p 
    LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
    ORDER BY p.id
  `, (error, results) => {
    if (error) {
      console.error('Error al obtener pistas:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas' 
      });
    }

    res.json({
      success: true,
      data: results.map(pista => ({
        id: pista.id,
        nombre: pista.nombre,
        tipo: pista.tipo,
        precio: pista.precio,
        polideportivo_id: pista.polideportivo_id,
        polideportivo_nombre: pista.polideportivo_nombre,
        polideportivo_direccion: pista.polideportivo_direccion,
        disponible: pista.disponible === 1 || pista.disponible === true,
        enMantenimiento: pista.disponible === 0 || pista.disponible === false
      }))
    });
  });
});

// Obtener pistas disponibles (no en mantenimiento) con información del polideportivo
router.get('/disponibles', (req, res) => {
  const conexion = req.app.get('conexion');

  conexion.query(`
    SELECT p.id, p.nombre, p.tipo, p.precio, p.polideportivo_id,
           poli.nombre as polideportivo_nombre 
    FROM pistas p 
    LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
    WHERE p.disponible = 1
    ORDER BY p.tipo, p.nombre
  `, (error, results) => {
    if (error) {
      console.error('Error al obtener pistas disponibles:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener pistas disponibles' 
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// Agregar nueva pista con polideportivo
router.post('/', (req, res) => {
  const { nombre, tipo, precio, polideportivo_id } = req.body;
  const conexion = req.app.get('conexion');

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

  // Verificar que el polideportivo existe
  conexion.query('SELECT id FROM polideportivos WHERE id = ?', [polideportivo_id], (error, polideportivoResults) => {
    if (error) {
      console.error('Error al verificar polideportivo:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar polideportivo' 
      });
    }

    if (polideportivoResults.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El polideportivo seleccionado no existe' 
      });
    }

    // Verificar si ya existe una pista con el mismo nombre en el mismo polideportivo
    const sql = "SELECT * FROM pistas WHERE nombre = ? AND polideportivo_id = ?";
    conexion.query(sql, [nombre, polideportivo_id], (error, results) => {
      if (error) {
        console.error('Error al verificar pista existente:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al verificar pista existente' 
        });
      }

      if (results.length > 0) {
        return res.status(409).json({ 
          success: false,
          error: 'Ya existe una pista con ese nombre en este polideportivo' 
        });
      }

      // Insertar la nueva pista
      conexion.query(
        'INSERT INTO pistas (nombre, tipo, precio, polideportivo_id, disponible) VALUES (?, ?, ?, ?, ?)',
        [nombre, tipo, parseFloat(precio), polideportivo_id, 1],
        (error, results) => {
          if (error) {
            console.error('Error al agregar pista:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al agregar pista' 
            });
          }

          // Obtener la pista recién creada con información del polideportivo
          conexion.query(`
            SELECT p.*, poli.nombre as polideportivo_nombre, poli.direccion as polideportivo_direccion 
            FROM pistas p 
            LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
            WHERE p.id = ?
          `, [results.insertId], (error, pistaResults) => {
            if (error || pistaResults.length === 0) {
              console.error('Error al obtener pista creada:', error);
              return res.status(500).json({ 
                success: false,
                error: 'Error al obtener pista creada' 
              });
            }

            const pistaCreada = pistaResults[0];
            res.status(201).json({
              success: true,
              data: {
                id: pistaCreada.id,
                nombre: pistaCreada.nombre,
                tipo: pistaCreada.tipo,
                precio: pistaCreada.precio,
                polideportivo_id: pistaCreada.polideportivo_id,
                polideportivo_nombre: pistaCreada.polideportivo_nombre,
                polideportivo_direccion: pistaCreada.polideportivo_direccion,
                disponible: pistaCreada.disponible === 1 || pistaCreada.disponible === true,
                enMantenimiento: pistaCreada.disponible === 0 || pistaCreada.disponible === false
              }
            });
          });
        }
      );
    });
  });
});

// Cambiar estado de mantenimiento
router.patch('/:id/mantenimiento', (req, res) => {
  const { id } = req.params;
  const { enMantenimiento } = req.body;
  const conexion = req.app.get('conexion');

  if (typeof enMantenimiento !== 'boolean') {
    return res.status(400).json({ 
      success: false,
      error: 'El campo enMantenimiento debe ser un valor booleano (true/false)' 
    });
  }

  const disponible = enMantenimiento ? 0 : 1;

  conexion.query('SELECT id FROM pistas WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error al verificar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar pista' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    conexion.query(
      'UPDATE pistas SET disponible = ? WHERE id = ?',
      [disponible, id],
      (error, updateResults) => {
        if (error) {
          console.error('Error al actualizar estado:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al actualizar estado de mantenimiento' 
          });
        }

        // Obtener pista actualizada con información del polideportivo
        conexion.query(`
          SELECT p.*, poli.nombre as polideportivo_nombre, poli.direccion as polideportivo_direccion 
          FROM pistas p 
          LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
          WHERE p.id = ?
        `, [id], (error, pistaResults) => {
          if (error || pistaResults.length === 0) {
            console.error('Error al obtener pista actualizada:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al obtener pista actualizada' 
            });
          }

          const pistaActualizada = pistaResults[0];
          res.json({
            success: true,
            data: {
              id: pistaActualizada.id,
              nombre: pistaActualizada.nombre,
              tipo: pistaActualizada.tipo,
              precio: pistaActualizada.precio,
              polideportivo_id: pistaActualizada.polideportivo_id,
              polideportivo_nombre: pistaActualizada.polideportivo_nombre,
              polideportivo_direccion: pistaActualizada.polideportivo_direccion,
              disponible: pistaActualizada.disponible === 1 || pistaActualizada.disponible === true,
              enMantenimiento: pistaActualizada.disponible === 0 || pistaActualizada.disponible === false
            }
          });
        });
      }
    );
  });
});

// Actualizar precio de pista
router.patch('/:id/precio', (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const conexion = req.app.get('conexion');

  if (precio === undefined || isNaN(parseFloat(precio))) {
    return res.status(400).json({ 
      success: false,
      error: 'Precio debe ser un número válido' 
    });
  }

  conexion.query(
    'UPDATE pistas SET precio = ? WHERE id = ?',
    [parseFloat(precio), id],
    (error, results) => {
      if (error) {
        console.error('Error al actualizar precio:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar precio' 
        });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada' 
        });
      }

      // Obtener pista actualizada con información del polideportivo
      conexion.query(`
        SELECT p.*, poli.nombre as polideportivo_nombre, poli.direccion as polideportivo_direccion 
        FROM pistas p 
        LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
        WHERE p.id = ?
      `, [id], (error, results) => {
        if (error || results.length === 0) {
          console.error('Error al obtener pista actualizada:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al obtener pista actualizada' 
          });
        }

        const pistaActualizada = results[0];
        res.json({
          success: true,
          data: {
            id: pistaActualizada.id,
            nombre: pistaActualizada.nombre,
            tipo: pistaActualizada.tipo,
            precio: pistaActualizada.precio,
            polideportivo_id: pistaActualizada.polideportivo_id,
            polideportivo_nombre: pistaActualizada.polideportivo_nombre,
            polideportivo_direccion: pistaActualizada.polideportivo_direccion,
            disponible: pistaActualizada.disponible === 1 || pistaActualizada.disponible === true,
            enMantenimiento: pistaActualizada.disponible === 0 || pistaActualizada.disponible === false
          }
        });
      });
    }
  );
});

// Actualizar pista completa (incluyendo polideportivo)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, precio, polideportivo_id, disponible } = req.body;
  const conexion = req.app.get('conexion');

  // Verificar que la pista existe
  conexion.query('SELECT id FROM pistas WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error al verificar pista:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar pista' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pista no encontrada' 
      });
    }

    // Si se cambia el polideportivo, verificar que existe
    if (polideportivo_id) {
      conexion.query('SELECT id FROM polideportivos WHERE id = ?', [polideportivo_id], (error, polideportivoResults) => {
        if (error) {
          console.error('Error al verificar polideportivo:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al verificar polideportivo' 
          });
        }

        if (polideportivoResults.length === 0) {
          return res.status(400).json({ 
            success: false,
            error: 'El polideportivo seleccionado no existe' 
          });
        }

        actualizarPista();
      });
    } else {
      actualizarPista();
    }

    function actualizarPista() {
      const updateFields = [];
      const updateValues = [];

      if (nombre !== undefined) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
      }

      if (tipo !== undefined) {
        updateFields.push('tipo = ?');
        updateValues.push(tipo);
      }

      if (precio !== undefined) {
        if (isNaN(parseFloat(precio))) {
          return res.status(400).json({ 
            success: false,
            error: 'El precio debe ser un número válido' 
          });
        }
        updateFields.push('precio = ?');
        updateValues.push(parseFloat(precio));
      }

      if (polideportivo_id !== undefined) {
        updateFields.push('polideportivo_id = ?');
        updateValues.push(polideportivo_id);
      }

      if (disponible !== undefined) {
        updateFields.push('disponible = ?');
        updateValues.push(disponible ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionaron campos para actualizar' 
        });
      }

      updateValues.push(id);

      // Si se cambia el nombre, verificar que no exista otra pista con el mismo nombre en el mismo polideportivo
      if (nombre !== undefined) {
        const checkNombreSQL = "SELECT id FROM pistas WHERE nombre = ? AND polideportivo_id = ? AND id != ?";
        const polideportivoId = polideportivo_id || results[0].polideportivo_id;
        
        conexion.query(checkNombreSQL, [nombre, polideportivoId, id], (error, nombreResults) => {
          if (error) {
            console.error('Error al verificar nombre de pista:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al verificar nombre de pista' 
            });
          }

          if (nombreResults.length > 0) {
            return res.status(409).json({ 
              success: false,
              error: 'Ya existe una pista con ese nombre en este polideportivo' 
            });
          }

          realizarActualizacion();
        });
      } else {
        realizarActualizacion();
      }

      function realizarActualizacion() {
        const updateSQL = `UPDATE pistas SET ${updateFields.join(', ')} WHERE id = ?`;
        
        conexion.query(updateSQL, updateValues, (error, updateResults) => {
          if (error) {
            console.error('Error al actualizar pista:', error);
            return res.status(500).json({ 
              success: false,
              error: 'Error al actualizar pista' 
            });
          }

          // Obtener pista actualizada con información del polideportivo
          conexion.query(`
            SELECT p.*, poli.nombre as polideportivo_nombre, poli.direccion as polideportivo_direccion 
            FROM pistas p 
            LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
            WHERE p.id = ?
          `, [id], (error, pistaResults) => {
            if (error || pistaResults.length === 0) {
              console.error('Error al obtener pista actualizada:', error);
              return res.status(500).json({ 
                success: false,
                error: 'Error al obtener pista actualizada' 
              });
            }

            const pistaActualizada = pistaResults[0];
            res.json({
              success: true,
              data: {
                id: pistaActualizada.id,
                nombre: pistaActualizada.nombre,
                tipo: pistaActualizada.tipo,
                precio: pistaActualizada.precio,
                polideportivo_id: pistaActualizada.polideportivo_id,
                polideportivo_nombre: pistaActualizada.polideportivo_nombre,
                polideportivo_direccion: pistaActualizada.polideportivo_direccion,
                disponible: pistaActualizada.disponible === 1 || pistaActualizada.disponible === true,
                enMantenimiento: pistaActualizada.disponible === 0 || pistaActualizada.disponible === false
              }
            });
          });
        });
      }
    }
  });
});

// Eliminar pista
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const conexion = req.app.get('conexion');

  conexion.query(
    'DELETE FROM pistas WHERE id = ?',
    [id],
    (error, results) => {
      if (error) {
        console.error('Error al eliminar pista:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Error al eliminar pista' 
        });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Pista no encontrada' 
        });
      }

      res.json({ 
        success: true,
        message: 'Pista eliminada correctamente' 
      });
    }
  );
});

module.exports = router;