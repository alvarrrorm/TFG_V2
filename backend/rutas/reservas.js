const express = require('express');
const router = express.Router();

// Crear una reserva
router.post('/', (req, res) => {
  const db = req.app.get('conexion');

  const {
    dni_usuario,
    nombre_usuario,
    pista,
    fecha,
    hora_inicio,
    hora_fin,
    ludoteca = false,
    estado = 'pendiente'
  } = req.body;

  // Validación de campos obligatorios
  if (!dni_usuario || !nombre_usuario || !pista || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ 
      success: false,
      error: 'Faltan campos obligatorios' 
    });
  }

  const pistaId = Number(pista);
  if (isNaN(pistaId)) {
    return res.status(400).json({ 
      success: false,
      error: 'ID de pista inválido' 
    });
  }

  // Comprobar disponibilidad
  const comprobarDisponibilidadSQL = `
    SELECT * FROM reservas 
    WHERE pista = ? AND fecha = ? AND (
      (hora_inicio < ? AND hora_fin > ?) OR
      (hora_inicio >= ? AND hora_inicio < ?) OR
      (hora_fin > ? AND hora_fin <= ?)
    )
  `;

  db.query(
    comprobarDisponibilidadSQL,
    [pistaId, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin, hora_inicio, hora_fin],
    (err, results) => {
      if (err) {
        console.error('Error al comprobar disponibilidad:', err);
        return res.status(500).json({ 
          success: false,
          error: 'Error al comprobar disponibilidad' 
        });
      }

      if (results.length > 0) {
        return res.status(409).json({ 
          success: false,
          error: 'La pista no está disponible en el horario seleccionado' 
        });
      }

      // Obtener precio de la pista
      const precioSQL = `SELECT precio FROM pistas WHERE id = ? LIMIT 1`;

      db.query(precioSQL, [pistaId], (err, rows) => {
        if (err) {
          console.error('Error al obtener precio:', err);
          return res.status(500).json({ 
            success: false,
            error: 'Error al obtener precio de la pista' 
          });
        }

        if (rows.length === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'Pista no encontrada' 
          });
        }

        const precioHora = parseFloat(rows[0].precio);

        // Calcular duración en horas
        const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
        const [hFin, mFin] = hora_fin.split(':').map(Number);
        const duracion = ((hFin * 60 + mFin) - (hInicio * 60 + mInicio)) / 60;

        if (duracion <= 0) {
          return res.status(400).json({ 
            success: false,
            error: 'La hora de fin debe ser posterior a la hora de inicio' 
          });
        }

        const precioTotal = precioHora * duracion;

        const insertSQL = `
          INSERT INTO reservas 
          (dni_usuario, nombre_usuario, pista, fecha, hora_inicio, hora_fin, ludoteca, estado, precio, fecha_creacion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        db.query(
          insertSQL,
          [dni_usuario, nombre_usuario, pistaId, fecha, hora_inicio, hora_fin, ludoteca, estado, precioTotal],
          (err, result) => {
            if (err) {
              console.error('Error al insertar reserva:', err);
              return res.status(500).json({ 
                success: false,
                error: 'Error al crear reserva' 
              });
            }

          // En tu router.post('/') en reservas.js
// Después de crear la reserva:
const selectSQL = `
  SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
  FROM reservas r
  LEFT JOIN pistas p ON r.pista = p.id
  WHERE r.id = ?
`;

db.query(selectSQL, [result.insertId], (err, rows) => {
  if (err) {
    console.error('Error al obtener reserva creada:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener reserva creada' 
    });
  }
  if (rows.length === 0) {
    return res.status(404).json({ 
      success: false,
      error: 'Reserva no encontrada después de crearla' 
    });
  }
  
  res.status(201).json({
    success: true,
    data: rows[0] // Esto incluye el ID y todos los datos de la reserva
  });
});
          }
        );
      });
    }
  );
});

// Listar todas las reservas
router.get('/', (req, res) => {
  const db = req.app.get('conexion');

  const sql = `
    SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
    FROM reservas r
    LEFT JOIN pistas p ON r.pista = p.id
    ORDER BY r.fecha_creacion DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener reservas:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener reservas' 
      });
    }
    res.json({
      success: true,
      data: results
    });
  });
});

// Eliminar una reserva
router.delete('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  // Primero obtener la reserva para devolver info luego
  const selectSQL = `
    SELECT r.*, p.nombre AS nombre_pista
    FROM reservas r
    LEFT JOIN pistas p ON r.pista = p.id
    WHERE r.id = ?
  `;

  db.query(selectSQL, [id], (err, rows) => {
    if (err) {
      console.error('Error al obtener reserva:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor' 
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Reserva no encontrada' 
      });
    }

    const reserva = rows[0];

    // Ahora borrar la reserva
    const deleteSQL = 'DELETE FROM reservas WHERE id = ?';

    db.query(deleteSQL, [id], (err, result) => {
      if (err) {
        console.error('Error al eliminar reserva:', err);
        return res.status(500).json({ 
          success: false,
          error: 'Error interno del servidor' 
        });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Reserva no encontrada' 
        });
      }

      // Devolver datos de la reserva borrada
      res.json({
        success: true,
        data: {
          id: reserva.id,
          nombre_pista: reserva.nombre_pista,
          fecha: reserva.fecha,
          precio: reserva.precio,
          estado: reserva.estado,
        },
        message: 'Reserva eliminada correctamente'
      });
    });
  });
});
router.put('/:id/pagar', async (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  // Validación más robusta
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ 
      success: false,
      error: 'ID de reserva inválido' 
    });
  }

  const reservaId = parseInt(id);

  try {
    // Iniciar transacción para mayor seguridad
    await db.promise().query('START TRANSACTION');

    // 1. Verificar que la reserva existe y está pendiente
    const [reserva] = await db.promise().query(
      `SELECT id, estado FROM reservas WHERE id = ? FOR UPDATE`,
      [reservaId]
    );

    if (!reserva || reserva.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada'
      });
    }

    if (reserva[0].estado !== 'pendiente') {
      await db.promise().query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `La reserva ya está ${reserva[0].estado}`
      });
    }

    // 2. Actualizar el estado a pagado
    const [result] = await db.promise().query(
      `UPDATE reservas SET estado = 'pagado', fecha_pago = NOW() WHERE id = ?`,
      [reservaId]
    );

    if (result.affectedRows === 0) {
      await db.promise().query('ROLLBACK');
      throw new Error('No se pudo actualizar la reserva');
    }

    // 3. Obtener los datos actualizados para la respuesta
    const [reservaActualizada] = await db.promise().query(
      `SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
       FROM reservas r
       JOIN pistas p ON r.pista = p.id
       WHERE r.id = ?`,
      [reservaId]
    );

    // Confirmar la transacción
    await db.promise().query('COMMIT');

    // Respuesta exitosa
    res.json({
      success: true,
      data: reservaActualizada[0],
      message: 'Pago registrado exitosamente'
    });

  } catch (error) {
    await db.promise().query('ROLLBACK');
    console.error('Error en el proceso de pago:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar el pago'
    });
  }
});
// Listar reservas filtradas por DNI del usuario
router.get('/', (req, res) => {
  const db = req.app.get('conexion');
  const { dni_usuario } = req.query;

  // Validar que se proporcionó un DNI
  if (!dni_usuario) {
    return res.status(400).json({ 
      success: false,
      error: 'Se requiere el DNI del usuario' 
    });
  }

  const sql = `
    SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
    FROM reservas r
    LEFT JOIN pistas p ON r.pista = p.id
    WHERE r.dni_usuario = ?
    ORDER BY r.fecha DESC, r.hora_inicio DESC
  `;

  db.query(sql, [dni_usuario], (err, results) => {
    if (err) {
      console.error('Error al obtener reservas:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener reservas' 
      });
    }
    
    res.json({
      success: true,
      data: results
    });
  });
});


// Eliminar una reserva
router.delete('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  // Primero verificar que la reserva pertenece al usuario
  const verificarSQL = 'SELECT dni_usuario FROM reservas WHERE id = ?';
  
  db.query(verificarSQL, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false,
        error: 'Error al verificar reserva' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Reserva no encontrada' 
      });
    }

    // Opcional: Verificar que el usuario es el dueño de la reserva
    // if (results[0].dni_usuario !== req.user.dni) {
    //   return res.status(403).json({ 
    //     success: false,
    //     error: 'No tienes permiso para cancelar esta reserva' 
    //   });
    // }

    // Eliminar la reserva
    const deleteSQL = 'DELETE FROM reservas WHERE id = ?';
    
    db.query(deleteSQL, [id], (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false,
          error: 'Error al eliminar reserva' 
        });
      }

      res.json({
        success: true,
        message: 'Reserva cancelada correctamente'
      });
    });
  });
});
module.exports = router;