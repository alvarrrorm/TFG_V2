const express = require('express');
const router = express.Router();

// 👇 FUNCIÓN REUTILIZABLE PARA FORMATEAR FECHA PARA MYSQL
const formatearFechaParaMySQL = (fechaInput) => {
  if (!fechaInput) return null;
  
  console.log('🔄 Formateando fecha recibida:', fechaInput, 'Tipo:', typeof fechaInput);
  
  // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
  if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
    console.log('✅ Fecha ya en formato correcto:', fechaInput);
    return fechaInput;
  }
  
  // Si es un string ISO (con hora y timezone), extraer solo la fecha
  if (typeof fechaInput === 'string' && fechaInput.includes('T')) {
    try {
      const fechaObj = new Date(fechaInput);
      if (isNaN(fechaObj.getTime())) {
        console.error('❌ Fecha ISO inválida:', fechaInput);
        return null;
      }
      
      const año = fechaObj.getFullYear();
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      
      const fechaFormateada = `${año}-${mes}-${dia}`;
      console.log('📅 Fecha ISO convertida:', fechaInput, '→', fechaFormateada);
      return fechaFormateada;
    } catch (error) {
      console.error('❌ Error formateando fecha ISO:', error);
      return null;
    }
  }
  
  // Si es un objeto Date
  if (fechaInput instanceof Date) {
    if (isNaN(fechaInput.getTime())) {
      console.error('❌ Objeto Date inválido');
      return null;
    }
    
    const año = fechaInput.getFullYear();
    const mes = String(fechaInput.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaInput.getDate()).padStart(2, '0');
    
    const fechaFormateada = `${año}-${mes}-${dia}`;
    console.log('📅 Objeto Date convertido:', fechaInput, '→', fechaFormateada);
    return fechaFormateada;
  }
  
  // Si es un timestamp numérico
  if (typeof fechaInput === 'number') {
    try {
      const fechaObj = new Date(fechaInput);
      if (isNaN(fechaObj.getTime())) {
        console.error('❌ Timestamp inválido:', fechaInput);
        return null;
      }
      
      const año = fechaObj.getFullYear();
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      
      const fechaFormateada = `${año}-${mes}-${dia}`;
      console.log('📅 Timestamp convertido:', fechaInput, '→', fechaFormateada);
      return fechaFormateada;
    } catch (error) {
      console.error('❌ Error formateando timestamp:', error);
      return null;
    }
  }
  
  console.error('❌ Formato de fecha no reconocido:', fechaInput);
  return null;
};

// 👇 FUNCIÓN PARA VALIDAR HORA
const validarHora = (hora) => {
  if (!hora) return false;
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hora);
};

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
    estado = 'pendiente',
    precio
  } = req.body;

  console.log('📥 Creando nueva reserva con datos:', {
    nombre_usuario, pista_id, fecha, hora_inicio, hora_fin, ludoteca, precio
  });

  // Validaciones básicas
  if (!nombre_usuario || !pista_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }

  if (!validarHora(hora_inicio) || !validarHora(hora_fin)) {
    return res.status(400).json({ success: false, error: 'Formato de hora inválido' });
  }

  const pistaId = Number(pista_id);
  if (isNaN(pistaId)) {
    return res.status(400).json({ success: false, error: 'ID de pista inválido' });
  }

  // Formatear fecha para MySQL
  const fechaFormateada = formatearFechaParaMySQL(fecha);
  if (!fechaFormateada) {
    return res.status(400).json({ success: false, error: 'Fecha inválida' });
  }

  console.log('📅 Fecha formateada para MySQL:', fechaFormateada);

  // Primero obtener información de la pista y su polideportivo
  const pistaSQL = `
    SELECT p.*, poli.id as polideportivo_id 
    FROM pistas p 
    LEFT JOIN polideportivos poli ON p.polideportivo_id = poli.id 
    WHERE p.id = ? AND p.disponible = 1
  `;

  db.query(pistaSQL, [pistaId], (err, pistaResults) => {
    if (err) {
      console.error('❌ Error al obtener información de la pista:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener información de la pista' });
    }

    if (pistaResults.length === 0) {
      return res.status(404).json({ success: false, error: 'Pista no encontrada o no disponible' });
    }

    const pista = pistaResults[0];
    const polideportivoId = pista.polideportivo_id;
    const usuarioId = 0; // Valor temporal

    console.log('📍 Pista seleccionada:', pista.nombre, 'Polideportivo:', polideportivoId);

    // Comprobar disponibilidad de la pista
    const disponibilidadSQL = `
      SELECT * FROM reservas 
      WHERE pista_id = ? AND fecha = ? AND estado != 'cancelada' AND (
        (hora_inicio < ? AND hora_fin > ?) OR
        (hora_inicio >= ? AND hora_inicio < ?) OR
        (hora_fin > ? AND hora_fin <= ?)
      )
    `;

    db.query(disponibilidadSQL, [
      pistaId, fechaFormateada, 
      hora_fin, hora_inicio, 
      hora_inicio, hora_fin, 
      hora_inicio, hora_fin
    ], (err, results) => {
      if (err) {
        console.error('❌ Error al comprobar disponibilidad:', err);
        return res.status(500).json({ success: false, error: 'Error al comprobar disponibilidad' });
      }
      
      if (results.length > 0) {
        console.log('🚫 Pista no disponible - Conflictos encontrados:', results);
        return res.status(409).json({ success: false, error: 'La pista no está disponible en el horario seleccionado' });
      }

      // Comprobar que el usuario no tenga otra reserva en ese horario
      const usuarioSQL = `
        SELECT * FROM reservas 
        WHERE nombre_usuario = ? AND fecha = ? AND estado != 'cancelada' AND (
          (hora_inicio < ? AND hora_fin > ?) OR
          (hora_inicio >= ? AND hora_inicio < ?) OR
          (hora_fin > ? AND hora_fin <= ?)
        )
      `;
      
      db.query(usuarioSQL, [
        nombre_usuario, fechaFormateada,
        hora_fin, hora_inicio,
        hora_inicio, hora_fin,
        hora_inicio, hora_fin
      ], (err, results) => {
        if (err) {
          console.error('❌ Error al comprobar reservas del usuario:', err);
          return res.status(500).json({ success: false, error: 'Error al comprobar reservas del usuario' });
        }
        
        if (results.length > 0) {
          console.log('🚫 Usuario ya tiene reserva en ese horario');
          return res.status(409).json({ success: false, error: 'Ya tienes otra reserva en este horario' });
        }

        // Calcular precio si no se envió
        let precioFinal = precio;
        if (precio === undefined) {
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

          precioFinal = parseFloat((precioHora * duracion).toFixed(2));

          // Añadir suplemento de ludoteca
          if (ludoteca) {
            precioFinal += 5;
          }
        }

        console.log('💰 Precio calculado:', precioFinal);

        // Insertar reserva
        const insertSQL = `
          INSERT INTO reservas 
          (pista_id, polideportivo_id, usuario_id, nombre_usuario, fecha, hora_inicio, hora_fin, precio, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.query(insertSQL, [
          pistaId, 
          polideportivoId, 
          usuarioId,
          nombre_usuario, 
          fechaFormateada,  // 👈 Usar fecha formateada
          hora_inicio, 
          hora_fin, 
          precioFinal,
          estado
        ], (err, result) => {
          if (err) {
            console.error('❌ Error al crear reserva:', err);
            console.error('Detalles del error:', err.sqlMessage);
            return res.status(500).json({ success: false, error: 'Error al crear reserva' });
          }

          console.log('✅ Reserva creada con ID:', result.insertId);

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
              console.error('❌ Error al obtener reserva creada:', err);
              return res.status(500).json({ success: false, error: 'Error al obtener reserva creada' });
            }
            
            if (rows.length === 0) {
              return res.status(404).json({ success: false, error: 'Reserva no encontrada después de crearla' });
            }

            const reservaConLudoteca = {
              ...rows[0],
              ludoteca: ludoteca
            };

            console.log('🎉 Reserva creada exitosamente');
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

  console.log('📋 Obteniendo reservas para usuario:', nombre_usuario);

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
      console.error('❌ Error al obtener reservas:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    }
    
    console.log(`📊 Se encontraron ${results.length} reservas`);
    
    const reservasConLudoteca = results.map(reserva => ({
      ...reserva,
      ludoteca: false
    }));

    res.json({ success: true, data: reservasConLudoteca });
  });
});

// Obtener reserva por ID
router.get('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  console.log('🔍 Obteniendo reserva con ID:', id);

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
      console.error('❌ Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (results.length === 0) {
      console.log('❌ Reserva no encontrada ID:', id);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    console.log('✅ Reserva encontrada:', results[0].id);

    const reservaConLudoteca = {
      ...results[0],
      ludoteca: false
    };

    res.json({ success: true, data: reservaConLudoteca });
  });
});

// Obtener disponibilidad
router.get('/disponibilidad', (req, res) => {
  const db = req.app.get('conexion');
  const { fecha, polideportivo } = req.query;

  console.log('📅 Consultando disponibilidad - Fecha:', fecha, 'Polideportivo:', polideportivo);

  if (!fecha || !polideportivo) {
    return res.status(400).json({ success: false, error: 'Fecha y polideportivo son requeridos' });
  }

  // Formatear fecha para MySQL
  const fechaFormateada = formatearFechaParaMySQL(fecha);
  if (!fechaFormateada) {
    return res.status(400).json({ success: false, error: 'Fecha inválida' });
  }

  console.log('📅 Fecha formateada para consulta:', fechaFormateada);

  const sql = `
    SELECT r.*, 
           p.nombre AS pistaNombre, 
           p.tipo AS pistaTipo,
           poli.nombre AS polideportivo_nombre
    FROM reservas r
    LEFT JOIN pistas p ON r.pista_id = p.id
    LEFT JOIN polideportivos poli ON r.polideportivo_id = poli.id
    WHERE r.fecha = ? 
      AND r.polideportivo_id = ?
      AND r.estado != 'cancelada'
    ORDER BY r.hora_inicio
  `;

  db.query(sql, [fechaFormateada, polideportivo], (err, results) => {
    if (err) {
      console.error('❌ Error al obtener disponibilidad:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener disponibilidad' });
    }
    
    console.log(`📊 Se encontraron ${results.length} reservas activas para la fecha`);
    
    res.json({ success: true, data: results });
  });
});

// Eliminar una reserva
router.delete('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  console.log('🗑️ Eliminando reserva ID:', id);

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
      console.error('❌ Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (rows.length === 0) {
      console.log('❌ Reserva no encontrada para eliminar ID:', id);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const deleteSQL = `DELETE FROM reservas WHERE id = ?`;
    db.query(deleteSQL, [id], (err, result) => {
      if (err) {
        console.error('❌ Error al eliminar reserva:', err);
        return res.status(500).json({ success: false, error: 'Error al eliminar reserva' });
      }
      
      console.log('✅ Reserva eliminada correctamente ID:', id);
      
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

// Marcar reserva como confirmada
router.put('/:id/confirmar', async (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;

  console.log('✅ Confirmando reserva ID:', id);

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
      console.log('❌ Reserva no encontrada para confirmar ID:', reservaId);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    
    if (reserva[0].estado !== 'pendiente') {
      await db.promise().query('ROLLBACK');
      console.log('❌ Reserva ya confirmada ID:', reservaId, 'Estado:', reserva[0].estado);
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
    
    console.log('✅ Reserva confirmada exitosamente ID:', reservaId);
    
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
    console.error('❌ Error en el proceso de confirmación:', error);
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

  console.log('❌ Cancelando reserva ID:', id);

  const sql = `UPDATE reservas SET estado = 'cancelada' WHERE id = ? AND estado = 'pendiente'`;
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('❌ Error al cancelar reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
    }

    if (result.affectedRows === 0) {
      console.log('❌ Reserva no encontrada o ya no está pendiente ID:', id);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada o ya no está pendiente' });
    }

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
        console.error('❌ Error al obtener reserva actualizada:', err);
        return res.status(500).json({ success: false, error: 'Error al obtener reserva actualizada' });
      }
      
      console.log('✅ Reserva cancelada correctamente ID:', id);
      
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

// 👇 RUTA ACTUALIZAR RESERVA CORREGIDA - VERSIÓN COMPLETA
router.put('/:id', (req, res) => {
  const db = req.app.get('conexion');
  const { id } = req.params;
  const {
    pista_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado,
    precio,
    ludoteca = false
  } = req.body;

  console.log('📥 Actualizando reserva ID:', id);
  console.log('Datos recibidos:', {
    pista_id, fecha, hora_inicio, hora_fin, estado, precio, ludoteca
  });

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, error: 'ID de reserva inválido' });
  }

  const reservaId = parseInt(id);

  // Primero obtener la reserva actual
  const getReservaSQL = `SELECT * FROM reservas WHERE id = ?`;
  
  db.query(getReservaSQL, [reservaId], (err, results) => {
    if (err) {
      console.error('❌ Error al obtener reserva:', err);
      return res.status(500).json({ success: false, error: 'Error al obtener reserva' });
    }
    
    if (results.length === 0) {
      console.log('❌ Reserva no encontrada ID:', reservaId);
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const reservaActual = results[0];
    console.log('📋 Reserva actual:', reservaActual);
    
    // Función para verificar disponibilidad
    const verificarDisponibilidad = (callback) => {
      if (pista_id || fecha || hora_inicio || hora_fin) {
        const pistaId = pista_id || reservaActual.pista_id;
        const fechaReserva = fecha ? formatearFechaParaMySQL(fecha) : reservaActual.fecha;
        const horaInicio = hora_inicio || reservaActual.hora_inicio;
        const horaFin = hora_fin || reservaActual.hora_fin;

        console.log('🔍 Verificando disponibilidad con:', {
          pistaId, fechaReserva, horaInicio, horaFin, reservaId
        });

        if (!fechaReserva) {
          return callback(new Error('Fecha inválida'));
        }

        if (hora_inicio && !validarHora(hora_inicio)) {
          return callback(new Error('Formato de hora de inicio inválido'));
        }

        if (hora_fin && !validarHora(hora_fin)) {
          return callback(new Error('Formato de hora de fin inválido'));
        }

        const disponibilidadSQL = `
          SELECT * FROM reservas 
          WHERE pista_id = ? 
          AND fecha = ? 
          AND id != ? 
          AND estado != 'cancelada' 
          AND (
            (hora_inicio < ? AND hora_fin > ?) OR
            (hora_inicio >= ? AND hora_inicio < ?) OR
            (hora_fin > ? AND hora_fin <= ?)
          )
        `;

        db.query(disponibilidadSQL, [
          pistaId, fechaReserva, reservaId, 
          horaFin, horaInicio, 
          horaInicio, horaFin, 
          horaInicio, horaFin
        ], (err, results) => {
          if (err) {
            console.error('❌ Error al comprobar disponibilidad:', err);
            return callback(new Error('Error al comprobar disponibilidad'));
          }
          
          if (results.length > 0) {
            console.log('🚫 Conflicto de disponibilidad encontrado:', results);
            return callback(new Error('La pista no está disponible en el horario seleccionado'));
          }

          console.log('✅ Disponibilidad verificada - Sin conflictos');
          callback(null);
        });
      } else {
        callback(null);
      }
    };

    // Función para obtener el polideportivo_id si se cambia la pista
    const obtenerPolideportivoId = (callback) => {
      if (pista_id && pista_id !== reservaActual.pista_id) {
        console.log('🔄 Cambiando pista, obteniendo nuevo polideportivo_id');
        const pistaSQL = `SELECT polideportivo_id FROM pistas WHERE id = ?`;
        db.query(pistaSQL, [pista_id], (err, pistaResults) => {
          if (err) {
            console.error('❌ Error al obtener polideportivo de la pista:', err);
            return callback(new Error('Error al obtener información de la pista'));
          }
          
          if (pistaResults.length === 0) {
            return callback(new Error('Pista no encontrada'));
          }

          console.log('📍 Nuevo polideportivo_id:', pistaResults[0].polideportivo_id);
          callback(null, pistaResults[0].polideportivo_id);
        });
      } else {
        callback(null, null);
      }
    };

    // Función para actualizar la reserva
    const actualizarReserva = (nuevoPolideportivoId) => {
      const updateFields = [];
      const updateValues = [];

      // Campos a actualizar
      if (pista_id !== undefined) {
        updateFields.push('pista_id = ?');
        updateValues.push(pista_id);
      }

      if (fecha !== undefined) {
        const fechaFormateada = formatearFechaParaMySQL(fecha);
        if (!fechaFormateada) {
          return res.status(400).json({ success: false, error: 'Fecha inválida' });
        }
        updateFields.push('fecha = ?');
        updateValues.push(fechaFormateada);
      }

      if (hora_inicio !== undefined) {
        if (!validarHora(hora_inicio)) {
          return res.status(400).json({ success: false, error: 'Formato de hora de inicio inválido' });
        }
        updateFields.push('hora_inicio = ?');
        updateValues.push(hora_inicio);
      }

      if (hora_fin !== undefined) {
        if (!validarHora(hora_fin)) {
          return res.status(400).json({ success: false, error: 'Formato de hora de fin inválido' });
        }
        updateFields.push('hora_fin = ?');
        updateValues.push(hora_fin);
      }

      if (precio !== undefined) {
        const precioNum = parseFloat(precio);
        if (isNaN(precioNum)) {
          return res.status(400).json({ success: false, error: 'Precio inválido' });
        }
        updateFields.push('precio = ?');
        updateValues.push(precioNum);
      }

      if (estado !== undefined) {
        updateFields.push('estado = ?');
        updateValues.push(estado);
      }

      // Si tenemos un nuevo polideportivo_id, actualizarlo
      if (nuevoPolideportivoId !== null) {
        updateFields.push('polideportivo_id = ?');
        updateValues.push(nuevoPolideportivoId);
      }

      if (updateFields.length === 0) {
        console.log('❌ No hay campos para actualizar');
        return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
      }

      updateValues.push(reservaId);

      console.log('🔄 Campos a actualizar:', updateFields);
      console.log('📊 Valores:', updateValues);

      const updateSQL = `UPDATE reservas SET ${updateFields.join(', ')} WHERE id = ?`;
      
      db.query(updateSQL, updateValues, (err, result) => {
        if (err) {
          console.error('❌ Error al actualizar reserva:', err);
          console.error('Detalles del error SQL:', err.sqlMessage);
          return res.status(500).json({ success: false, error: 'Error al actualizar reserva en la base de datos' });
        }

        console.log('✅ Reserva actualizada en BD. Filas afectadas:', result.affectedRows);

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
        
        db.query(selectSQL, [reservaId], (err, rows) => {
          if (err) {
            console.error('❌ Error al obtener reserva actualizada:', err);
            return res.status(500).json({ success: false, error: 'Error al obtener reserva actualizada' });
          }
          
          if (rows.length === 0) {
            console.log('❌ Reserva no encontrada después de actualizar ID:', reservaId);
            return res.status(404).json({ success: false, error: 'Reserva no encontrada después de actualizar' });
          }

          console.log('📄 Reserva actualizada obtenida:', rows[0]);

          const reservaConLudoteca = {
            ...rows[0],
            ludoteca: ludoteca
          };

          console.log('🎉 Reserva actualizada correctamente ID:', reservaId);
          
          res.json({ 
            success: true, 
            data: reservaConLudoteca, 
            message: 'Reserva actualizada correctamente' 
          });
        });
      });
    };

    // Flujo principal: Verificar disponibilidad -> Obtener polideportivo -> Actualizar
    verificarDisponibilidad((errorDisponibilidad) => {
      if (errorDisponibilidad) {
        console.log('🚫 Error de disponibilidad:', errorDisponibilidad.message);
        return res.status(409).json({ success: false, error: errorDisponibilidad.message });
      }

      obtenerPolideportivoId((errorPolideportivo, nuevoPolideportivoId) => {
        if (errorPolideportivo) {
          console.log('🚫 Error obteniendo polideportivo:', errorPolideportivo.message);
          return res.status(400).json({ success: false, error: errorPolideportivo.message });
        }

        actualizarReserva(nuevoPolideportivoId);
      });
    });
  });
});

module.exports = router;