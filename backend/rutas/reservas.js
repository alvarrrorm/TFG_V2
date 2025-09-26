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

  if (!dni_usuario || !nombre_usuario || !pista || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }

  const pistaId = Number(pista);
  if (isNaN(pistaId)) {
    return res.status(400).json({ success: false, error: 'ID de pista inválido' });
  }

  // Comprobar disponibilidad de la pista
  const disponibilidadSQL = `
    SELECT * FROM reservas 
    WHERE pista = ? AND fecha = ? AND (
      (hora_inicio < ? AND hora_fin > ?) OR
      (hora_inicio >= ? AND hora_inicio < ?) OR
      (hora_fin > ? AND hora_fin <= ?)
    )
  `;

  db.query(disponibilidadSQL, [pistaId, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin, hora_inicio, hora_fin], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
    if (results.length > 0) return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });

    // Comprobar que el usuario no tenga otra reserva en ese horario
    const usuarioSQL = `
      SELECT * FROM reservas 
      WHERE dni_usuario = ? AND fecha = ? AND (
        (hora_inicio < ? AND hora_fin > ?) OR
        (hora_inicio >= ? AND hora_inicio < ?) OR
        (hora_fin > ? AND hora_fin <= ?)
      )
    `;
    db.query(usuarioSQL, [dni_usuario, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin, hora_inicio, hora_fin], (err, results) => {
      if (err) return res.status(500).json({ success: false, error: 'Error al comprobar reservas del usuario' });
      if (results.length > 0) return res.status(409).json({ success: false, error: 'Ya tienes otra reserva en este horario' });

      // Obtener precio de la pista
      const precioSQL = `SELECT precio FROM pistas WHERE id = ? LIMIT 1`;
      db.query(precioSQL, [pistaId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'Error al obtener precio de la pista' });
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Pista no encontrada' });

        const precioHora = parseFloat(rows[0].precio);
        if (isNaN(precioHora)) return res.status(500).json({ success: false, error: 'Precio de la pista inválido' });

        // Calcular duración en horas
        const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
        const [hFin, mFin] = hora_fin.split(':').map(Number);
        const duracion = ((hFin * 60 + mFin) - (hInicio * 60 + mInicio)) / 60;
        if (duracion <= 0) return res.status(400).json({ success: false, error: 'La hora de fin debe ser posterior a la hora de inicio' });

        let precioTotal = parseFloat((precioHora * duracion).toFixed(2));

        // 👉 AÑADIR SUPLEMENTO DE LUDOTECA (+5 €)
        if (ludoteca) {
          precioTotal += 5;
        }

        // Insertar reserva
        const insertSQL = `
          INSERT INTO reservas 
          (dni_usuario, nombre_usuario, pista, fecha, hora_inicio, hora_fin, ludoteca, estado, precio, fecha_creacion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        db.query(insertSQL, [dni_usuario, nombre_usuario, pistaId, fecha, hora_inicio, hora_fin, ludoteca ? 1 : 0, estado, precioTotal], (err, result) => {
          if (err) return res.status(500).json({ success: false, error: 'Error al crear reserva' });

          // Devolver reserva creada
          const selectSQL = `
            SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
            FROM reservas r
            LEFT JOIN pistas p ON r.pista = p.id
            WHERE r.id = ?
          `;
          db.query(selectSQL, [result.insertId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: 'Error al obtener reserva creada' });
            if (rows.length === 0) return res.status(404).json({ success: false, error: 'Reserva no encontrada después de crearla' });

            res.status(201).json({ success: true, data: rows[0] });
          });
        });
      });
    });
  });
});

// Listar todas las reservas o por DNI de usuario
router.get('/', (req, res) => {
  const db = req.app.get('conexion');
  const { dni_usuario } = req.query;

  let sql = `
    SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
    FROM reservas r
    LEFT JOIN pistas p ON r.pista = p.id
  `;
  const params = [];

  if (dni_usuario) {
    sql += ` WHERE r.dni_usuario = ?`;
    params.push(dni_usuario);
    sql += ` ORDER BY r.fecha DESC, r.hora_inicio DESC`;
  } else {
    sql += ` ORDER BY r.fecha_creacion DESC`;
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    res.json({ success: true, data: results });
  });
});

// Eliminar una reserva
router.delete('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  const selectSQL = `
    SELECT r.*, p.nombre AS nombre_pista
    FROM reservas r
    LEFT JOIN pistas p ON r.pista = p.id
    WHERE r.id = ?
  `;
  db.query(selectSQL, [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Reserva no encontrada' });

    const deleteSQL = `DELETE FROM reservas WHERE id = ?`;
    db.query(deleteSQL, [id], (err, result) => {
      if (err) return res.status(500).json({ success: false, error: 'Error al eliminar reserva' });
      res.json({ success: true, data: rows[0], message: 'Reserva eliminada correctamente' });
    });
  });
});

// Marcar reserva como pagada
router.put('/:id/pagar', async (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  try {
    await db.promise().query('START TRANSACTION');

    const [reserva] = await db.promise().query(`SELECT id, estado FROM reservas WHERE id = ? FOR UPDATE`, [reservaId]);
    if (!reserva || reserva.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    if (reserva[0].estado !== 'pendiente') {
      await db.promise().query('ROLLBACK');
      return res.status(400).json({ success: false, error: `La reserva ya está ${reserva[0].estado}` });
    }

    const [result] = await db.promise().query(`UPDATE reservas SET estado = 'pagado', fecha_pago = NOW() WHERE id = ?`, [reservaId]);
    if (result.affectedRows === 0) throw new Error('No se pudo actualizar la reserva');

    const [reservaActualizada] = await db.promise().query(`
      SELECT r.*, p.nombre AS nombre_pista, p.tipo AS tipo_pista
      FROM reservas r
      JOIN pistas p ON r.pista = p.id
      WHERE r.id = ?`, [reservaId]);

    await db.promise().query('COMMIT');
    res.json({ success: true, data: reservaActualizada[0], message: 'Pago registrado exitosamente' });

  } catch (error) {
    await db.promise().query('ROLLBACK');
    console.error('Error en el proceso de pago:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al procesar el pago' });
  }
});

module.exports = router;
