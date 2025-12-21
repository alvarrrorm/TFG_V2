const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const emailjs = require('@emailjs/nodejs');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = process.env.SUPABASE_URL || 'https://oiejhhkggnmqrubypvrt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_jwt_2024_segura';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mi_clave_refresh_segura_2024';

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    'https://www.deppo.es',
    'https://deppo.es',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Authorization']
}));
app.options('*', cors());
app.use(express.json());

// ========== IMPORTAR ROUTERS ==========
const loginRouter = require('./rutas/login'); // <-- IMPORTANTE
const reservasRouter = require('./rutas/reservas');
const pistasRouter = require('./rutas/pistas');
const polideportivosRouter = require('./rutas/polideportivos');
const { router: usuariosRouter } = require('./rutas/usuarios');

// ========== REGISTRAR ROUTERS ==========
// ✅ LOGIN ÚNICO - Solo desde rutas/login.js
app.use('/api/login', loginRouter);

// Otras rutas
app.use('/api/reservas', reservasRouter);
app.use('/api/pistas', pistasRouter);
app.use('/api/polideportivos', polideportivosRouter);
app.use('/api/usuarios', usuariosRouter);

// ========== RUTAS BÁSICAS ==========

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      login: '/api/login',
      usuarios: '/api/usuarios/*',
      reservas: '/api/reservas/*',
      polideportivos: '/api/polideportivos',
      pistas: '/api/pistas'
    }
  });
});

// TEST SUPABASE
app.get('/api/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('count')
      .limit(1);

    if (error) throw error;

    res.json({
      success: true,
      message: '✅ Supabase conectado correctamente'
    });
  } catch (error) {
    console.error('Error Supabase:', error);
    res.status(500).json({
      success: false,
      error: 'Error conectando a Supabase: ' + error.message
    });
  }
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend ejecutándose en puerto ${PORT}`);
  console.log(`🔐 Login: POST /api/login`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit();
});