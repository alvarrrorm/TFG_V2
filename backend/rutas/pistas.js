const express = require('express');
const router = express.Router();

// Obtener todas las pistas
router.get('/', (req, res) => {
  const conexion = req.app.get('conexion');

  conexion.query('SELECT * FROM pistas ORDER BY id', (error, results) => {
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
        disponible: pista.disponible === 1,
        enMantenimiento: pista.disponible === 0
      }))
    });
  });
});

// Obtener pistas disponibles (no en mantenimiento)
router.get('/disponibles', (req, res) => {
  const conexion = req.app.get('conexion');

  conexion.query(`
    SELECT id, nombre, tipo, precio 
    FROM pistas 
    WHERE disponible = 1
    ORDER BY tipo, nombre
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

// Agregar nueva pista
router.post('/', (req, res) => {
  const { nombre, tipo, precio } = req.body;
  const conexion = req.app.get('conexion');

  if (!nombre || !tipo || precio === undefined) {
    return res.status(400).json({ 
      success: false,
      error: 'Nombre, tipo y precio son obligatorios' 
    });
  }

  if (isNaN(parseFloat(precio))) {
    return res.status(400).json({ 
      success: false,
      error: 'El precio debe ser un número válido' 
    });
  }

  const sql = "SELECT * FROM pistas WHERE nombre COLLATE utf8mb4_general_ci = ?";
  conexion.query(sql, [nombre], (error, results) => {
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
        error: 'Ya existe una pista con ese nombre' 
      });
    }

    conexion.query(
      'INSERT INTO pistas (nombre, tipo, precio, disponible) VALUES (?, ?, ?, ?)',
      [nombre, tipo, parseFloat(precio), 1],
      (error, results) => {
        if (error) {
          console.error('Error al agregar pista:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Error al agregar pista' 
          });
        }

        res.status(201).json({
          success: true,
          data: {
            id: results.insertId,
            nombre,
            tipo,
            precio: parseFloat(precio),
            disponible: true,
            enMantenimiento: false
          }
        });
      }
    );
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

        conexion.query(
          'SELECT * FROM pistas WHERE id = ?',
          [id],
          (error, pistaResults) => {
            if (error || pistaResults.length === 0) {
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
                disponible: pistaActualizada.disponible === 1,
                enMantenimiento: pistaActualizada.disponible === 0
              }
            });
          }
        );
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

      conexion.query(
        'SELECT * FROM pistas WHERE id = ?',
        [id],
        (error, results) => {
          if (error || results.length === 0) {
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
              disponible: pistaActualizada.disponible === 1,
              enMantenimiento: pistaActualizada.disponible === 0
            }
          });
        }
      );
    }
  );
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