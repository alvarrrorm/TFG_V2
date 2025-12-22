const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Sistema de roles jerárquicos
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_POLIDEPORTIVO: 'admin_poli',
  ADMIN: 'admin',
  USUARIO: 'usuario'
};

const NIVELES_PERMISO = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN_POLIDEPORTIVO]: 50,
  [ROLES.ADMIN]: 40,
  [ROLES.USUARIO]: 10
};

// ========== RUTAS DE USUARIOS ==========

// Obtener todos los usuarios (solo super_admin)
router.get('/', async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    
    console.log('📋 [USUARIOS] Obteniendo todos los usuarios...');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id, 
        dni, 
        nombre, 
        correo, 
        usuario, 
        rol, 
        telefono, 
        fecha_creacion, 
        fecha_actualizacion,
        polideportivo_id,
        polideportivos (id, nombre, direccion)
      `)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('❌ [USUARIOS] Error obteniendo usuarios:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener usuarios: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Obtenidos ${usuarios?.length || 0} usuarios`);
    
    res.json({ 
      success: true, 
      data: usuarios || [] 
    });
  } catch (error) {
    console.error('❌ [USUARIOS] Error en GET /api/usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Cambiar rol de usuario (solo super_admin)
router.put('/cambiar-rol/:id', async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { id } = req.params;
    const { nuevoRol, passwordConfirmacion, polideportivo_id } = req.body;
    
    console.log(`👑 [USUARIOS] Cambiando rol del usuario ${id} a ${nuevoRol}...`);

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
    }

    // 1. Obtener el token del header para identificar al super_admin
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No autorizado' 
      });
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }

    const adminId = decoded.id;

    // 2. Verificar que el administrador es super_admin
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('id, rol, pass')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }

    if (adminData.rol !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ 
        success: false, 
        error: 'Solo los super administradores pueden cambiar roles' 
      });
    }

    // 3. Verificar contraseña del super admin
    const passwordValida = await bcrypt.compare(passwordConfirmacion, adminData.pass);
    if (!passwordValida) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña incorrecta. No tienes permisos para realizar esta acción.' 
      });
    }

    // 4. Verificar que el usuario existe
    const { data: usuarioExistente, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, rol, usuario, nombre')
      .eq('id', id)
      .single();

    if (usuarioError || !usuarioExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // 5. No permitir modificar a otro super admin
    if (usuarioExistente.rol === ROLES.SUPER_ADMIN && id !== adminId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'No puedes modificar a otro super administrador' 
      });
    }

    // 6. No permitir que un super admin se quite a sí mismo los privilegios
    if (parseInt(id) === adminId && nuevoRol !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ 
        success: false, 
        error: 'No puedes quitarte a ti mismo los privilegios de super administrador' 
      });
    }

    // 7. Preparar datos para actualizar
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

    // 8. Actualizar usuario
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, dni, nombre, correo, usuario, rol, telefono,
        fecha_creacion, fecha_actualizacion, polideportivo_id,
        polideportivos (id, nombre, direccion)
      `)
      .single();

    if (updateError) {
      console.error('❌ [USUARIOS] Error actualizando usuario:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar usuario: ' + updateError.message 
      });
    }

    // 9. Registrar acción
    console.log(`✅ [USUARIOS] Usuario ${usuarioExistente.usuario} (${usuarioExistente.nombre}) cambiado a rol ${nuevoRol} por super_admin ${adminId}`);

    res.json({ 
      success: true,
      message: `Rol actualizado a ${nuevoRol}${nuevoRol === ROLES.ADMIN_POLIDEPORTIVO ? ` para polideportivo ${polideportivo_id}` : ''}`,
      data: usuarioActualizado
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en PUT /api/usuarios/cambiar-rol:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Ruta para crear nuevo usuario (solo super_admin)
router.post('/', async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { dni, nombre, correo, usuario, telefono, pass, rol, polideportivo_id } = req.body;

    console.log(`👤 [USUARIOS] Creando nuevo usuario: ${usuario}`);

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

    if (error) {
      console.error('❌ [USUARIOS] Error creando usuario:', error);
      
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

      return res.status(500).json({ 
        success: false, 
        error: 'Error al crear usuario: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Usuario creado exitosamente: ${nuevoUsuario.usuario}`);

    res.status(201).json({ 
      success: true, 
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en POST /api/usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Ruta para eliminar usuario (solo super_admin)
router.delete('/:id', async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { id } = req.params;
    
    console.log(`🗑️ [USUARIOS] Eliminando usuario ID: ${id}`);

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [USUARIOS] Error eliminando usuario:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar usuario: ' + error.message 
      });
    }

    console.log(`✅ [USUARIOS] Usuario ${id} eliminado exitosamente`);

    res.json({ 
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [USUARIOS] Error en DELETE /api/usuarios/:id:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Health check de usuarios
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API de usuarios funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      obtenerUsuarios: 'GET /api/usuarios',
      cambiarRol: 'PUT /api/usuarios/cambiar-rol/:id',
      crearUsuario: 'POST /api/usuarios',
      eliminarUsuario: 'DELETE /api/usuarios/:id'
    }
  });
});

module.exports = router;