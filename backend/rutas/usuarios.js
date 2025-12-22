const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Sistema de roles jerárquicos
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_POLIDEPORTIVO: 'admin_poli',
  USUARIO: 'usuario'
};

const NIVELES_PERMISO = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN_POLIDEPORTIVO]: 50,
  [ROLES.USUARIO]: 10
};

// Middleware para verificar roles con nivel mínimo
const verificarRol = (nivelMinimo) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ 
          success: false, 
          error: 'No autorizado - Token faltante' 
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'No autorizado - Token inválido' 
        });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verificar nivel de permiso
      const nivelUsuario = NIVELES_PERMISO[decoded.rol];
      
      if (!nivelUsuario || nivelUsuario < nivelMinimo) {
        return res.status(403).json({ 
          success: false, 
          error: 'Acceso denegado - Permisos insuficientes' 
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      console.error('Error en verificación de rol:', error);
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }
  };
};

// Middleware para filtrar por polideportivo (para admin_poli)
const filtrarPorPolideportivo = async (req, res, next) => {
  try {
    // Si no es admin_poli, no aplicar filtro
    if (req.user.rol !== ROLES.ADMIN_POLIDEPORTIVO) {
      return next();
    }

    const supabase = req.app.get('supabase');
    
    // Obtener el polideportivo_id del admin
    const { data: adminData, error } = await supabase
      .from('usuarios')
      .select('polideportivo_id')
      .eq('id', req.user.id)
      .single();
    
    if (error || !adminData) {
      console.error('Error al obtener datos del admin:', error);
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }
    
    if (!adminData.polideportivo_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin de polideportivo no tiene polideportivo asignado' 
      });
    }
    
    req.user.polideportivo_id = adminData.polideportivo_id;
    next();
  } catch (error) {
    console.error('Error en filtrarPorPolideportivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

// Middleware para usar en otras rutas (pistas, reservas)
const middlewarePolideportivo = [
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]),
  filtrarPorPolideportivo
];

// Ruta 1: Obtener todos los usuarios (solo super_admin)
router.get('/', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono, 
        fecha_creacion, fecha_actualizacion,
        polideportivo_id,
        polideportivos (id, nombre)
      `)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    res.json({ 
      success: true, 
      data: usuarios 
    });
  } catch (error) {
    console.error('Error en GET /api/usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener usuarios: ' + error.message 
    });
  }
});

// Ruta 1b: Endpoint especial para frontend con información completa
router.get('/con-poli', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono, 
        fecha_creacion, fecha_actualizacion,
        polideportivo_id,
        polideportivos (id, nombre, direccion, telefono)
      `)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    res.json({ 
      success: true, 
      data: usuarios 
    });
  } catch (error) {
    console.error('Error en GET /api/usuarios/con-poli:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener usuarios: ' + error.message 
    });
  }
});

// Ruta 2: Obtener usuarios de un polideportivo
router.get('/polideportivo/:id?', 
  verificarRol(NIVELES_PERMISO[ROLES.ADMIN_POLIDEPORTIVO]), 
  filtrarPorPolideportivo,
  async (req, res) => {
    try {
      const supabase = req.app.get('supabase');
      
      let polideportivoId = req.params.id;
      
      // Si es admin_poli, forzar su polideportivo
      if (req.user.rol === ROLES.ADMIN_POLIDEPORTIVO) {
        if (polideportivoId && parseInt(polideportivoId) !== req.user.polideportivo_id) {
          return res.status(403).json({ 
            success: false, 
            error: 'Solo puedes ver usuarios de tu polideportivo' 
          });
        }
        polideportivoId = req.user.polideportivo_id;
      }
      
      // Si es super_admin y no especifica polideportivo, ver todos
      if (!polideportivoId && req.user.rol === ROLES.SUPER_ADMIN) {
        const { data: usuarios, error } = await supabase
          .from('usuarios')
          .select(`
            id, dni, nombre, correo, usuario, rol, telefono,
            fecha_creacion,
            polideportivo_id,
            polideportivos (id, nombre)
          `)
          .order('nombre');
          
        if (error) throw error;
        return res.json({ success: true, data: usuarios });
      }
      
      // Obtener usuarios del polideportivo específico
      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select(`
          id, dni, nombre, correo, usuario, rol, telefono,
          fecha_creacion,
          polideportivo_id,
          polideportivos (id, nombre)
        `)
        .eq('polideportivo_id', polideportivoId)
        .order('nombre');
      
      if (error) throw error;

      res.json({ 
        success: true, 
        data: usuarios 
      });
    } catch (error) {
      console.error('Error en GET /api/usuarios/polideportivo:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener usuarios: ' + error.message 
      });
    }
  }
);

// Ruta 3: Cambiar rol de usuario (solo super_admin)
router.put('/cambiar-rol/:id', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { id } = req.params;
    const { nuevoRol, passwordConfirmacion, polideportivo_id } = req.body;
    const adminId = req.user.id;

    // Validaciones
    if (!nuevoRol || !passwordConfirmacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos: nuevoRol y passwordConfirmacion son obligatorios' 
      });
    }

    // Validar rol permitido
    const rolesPermitidos = Object.values(ROLES);
    if (!rolesPermitidos.includes(nuevoRol)) {
      return res.status(400).json({ 
        success: false, 
        error: `Rol no válido. Debe ser: ${rolesPermitidos.join(', ')}` 
      });
    }

    // Si es admin_poli, validar polideportivo
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO) {
      if (!polideportivo_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Para asignar admin_poli se requiere polideportivo_id' 
        });
      }
      
      // Verificar que el polideportivo existe
      const { data: poliExistente, error: poliError } = await supabase
        .from('polideportivos')
        .select('id, nombre')
        .eq('id', polideportivo_id)
        .single();
        
      if (poliError || !poliExistente) {
        return res.status(404).json({ 
          success: false, 
          error: 'Polideportivo no encontrado' 
        });
      }
      
      // Verificar si ya hay otro admin para este polideportivo
      const { data: adminExistente, error: adminCheckError } = await supabase
        .from('usuarios')
        .select('id, usuario, nombre')
        .eq('rol', ROLES.ADMIN_POLIDEPORTIVO)
        .eq('polideportivo_id', polideportivo_id)
        .neq('id', id)
        .single();
      
      if (adminExistente) {
        return res.status(409).json({
          success: false,
          error: `Ya existe un administrador (${adminExistente.nombre}) para este polideportivo. Primero quita sus privilegios.`
        });
      }
    }

    // 1. Verificar contraseña del super admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('pass, usuario')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }

    const passwordValida = await bcrypt.compare(passwordConfirmacion, adminData.pass);
    if (!passwordValida) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña incorrecta. No tienes permisos para realizar esta acción.' 
      });
    }

    // 2. Verificar que el usuario existe
    const { data: usuarioExistente, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, rol, nombre, usuario')
      .eq('id', id)
      .single();

    if (usuarioError || !usuarioExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // 3. No permitir modificar a otro super admin
    if (usuarioExistente.rol === ROLES.SUPER_ADMIN && id !== adminId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'No puedes modificar a otro super administrador' 
      });
    }

    // 4. No permitir que un super admin se quite a sí mismo los privilegios
    if (parseInt(id) === adminId && nuevoRol !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ 
        success: false, 
        error: 'No puedes quitarte a ti mismo los privilegios de super administrador' 
      });
    }

    // 5. Preparar datos para actualizar
    const updateData = {
      rol: nuevoRol,
      fecha_actualizacion: new Date().toISOString()
    };

    // Asignar/remover polideportivo_id según el rol
    if (nuevoRol === ROLES.ADMIN_POLIDEPORTIVO) {
      updateData.polideportivo_id = polideportivo_id;
    } else {
      updateData.polideportivo_id = null;
    }

    // 6. Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, polideportivo_id,
        polideportivos (id, nombre)
      `)
      .single();

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      throw updateError;
    }

    // 7. Registrar acción
    console.log(`✅ CAMBIO DE ROL: Usuario ${usuarioExistente.nombre} (ID: ${id}) cambiado a rol ${nuevoRol} por super_admin ${adminData.usuario} (ID: ${adminId})`, {
      nuevoRol,
      polideportivo_id: nuevoRol === ROLES.ADMIN_POLIDEPORTIVO ? polideportivo_id : null,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true,
      message: `Rol actualizado a ${nuevoRol}${nuevoRol === ROLES.ADMIN_POLIDEPORTIVO ? ` para polideportivo ${polideportivo_id}` : ''}`,
      data: usuarioActualizado
    });

  } catch (error) {
    console.error('Error en PUT /api/usuarios/cambiar-rol:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al cambiar rol: ' + error.message 
    });
  }
});

// Ruta 4: Obtener polideportivos disponibles para asignar
router.get('/polideportivos/disponibles', 
  verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), 
  async (req, res) => {
    try {
      const supabase = req.app.get('supabase');
      
      // Obtener polideportivos que no tienen admin asignado
      const { data: polideportivos, error } = await supabase
        .from('polideportivos')
        .select(`
          id, nombre, direccion, telefono, created_at
        `)
        .order('nombre');

      if (error) throw error;

      res.json({ 
        success: true, 
        data: polideportivos 
      });
    } catch (error) {
      console.error('Error en GET /api/usuarios/polideportivos/disponibles:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener polideportivos: ' + error.message 
      });
    }
});

// Ruta 5: Mi perfil (cualquier usuario autenticado)
router.get('/mi-perfil', 
  verificarRol(NIVELES_PERMISO[ROLES.USUARIO]), 
  async (req, res) => {
    try {
      const supabase = req.app.get('supabase');
      
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select(`
          id, dni, nombre, correo, usuario, rol, telefono,
          fecha_creacion, fecha_actualizacion,
          polideportivo_id,
          polideportivos (id, nombre, direccion)
        `)
        .eq('id', req.user.id)
        .single();

      if (error) throw error;

      res.json({ 
        success: true, 
        data: usuario 
      });
    } catch (error) {
      console.error('Error en GET /api/usuarios/mi-perfil:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener perfil: ' + error.message 
      });
    }
});

// Ruta 6: Crear nuevo usuario (solo super_admin)
router.post('/', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { dni, nombre, correo, usuario, telefono, pass, rol, polideportivo_id } = req.body;

    // Validaciones básicas
    if (!dni || !nombre || !correo || !usuario || !pass || !rol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios' 
      });
    }

    // Validar rol
    if (!Object.values(ROLES).includes(rol)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rol no válido' 
      });
    }

    // Si es admin_poli, validar polideportivo
    if (rol === ROLES.ADMIN_POLIDEPORTIVO && !polideportivo_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Para rol admin_poli se requiere polideportivo_id' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(pass, 10);

    const datosUsuario = {
      dni,
      nombre,
      correo: correo.toLowerCase(),
      usuario,
      pass: hashedPassword,
      rol,
      fecha_creacion: new Date().toISOString()
    };

    if (telefono) {
      datosUsuario.telefono = telefono;
    }

    if (rol === ROLES.ADMIN_POLIDEPORTIVO) {
      datosUsuario.polideportivo_id = polideportivo_id;
    }

    const { data: nuevoUsuario, error } = await supabase
      .from('usuarios')
      .insert([datosUsuario])
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, polideportivo_id,
        polideportivos (id, nombre)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ 
      success: true, 
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario
    });

  } catch (error) {
    console.error('Error en POST /api/usuarios:', error);
    
    // Manejar errores de duplicados
    if (error.code === '23505') {
      const field = error.message.includes('dni') ? 'DNI' : 
                   error.message.includes('correo') ? 'correo' : 
                   error.message.includes('usuario') ? 'usuario' : 'campo único';
      return res.status(400).json({ 
        success: false, 
        error: `El ${field} ya está registrado` 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Error al crear usuario: ' + error.message 
    });
  }
});

// Ruta 7: Asignar/quitar admin de polideportivo específico
router.put('/admin-poli/:id', verificarRol(NIVELES_PERMISO[ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { id } = req.params;
    const { accion, polideportivo_id, passwordConfirmacion } = req.body;
    const adminId = req.user.id;

    // Validaciones
    if (!accion || !passwordConfirmacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos: accion y passwordConfirmacion son obligatorios' 
      });
    }

    if (accion === 'asignar' && !polideportivo_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Para asignar admin_poli se requiere polideportivo_id' 
      });
    }

    // 1. Verificar contraseña del super admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('pass, usuario')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }

    const passwordValida = await bcrypt.compare(passwordConfirmacion, adminData.pass);
    if (!passwordValida) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña incorrecta. No tienes permisos para realizar esta acción.' 
      });
    }

    // 2. Verificar que el usuario existe
    const { data: usuarioExistente, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, rol, nombre, usuario')
      .eq('id', id)
      .single();

    if (usuarioError || !usuarioExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // 3. No permitir modificar a otro super admin
    if (usuarioExistente.rol === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ 
        success: false, 
        error: 'No puedes modificar a un super administrador' 
      });
    }

    let updateData;
    let nuevoRol;
    let message;

    if (accion === 'asignar') {
      // Verificar que el polideportivo existe
      const { data: poliExistente, error: poliError } = await supabase
        .from('polideportivos')
        .select('id, nombre')
        .eq('id', polideportivo_id)
        .single();
        
      if (poliError || !poliExistente) {
        return res.status(404).json({ 
          success: false, 
          error: 'Polideportivo no encontrado' 
        });
      }

      // Verificar si ya hay otro admin para este polideportivo
      const { data: adminExistente, error: adminCheckError } = await supabase
        .from('usuarios')
        .select('id, usuario, nombre')
        .eq('rol', ROLES.ADMIN_POLIDEPORTIVO)
        .eq('polideportivo_id', polideportivo_id)
        .neq('id', id)
        .single();
      
      if (adminExistente) {
        return res.status(409).json({
          success: false,
          error: `Ya existe un administrador (${adminExistente.nombre}) para este polideportivo. Primero quita sus privilegios.`
        });
      }

      updateData = {
        rol: ROLES.ADMIN_POLIDEPORTIVO,
        polideportivo_id: polideportivo_id,
        fecha_actualizacion: new Date().toISOString()
      };
      
      nuevoRol = ROLES.ADMIN_POLIDEPORTIVO;
      message = `Asignado como administrador del polideportivo ${poliExistente.nombre}`;
      
    } else if (accion === 'quitar') {
      updateData = {
        rol: ROLES.USUARIO,
        polideportivo_id: null,
        fecha_actualizacion: new Date().toISOString()
      };
      
      nuevoRol = ROLES.USUARIO;
      message = 'Quitado como administrador de polideportivo';
      
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Acción no válida. Use "asignar" o "quitar"' 
      });
    }

    // 4. Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, polideportivo_id,
        polideportivos (id, nombre)
      `)
      .single();

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      throw updateError;
    }

    // 5. Registrar acción
    console.log(`✅ ADMIN POLI ${accion.toUpperCase()}: Usuario ${usuarioExistente.nombre} (ID: ${id}) ${accion} admin_poli por super_admin ${adminData.usuario} (ID: ${adminId})`, {
      accion,
      nuevoRol,
      polideportivo_id: accion === 'asignar' ? polideportivo_id : null,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true,
      message: message,
      data: usuarioActualizado
    });

  } catch (error) {
    console.error('Error en PUT /api/usuarios/admin-poli/:id:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al gestionar admin de polideportivo: ' + error.message 
    });
  }
});

// Exportar todo lo necesario para otras rutas
module.exports = {
  router,
  ROLES,
  NIVELES_PERMISO,
  verificarRol,
  filtrarPorPolideportivo,
  middlewarePolideportivo
};