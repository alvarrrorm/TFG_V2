const express = require('express');
const router = express.Router();

// Crear una reserva
router.post('/', (req, res) => {
  const db = req.app.get('conexion');
  const {
    dni_usuario,
    nombre_usuario,
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    ludoteca = false,
    estado = 'pendiente'
  } = req.body;

  // Nota: En tu tabla no existe 'dni_usuario' ni 'ludoteca', pero los mantengo por compatibilidad
  // y los mapearemos a los campos correctos

  if (!nombre_usuario || !pista_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }

  const pistaId = Number(pista_id);
  if (isNaN(pistaId)) {
    return res.status(400).json({ success: false, error: 'ID de pista inválido' });
  }

  // Primero obtener información de la pista y su polideportivo
  const pistaSQL = `
    SELECT p.*, poli.id as polideportivo_id 
    FROM pistas p 
    LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
    WHERE p.id = ? AND p.disponible = 1
  `;

  db.query(pistaSQL, [pistaId], (err, pistaResults) => {
    if (err) {
      console.error('Error al obtener información de la pista:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener información de la pista' });
    }

    if (pistaResults.length === 0) {
      return res.status(404).json({ success: false, error: 'Pista no encontrada o no disponible' });
    }

    const pista = pistaResults[0];
    const polideportivoId = pista.polideportivo_id;
    const usuarioId = 0; // Valor temporal, ya que no tenemos el campo en el frontend

    // Comprobar disponibilidad de la pista
    const disponibilidadSQL = `
      SELECT * FROM reservas 
      WHERE pista_id = ? AND fecha = ? AND estado != 'cancelada' AND (
        (hora_inicio < ? AND hora_fin > ?) OR
        (hora_inicio >= ? AND hora_inicio < ?) OR
        (hora_fin > ? AND hora_fin <= ?)
      )
    `;

    db.query(disponibilidadSQL, [pistaId, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin, hora_inicio, hora_fin], (err, results) => {
      if (err) {
        console.error('Error al comprobar disponibilidad:', err);
        return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
      }
      
      if (results.length > 0) {
        return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });
      }

      // Comprobar que el usuario no tenga otra reserva en ese horario
      // Usamos nombre_usuario ya que no tenemos usuario_id en el frontend
      const usuarioSQL = `
        SELECT * FROM reservas 
        WHERE nombre_usuario = ? AND fecha = ? AND estado != 'cancelada' AND (
          (hora_inicio < ? AND hora_fin > ?) OR
          (hora_inicio >= ? AND hora_inicio < ?) OR
          (hora_fin > ? AND hora_fin <= ?)
        )
      `;
      
      db.query(usuarioSQL, [nombre_usuario, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin, hora_inicio, hora_fin], (err, results) => {
        if (err) {
          console.error('Error al comprobar reservas del usuario:', err);
          return res.status(500).json({ success: false, error: 'Error al comprobar reservas del usuario' });
        }
        
        if (results.length > 0) {
          return res.status(409).json({ success: false, error: 'Ya tienes otra reserva en este horario' });
        }

        const precioHora = parseFloat(pista.precio);
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

        let precioTotal = parseFloat((precioHora * duracion).toFixed(2));

        // 👉 AÑADIR SUPLEMENTO DE LUDOTECA (+5 €) - Se almacenará como campo adicional si es necesario
        // Por ahora lo incluimos en el precio total
        if (ludoteca) {
          precioTotal += 5;
        }

        // Insertar reserva con la nueva estructura
        const insertSQL = `
          INSERT INTO reservas 
          (pista_id, polideportivo_id, usuario_id, nombre_usuario, fecha, hora_inicio, hora_fin, precio, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.query(insertSQL, [
          pistaId, 
          polideportivoId, 
          usuarioId, // Valor temporal
          nombre_usuario, 
          fecha, 
          hora_inicio, 
          hora_fin, 
          precioTotal,
          estado
        ], (err, result) => {
          if (err) {
            console.error('Error al crear reserva:', err);
            return res.status(500).json({ success: false, error: 'Error al crear reserva' });
          }

          // Devolver reserva creada con información completa
          const selectSQL = `
            SELECT r.*, 
                   p.nombre AS pistaNombre, 
                   p.tipo AS pistaTipo,
                   poli.nombre AS polideportivo_nombre
            FROM reservas r
            LEFT JOIN pistas p ON r.pista_id = p.id
            LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
            WHERE r.id = ?
          `;
          
          db.query(selectSQL, [result.insertId], (err, rows) => {
            if (err) {
              console.error('Error al obtener reserva creada:', err);
              return res.status(500).json({ success: false, error: 'Error al obtener reserva creada' });
            }
            
            if (rows.length === 0) {
              return res.status(404).json({ success: false, error: 'Reserva no encontrada después de crearla' });
            }

            // Agregar campo ludoteca a la respuesta para compatibilidad con frontend
            const reservaConLudoteca = {
              ...rows[0],
              ludoteca: ludoteca // Mantener compatibilidad
            };

            res.status(201).json({ success: true, data: reservaConLudoteca });
          });
        });
      });
    });
  });
});

// Listar todas las reservas o por nombre de usuario
router.get('/', (req, res) => {
  const db = req.app.get('conexion');
  const { nombre_usuario } = req.query;

  let sql = `
    SELECT r.*, 
           p.nombre AS pistaNombre, 
           p.tipo AS pistaTipo,
           poli.nombre AS polideportivo_nombre
    FROM reservas r
    LEFT JOIN pistas p ON r.pista_id = p.id
    LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
  `;
  const params = [];

  if (nombre_usuario) {
    sql += ` WHERE r.nombre_usuario = ?`;
    params.push(nombre_usuario);
  }

  sql += ` ORDER BY r.fecha DESC, r.hora_inicio DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error al obtener reservas:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    }
    
    // Agregar campo ludoteca temporal para compatibilidad
    const reservasConLudoteca = results.map(reserva => ({
      ...reserva,
      ludoteca: false // Valor por defecto
    }));

    res.json({ success: true, data: reservasConLudoteca });
  });
});

// Obtener reserva por ID
router.get('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  const sql = `
    SELECT r.*, 
           p.nombre AS pistaNombre, 
           p.tipo AS pistaTipo,
           poli.nombre AS polideportivo_nombre
    FROM reservas r
    LEFT JOIN pistas p ON r.pista_id = p.id
    LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
    WHERE r.id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    // Agregar campo ludoteca para compatibilidad
    const reservaConLudoteca = {
      ...results[0],
      ludoteca: false
    };

    res.json({ success: false, data: reservaConLudoteca });
  });
});

// Eliminar una reserva
router.delete('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  // Primero obtener información de la reserva antes de eliminarla
  const selectSQL = `
    SELECT r.*, 
           p.nombre AS pistaNombre,
           poli.nombre AS polideportivo_nombre
    FROM reservas r
    LEFT JOIN pistas p ON r.pista_id = p.id
    LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
    WHERE r.id = ?
  `;
  
  db.query(selectSQL, [id], (err, rows) => {
    if (err) {
      console.error('Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const deleteSQL = `DELETE FROM reservas WHERE id = ?`;
    db.query(deleteSQL, [id], (err, result) => {
      if (err) {
        console.error('Error al eliminar reserva:', err);
        return res.status(500).json({ success: false, error: 'Error al eliminar reserva' });
      }
      
      // Agregar campo ludoteca para compatibilidad
      const reservaConLudoteca = {
        ...rows[0],
        ludoteca: false
      };

      res.json({ 
        success: true, 
        data: reservaConLudoteca, 
        message: 'Reserva eliminada correctamente' 
      });
    });
  });
});

// Marcar reserva como confirmada (equivalente a pagado en tu ENUM)
router.put('/:id/confirmar', async (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  try {
    await db.promise().query('START TRANSACTION');

    const [reserva] = await db.promise().query(
      `SELECT id, estado FROM reservas WHERE id = ? FOR UPDATE`, 
      [reservaId]
    );
    
    if (!reserva || reserva.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    
    if (reserva[0].estado !== 'pendiente') {
      await db.promise().query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: `La reserva ya está ${reserva[0].estado}` 
      });
    }

    const [result] = await db.promise().query(
      `UPDATE reservas SET estado = 'confirmada' WHERE id = ?`, 
      [reservaId]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('No se pudo actualizar la reserva');
    }

    const [reservaActualizada] = await db.promise().query(`
      SELECT r.*, 
             p.nombre AS pistaNombre, 
             p.tipo AS pistaTipo,
             poli.nombre AS polideportivo_nombre
      FROM reservas r
      LEFT JOIN pistas p ON r.pista_id = p.id
      LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
      WHERE r.id = ?`, 
      [reservaId]
    );

    await db.promise().query('COMMIT');
    
    // Agregar campo ludoteca para compatibilidad
    const reservaConLudoteca = {
      ...reservaActualizada[0],
      ludoteca: false
    };

    res.json({ 
      success: true, 
      data: reservaConLudoteca, 
      message: 'Reserva confirmada exitosamente' 
    });

  } catch (error) {
    await db.promise().query('ROLLBACK');
    console.error('Error en el proceso de confirmación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al confirmar la reserva' 
    });
  }
});

// Cancelar reserva
router.put('/:id/cancelar', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  const sql = `UPDATE reservas SET estado = 'cancelada' WHERE id = ? AND estado = 'pendiente'`;
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error al cancelar reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada o ya no está pendiente' });
    }

    // Obtener reserva actualizada
    const selectSQL = `
      SELECT r.*, 
             p.nombre AS pistaNombre, 
             p.tipo AS pistaTipo,
             poli.nombre AS polideportivo_nombre
      FROM reservas r
      LEFT JOIN pistas p ON r.pista_id = p.id
      LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
      WHERE r.id = ?
    `;
    
    db.query(selectSQL, [id], (err, rows) => {
      if (err) {
        console.error('Error al obtener reserva actualizada:', err);
        return res.status(500).json({ success: false, error: 'Error al obtener reserva actualizada' });
      }
      
      // Agregar campo ludoteca para compatibilidad
      const reservaConLudoteca = {
        ...rows[0],
        ludoteca: false
      };

      res.json({ 
        success: true, 
        data: reservaConLudoteca, 
        message: 'Reserva cancelada correctamente' 
      });
    });
  });
});

// Actualizar reserva
router.put('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;
  const {
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado
  } = req.body;

  // Primero obtener la reserva actual
  const getReservaSQL = `SELECT * FROM reservas WHERE id = ?`;
  
  db.query(getReservaSQL, [id], (err, results) => {
    if (err) {
      console.error('Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const reservaActual = results[0];
    
    // Si se cambia la pista, fecha u horario, verificar disponibilidad
    if (pista_id || fecha || hora_inicio || hora_fin) {
      const pistaId = pista_id || reservaActual.pista_id;
      const fechaReserva = fecha || reservaActual.fecha;
      const horaInicio = hora_inicio || reservaActual.hora_inicio;
      const horaFin = hora_fin || reservaActual.hora_fin;

      const disponibilidadSQL = `
        SELECT * FROM reservas 
        WHERE pista_id = ? AND fecha = ? AND id != ? AND estado != 'cancelada' AND (
          (hora_inicio < ? AND hora_fin > ?) OR
          (hora_inicio >= ? AND hora_inicio < ?) OR
          (hora_fin > ? AND hora_fin <= ?)
        )
      `;

      db.query(disponibilidadSQL, [
        pistaId, fechaReserva, id, horaFin, horaInicio, horaInicio, horaFin, horaInicio, horaFin
      ], (err, results) => {
        if (err) {
          console.error('Error al comprobar disponibilidad:', err);
          return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
        }
        
        if (results.length > 0) {
          return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });
        }

        actualizarReserva();
      });
    } else {
      actualizarReserva();
    }

    function actualizarReserva() {
      const updateFields = [];
      const updateValues = [];

      if (pista_id) {
        updateFields.push('pista_id = ?');
        updateValues.push(pista_id);
        
        // Actualizar también polideportivo_id si cambia la pista
        const pistaSQL = `SELECT polideportivo_id FROM pistas WHERE id = ?`;
        db.query(pistaSQL, [pista_id], (err, pistaResults) => {
          if (err) {
            console.error('Error al obtener polideportivo de la pista:', err);
            return res.status(500).json({ success: false, error: 'Error al actualizar reserva' });
          }
          
          if (pistaResults.length > 0) {
            updateFields.push('polideportivo_id = ?');
            updateValues.push(pistaResults[0].polideportivo_id);
          }
          
          continuarActualizacion();
        });
      } else {
        continuarActualizacion();
      }

      function continuarActualizacion() {
        if (fecha) {
          updateFields.push('fecha = ?');
          updateValues.push(fecha);
        }
        
        if (hora_inicio) {
          updateFields.push('hora_inicio = ?');
          updateValues.push(hora_inicio);
        }
        
        if (hora_fin) {
          updateFields.push('hora_fin = ?');
          updateValues.push(hora_fin);
        }
        
        if (estado) {
          updateFields.push('estado = ?');
          updateValues.push(estado);
        }

        updateValues.push(id);

        if (updateFields.length === 0) {
          return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        }

        const updateSQL = `UPDATE reservas SET ${updateFields.join(', ')} WHERE id = ?`;
        
        db.query(updateSQL, updateValues, (err, result) => {
          if (err) {
            console.error('Error al actualizar reserva:', err);
            return res.status(500).json({ success: false, error: 'Error al actualizar reserva' });
          }

          // Obtener reserva actualizada
          const selectSQL = `
            SELECT r.*, 
                   p.nombre AS pistaNombre, 
                   p.tipo AS pistaTipo,
                   poli.nombre AS polideportivo_nombre
            FROM reservas r
            LEFT JOIN pistas p ON r.pista_id = p.id
            LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
            WHERE r.id = ?
          `;
          
          db.query(selectSQL, [id], (err, rows) => {
            if (err) {
              console.error('Error al obtener reserva actualizada:', err);
              return res.status(500).json({ success: false, error: 'Error al obtener reserva actualizada' });
            }
            
            // Agregar campo ludoteca para compatibilidad
            const reservaConLudoteca = {
              ...rows[0],
              ludoteca: false
            };

            res.json({ 
              success: true, 
              data: reservaConLudoteca, 
              message: 'Reserva actualizada correctamente' 
            });
          });
        });
      }
    }
  });
});

module.exports = router;