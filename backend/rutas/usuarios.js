const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware para verificar admin
const verificarAdmin = (req, res, next) => {
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

    // Verificar token (usando tu mismo JWT_SECRET)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar que el usuario sea admin
    if (decoded.rol !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Acceso denegado - Solo para administradores' 
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error en verificación de admin:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido o expirado' 
    });
  }
};

// Ruta 1: Obtener todos los usuarios (solo admin)
router.get('/', verificarAdmin, async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, usuario, correo, dni, telefono, rol, fecha_creacion')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }

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

// Ruta 2: Cambiar rol de usuario (con confirmación de contraseña)
router.put('/cambiar-rol/:id', verificarAdmin, async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { id } = req.params;
    const { nuevoRol, passwordConfirmacion } = req.body;
    const adminId = req.user.id;

    // Validaciones
    if (!nuevoRol || !passwordConfirmacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos: nuevoRol y passwordConfirmacion son obligatorios' 
      });
    }

    if (!['admin', 'user'].includes(nuevoRol)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rol no válido. Debe ser "admin" o "user"' 
      });
    }

    // 1. Verificar que el admin existe y obtener su contraseña
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .select('pass')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData) {
      console.error('Error al obtener admin:', adminError);
      return res.status(404).json({ 
        success: false, 
        error: 'Administrador no encontrado' 
      });
    }

    // 2. Verificar contraseña del admin
    const passwordValida = await bcrypt.compare(passwordConfirmacion, adminData.pass);
    if (!passwordValida) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña incorrecta. No tienes permisos para realizar esta acción.' 
      });
    }

    // 3. Verificar que el usuario a modificar existe
    const { data: usuarioExistente, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', id)
      .single();

    if (usuarioError || !usuarioExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    // 4. No permitir que un admin se quite a sí mismo los privilegios
    if (parseInt(id) === adminId && nuevoRol === 'user') {
      return res.status(400).json({ 
        success: false, 
        error: 'No puedes quitarte a ti mismo los privilegios de administrador' 
      });
    }

    // 5. Actualizar el rol
    const { data: usuarioActualizado, error: updateError } = await supabase
      .from('usuarios')
      .update({ 
        rol: nuevoRol,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, nombre, usuario, correo, rol, fecha_creacion')
      .single();

    if (updateError) {
      console.error('Error al actualizar usuario:', updateError);
      throw updateError;
    }

    // 6. Registrar en log (opcional - puedes crear una tabla de logs)
    console.log(`✅ Usuario ${id} cambiado a rol ${nuevoRol} por admin ${adminId}`);

    res.json({ 
      success: true,
      message: `Rol actualizado a ${nuevoRol}`,
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

module.exports = router;