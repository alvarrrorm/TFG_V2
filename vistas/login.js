import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Keyboard,
  Platform,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../contexto/UserContex';

const screenHeight = Dimensions.get('window').height;

// Configuración responsive
const getResponsiveStyle = () => {
  const { width } = Dimensions.get('window');
  if (width < 375) return 'small';
  if (width > 768) return 'large';
  return 'medium';
};

const responsiveType = getResponsiveStyle();

export default function Login({ navigation }) {
  const [formData, setFormData] = useState({
    usuario: '',
    pass: ''
  });
  const [mensajeError, setMensajeError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const { login } = useUser();

  // Referencias para navegación entre inputs
  const passRef = useRef();

  // Función para navegar al siguiente campo
  const focusNextField = (nextRef) => {
    if (nextRef && nextRef.current) {
      nextRef.current.focus();
    }
  };

  // Handler único para todos los campos
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Manejar el login del usuario
  const handleLogin = async () => {
    Keyboard.dismiss();
    setCargando(true);
    setMensajeError('');

    const { usuario, pass } = formData;

    // Validaciones
    if (!usuario.trim() || !pass.trim()) {
      setMensajeError('Por favor, completa todos los campos');
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          usuario: usuario,
          pass: pass
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      // Limpiar formulario
      setFormData({
        usuario: '',
        pass: ''
      });
      setMensajeError('');

      // Llamar a la función de login del contexto
      login(data.userData.nombre, data.userData.dni || '', data.userData.rol);

      Alert.alert('Bienvenido', `Inicio de sesión exitoso como ${data.userData.rol}`);
      navigation.navigate('Reservas');

    } catch (err) {
      console.error('Error en login:', err);
      setMensajeError(err.message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleMostrarPassword = () => {
    setMostrarPassword(!mostrarPassword);
  };

  // Colores para modo oscuro
  const colors = darkMode ? {
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#6366F1',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    border: '#334155',
    danger: '#EF4444',
    card: '#1E293B',
    inputBackground: '#334155',
  } : {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    primary: '#4F46E5',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    danger: '#EF4444',
    card: '#FFFFFF',
    inputBackground: '#F9FAFB',
  };

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <FlatList
        data={[]}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={
          <View style={styles.container}>
            <View style={[
              styles.formContainer, 
              { backgroundColor: colors.card },
              styles[`formContainer${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
            ]}>
              
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={[
                    styles.title, 
                    { color: colors.text },
                    styles[`title${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                  ]}>
                    Iniciar Sesión
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.darkModeToggle}
                  onPress={toggleDarkMode}
                >
                  <Ionicons 
                    name={darkMode ? "sunny" : "moon"} 
                    size={22} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>

              <Text style={[
                styles.subtitle, 
                { color: colors.textSecondary },
                styles[`subtitle${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
              ]}>
                Accede a tu cuenta Depo
              </Text>

              {mensajeError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
                  <Ionicons name="warning-outline" size={20} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {mensajeError}
                  </Text>
                </View>
              ) : null}

              <TextInput
                placeholder="Usuario"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  },
                  styles[`input${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}
                value={formData.usuario}
                onChangeText={(text) => handleInputChange('usuario', text)}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(passRef)}
                autoComplete="username"
                textContentType="username"
                editable={!cargando}
              />
              
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passRef}
                  placeholder="Contraseña"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!mostrarPassword}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { 
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                      color: colors.text
                    },
                    styles[`input${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                  ]}
                  value={formData.pass}
                  onChangeText={(text) => handleInputChange('pass', text)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  autoComplete="password"
                  textContentType="password"
                  editable={!cargando}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={toggleMostrarPassword}
                  disabled={cargando}
                >
                  <Ionicons 
                    name={mostrarPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={colors.textMuted} 
                  />
                </TouchableOpacity>
              </View>

              {/* Enlace para recuperar contraseña */}
              <TouchableOpacity
                style={styles.recuperarContainer}
                onPress={() => navigation.navigate('RecuperarPassword')}
                disabled={cargando}
              >
                <Text style={[styles.recuperarText, { color: colors.primary }]}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  cargando && styles.buttonDisabled,
                  styles[`button${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}
                onPress={handleLogin}
                activeOpacity={0.8}
                disabled={cargando}
              >
                {cargando ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[
                      styles.buttonText,
                      styles[`buttonText${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                    ]}>
                      Iniciando sesión...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="log-in" size={20} color="#FFFFFF" />
                    <Text style={[
                      styles.buttonText,
                      styles[`buttonText${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                    ]}>
                      Entrar
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={[
                styles.divider,
                styles[`divider${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
              ]}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textMuted }]}>o</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.secondaryButton, 
                  { borderColor: colors.primary },
                  styles[`secondaryButton${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}
                onPress={() => navigation.navigate('Registro')}
                disabled={cargando}
              >
                <Text style={[
                  styles.secondaryButtonText, 
                  { color: colors.text },
                  styles[`secondaryButtonText${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}>
                  ¿No tienes cuenta?{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Regístrate</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        contentContainerStyle={styles.contentContainerStyle}
        style={Platform.OS === 'web' ? { height: screenHeight } : {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  
  // Estilos base
  formContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  darkModeToggle: {
    padding: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 10, // Reducido para dar espacio al enlace de recuperación
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 15,
    padding: 5,
  },
  // Nuevos estilos para recuperar contraseña
  recuperarContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 5,
  },
  recuperarText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    flex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    borderWidth: 2,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  contentContainerStyle: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },

  // Estilos para pantallas pequeñas (< 375px)
  formContainerSmall: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 16,
  },
  titleSmall: {
    fontSize: 22,
    marginBottom: 3,
  },
  subtitleSmall: {
    fontSize: 14,
    marginBottom: 20,
  },
  inputSmall: {
    height: 45,
    fontSize: 15,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  recuperarTextSmall: {
    fontSize: 13,
  },
  buttonSmall: {
    paddingVertical: 14,
  },
  buttonTextSmall: {
    fontSize: 16,
  },
  dividerSmall: {
    marginVertical: 16,
  },
  secondaryButtonSmall: {
    paddingVertical: 12,
  },
  secondaryButtonTextSmall: {
    fontSize: 14,
  },

  // Estilos para pantallas grandes (> 768px)
  formContainerLarge: {
    maxWidth: 450,
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  titleLarge: {
    fontSize: 32,
    marginBottom: 8,
  },
  subtitleLarge: {
    fontSize: 18,
    marginBottom: 30,
  },
  inputLarge: {
    height: 55,
    fontSize: 17,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  recuperarTextLarge: {
    fontSize: 15,
  },
  buttonLarge: {
    paddingVertical: 18,
  },
  buttonTextLarge: {
    fontSize: 18,
  },
  dividerLarge: {
    marginVertical: 24,
  },
  secondaryButtonLarge: {
    paddingVertical: 16,
  },
  secondaryButtonTextLarge: {
    fontSize: 17,
  },
});