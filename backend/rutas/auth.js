const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Clave secreta para JWT (usa una variable de entorno en producción)
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mi_clave_refresh_segura_2024';

// Almacenamiento de tokens de refresco (en producción usa Redis)
const refreshTokens = new Map();

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // También verificar cookie HTTP-only
  const cookieToken = req.cookies?.auth_token;
  
  const authToken = token || cookieToken;

  if (!authToken) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token de autenticación requerido' 
    });
  }

  jwt.verify(authToken, JWT_SECRET, (err, user) => {
    if (err) {
      // Token expirado o inválido
      return res.status(403).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }
    
    req.user = user;
    next();
  });
};

// Login con sesión segura
router.post('/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    console.log('🔐 Login seguro para:', usuario);
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña requeridos'
      });
    }

    // Buscar usuario en la base de datos
    const { data: user, error } = await req.supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .single();

    if (error || !user) {
      console.log('❌ Usuario no encontrado:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const passwordValid = await bcrypt.compare(password, user.pass);

    if (!passwordValid) {
      console.log('❌ Contraseña incorrecta para:', usuario);
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      });
    }

    // Preparar datos del usuario (sin contraseña)
    const userData = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      email: user.correo,
      dni: user.dni,
      rol: user.rol || 'user',
      telefono: user.telefono
    };

    // Generar token de acceso (expira en 24 horas)
    const accessToken = jwt.sign(
      { 
        ...userData,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Generar token de refresco (expira en 7 días)
    const refreshToken = jwt.sign(
      { 
        id: user.id,
        type: 'refresh'
      },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Guardar refresh token (en producción usar Redis)
    refreshTokens.set(user.id, refreshToken);

    // Configurar cookie HTTP-only segura
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    console.log('✅ Login exitoso para:', usuario);

    res.json({
      success: true,
      message: 'Login exitoso',
      token: accessToken,
      user: userData,
      expiresIn: 24 * 60 * 60 // 24 horas en segundos
    });

  } catch (error) {
    console.error('❌ Error en login seguro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Verificar autenticación
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Autenticación válida',
    user: req.user
  });
});

// Refrescar token
router.post('/refresh', (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de refresco requerido' 
      });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          error: 'Token de refresco inválido' 
        });
      }

      // Verificar que el refresh token está en la lista
      const storedToken = refreshTokens.get(decoded.id);
      
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(403).json({ 
          success: false, 
          error: 'Token de refresco no válido' 
        });
      }

      // Buscar usuario para obtener datos actualizados
      const { data: user, error } = await req.supabase
        .from('usuarios')
        .select('id, usuario, nombre, correo, dni, rol, telefono')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuario no encontrado' 
        });
      }

      // Generar nuevo access token
      const newAccessToken = jwt.sign(
        { 
          ...user,
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Actualizar cookie
      res.cookie('auth_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        token: newAccessToken,
        user: user,
        expiresIn: 24 * 60 * 60
      });
    });
  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Logout
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // Remover refresh token
    refreshTokens.delete(req.user.id);
    
    // Limpiar cookies
    res.clearCookie('auth_token');
    res.clearCookie('refresh_token');
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;