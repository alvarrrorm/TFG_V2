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

const screenHeight = Dimensions.get('window').height;

// Configuración responsive
const getResponsiveStyle = () => {
  const { width } = Dimensions.get('window');
  if (width < 375) return 'small';
  if (width > 768) return 'large';
  return 'medium';
};

const responsiveType = getResponsiveStyle();

export default function RecuperarPassword({ navigation }) {
  const [formData, setFormData] = useState({
    email: '',
    codigo: '',
    nuevaPassword: '',
    confirmarPassword: ''
  });
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);
  const [pasoActual, setPasoActual] = useState(1);

  const codigoRef = useRef();
  const nuevaPasswordRef = useRef();
  const confirmarPasswordRef = useRef();

  const focusNextField = (nextRef) => {
    if (nextRef && nextRef.current) {
      nextRef.current.focus();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validarEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  // Paso 1: Solicitar código de recuperación
  const handleSolicitarCodigo = async () => {
    Keyboard.dismiss();
    setCargando(true);
    setMensajeError('');
    setMensajeExito('');

    const { email } = formData;

    if (!email.trim()) {
      setMensajeError('Por favor, ingresa tu correo electrónico');
      setCargando(false);
      return;
    }

    if (!validarEmail(email)) {
      setMensajeError('Por favor, ingresa un correo electrónico válido');
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('https://tfgv2-production.up.railway.app/recupera/solicitar-recuperacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeExito(data.message);
        setPasoActual(2);
      } else {
        setMensajeError(data.error || 'Error al solicitar el código de recuperación');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setMensajeError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  // Paso 2: Verificar código
  const handleVerificarCodigo = async () => {
    Keyboard.dismiss();
    setCargando(true);
    setMensajeError('');
    setMensajeExito('');

    const { email, codigo } = formData;

    if (!codigo.trim()) {
      setMensajeError('Por favor, ingresa el código de verificación');
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('https://tfgv2-production.up.railway.app/recupera/verificar-codigo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, codigo }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeExito('Código verificado correctamente');
        setPasoActual(3);
      } else {
        setMensajeError(data.error || 'Código incorrecto o expirado');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setMensajeError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  // Paso 3: Cambiar contraseña
  const handleCambiarPassword = async () => {
    Keyboard.dismiss();
    setCargando(true);
    setMensajeError('');
    setMensajeExito('');

    const { email, codigo, nuevaPassword, confirmarPassword } = formData;

    if (!nuevaPassword.trim() || !confirmarPassword.trim()) {
      setMensajeError('Por favor, completa todos los campos');
      setCargando(false);
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setMensajeError('Las contraseñas no coinciden');
      setCargando(false);
      return;
    }

    if (nuevaPassword.length < 6) {
      setMensajeError('La contraseña debe tener al menos 6 caracteres');
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('https://tfgv2-production.up.railway.app/recupera/cambiar-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          codigo, 
          nuevaPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeExito('Contraseña cambiada exitosamente');
        Alert.alert(
          'Contraseña Actualizada',
          'Tu contraseña ha sido cambiada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.',
          [
            {
              text: 'Iniciar Sesión',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        setMensajeError(data.error || 'Error al cambiar la contraseña');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setMensajeError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  // Reenviar código
  const handleReenviarCodigo = async () => {
    setCargando(true);
    setMensajeError('');
    
    try {
      const response = await fetch('https://tfgv2-production.up.railway.app/recupera/reenviar-codigo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeExito(data.message);
      } else {
        setMensajeError(data.error || 'Error al reenviar el código');
      }
    } catch (error) {
      setMensajeError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  // Volver al paso anterior
  const handleVolver = () => {
    if (pasoActual === 1) {
      navigation.goBack();
    } else {
      setPasoActual(pasoActual - 1);
      setMensajeError('');
      setMensajeExito('');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleMostrarPassword = () => {
    setMostrarPassword(!mostrarPassword);
  };

  const toggleMostrarConfirmarPassword = () => {
    setMostrarConfirmarPassword(!mostrarConfirmarPassword);
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
    success: '#10B981',
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
    success: '#059669',
    card: '#FFFFFF',
    inputBackground: '#F9FAFB',
  };

  // Textos según el paso
  const getTitulo = () => {
    switch (pasoActual) {
      case 1: return 'Recuperar Contraseña';
      case 2: return 'Verificar Código';
      case 3: return 'Nueva Contraseña';
      default: return 'Recuperar Contraseña';
    }
  };

  const getSubtitulo = () => {
    switch (pasoActual) {
      case 1: return 'Ingresa tu correo para recibir un código de verificación';
      case 2: return 'Ingresa el código que enviamos a tu correo';
      case 3: return 'Crea una nueva contraseña para tu cuenta';
      default: return 'Recupera el acceso a tu cuenta';
    }
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
                  onPress={handleVolver}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={[
                    styles.title, 
                    { color: colors.text },
                    styles[`title${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                  ]}>
                    {getTitulo()}
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

              {/* Indicador de pasos */}
              <View style={styles.pasosContainer}>
                {[1, 2, 3].map((paso) => (
                  <View key={paso} style={styles.pasoLinea}>
                    <View style={[
                      styles.pasoCirculo,
                      { 
                        backgroundColor: paso <= pasoActual ? colors.primary : colors.border,
                        borderColor: paso <= pasoActual ? colors.primary : colors.border
                      }
                    ]}>
                      <Text style={[
                        styles.pasoTexto,
                        { color: paso <= pasoActual ? '#FFFFFF' : colors.textMuted }
                      ]}>
                        {paso}
                      </Text>
                    </View>
                    {paso < 3 && (
                      <View style={[
                        styles.pasoConector,
                        { backgroundColor: paso < pasoActual ? colors.primary : colors.border }
                      ]} />
                    )}
                  </View>
                ))}
              </View>

              <Text style={[
                styles.subtitle, 
                { color: colors.textSecondary },
                styles[`subtitle${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
              ]}>
                {getSubtitulo()}
              </Text>

              {mensajeError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
                  <Ionicons name="warning-outline" size={20} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {mensajeError}
                  </Text>
                </View>
              ) : null}

              {mensajeExito ? (
                <View style={[styles.exitoContainer, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={[styles.exitoText, { color: colors.success }]}>
                    {mensajeExito}
                  </Text>
                </View>
              ) : null}

              {/* Paso 1: Email */}
              {pasoActual === 1 && (
                <TextInput
                  placeholder="Correo electrónico"
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
                  value={formData.email}
                  onChangeText={(text) => handleInputChange('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="send"
                  onSubmitEditing={handleSolicitarCodigo}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!cargando}
                />
              )}

              {/* Paso 2: Código */}
              {pasoActual === 2 && (
                <>
                  <TextInput
                    ref={codigoRef}
                    placeholder="Código de verificación"
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
                    value={formData.codigo}
                    onChangeText={(text) => handleInputChange('codigo', text)}
                    keyboardType="number-pad"
                    returnKeyType="send"
                    onSubmitEditing={handleVerificarCodigo}
                    autoComplete="off"
                    editable={!cargando}
                  />
                  
                  <TouchableOpacity
                    style={[styles.reenviarButton]}
                    onPress={handleReenviarCodigo}
                    disabled={cargando}
                  >
                    <Text style={[styles.reenviarText, { color: colors.primary }]}>
                      ¿No recibiste el código? Reenviar
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Paso 3: Nueva contraseña */}
              {pasoActual === 3 && (
                <>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      ref={nuevaPasswordRef}
                      placeholder="Nueva contraseña"
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
                      value={formData.nuevaPassword}
                      onChangeText={(text) => handleInputChange('nuevaPassword', text)}
                      returnKeyType="next"
                      onSubmitEditing={() => focusNextField(confirmarPasswordRef)}
                      autoComplete="new-password"
                      textContentType="newPassword"
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

                  <View style={styles.passwordContainer}>
                    <TextInput
                      ref={confirmarPasswordRef}
                      placeholder="Confirmar nueva contraseña"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!mostrarConfirmarPassword}
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
                      value={formData.confirmarPassword}
                      onChangeText={(text) => handleInputChange('confirmarPassword', text)}
                      returnKeyType="send"
                      onSubmitEditing={handleCambiarPassword}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      editable={!cargando}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={toggleMostrarConfirmarPassword}
                      disabled={cargando}
                    >
                      <Ionicons 
                        name={mostrarConfirmarPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color={colors.textMuted} 
                      />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Botón principal */}
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  cargando && styles.buttonDisabled,
                  styles[`button${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}
                onPress={
                  pasoActual === 1 ? handleSolicitarCodigo :
                  pasoActual === 2 ? handleVerificarCodigo :
                  handleCambiarPassword
                }
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
                      {pasoActual === 1 ? 'Enviando código...' :
                       pasoActual === 2 ? 'Verificando...' : 'Cambiando contraseña...'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons 
                      name={
                        pasoActual === 1 ? "mail" :
                        pasoActual === 2 ? "key" : "lock-closed"
                      } 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={[
                      styles.buttonText,
                      styles[`buttonText${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                    ]}>
                      {pasoActual === 1 ? 'Enviar Código' :
                       pasoActual === 2 ? 'Verificar Código' : 'Cambiar Contraseña'}
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
                onPress={() => navigation.navigate('Login')}
                disabled={cargando}
              >
                <Text style={[
                  styles.secondaryButtonText, 
                  { color: colors.text },
                  styles[`secondaryButtonText${responsiveType.charAt(0).toUpperCase() + responsiveType.slice(1)}`]
                ]}>
                  Volver al inicio de sesión
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

// Los estilos se mantienen igual que en tu código original
const styles = StyleSheet.create({
  // ... (todos los estilos igual que en tu código)
  overlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
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
  pasosContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  pasoLinea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasoCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasoTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
  pasoConector: {
    width: 40,
    height: 2,
    marginHorizontal: 5,
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
    marginBottom: 15,
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
  exitoContainer: {
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
  exitoText: {
    fontSize: 15,
    textAlign: 'center',
    flex: 1,
  },
  reenviarButton: {
    alignItems: 'center',
    marginBottom: 15,
  },
  reenviarText: {
    fontSize: 14,
    fontWeight: '600',
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