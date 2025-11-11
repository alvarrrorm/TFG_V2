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
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const screenHeight = Dimensions.get('window').height;

export default function Register({ navigation }) {
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    usuario: '',
    dni: '',
    telefono: '',
    pass: '',
    pass_2: '',
    claveAdmin: ''
  });
  const [mensajeError, setMensajeError] = useState('');
  const [aceptoPoliticas, setAceptoPoliticas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Referencias para navegación entre inputs
  const correoRef = useRef();
  const usuarioRef = useRef();
  const dniRef = useRef();
  const telefonoRef = useRef();
  const passRef = useRef();
  const pass2Ref = useRef();
  const claveAdminRef = useRef();

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

  // Handler especial para teléfono
  const handleTelefonoChange = (value) => {
    const soloNumeros = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      telefono: soloNumeros
    }));
  };

  // Manejar el registro del usuario
  const handleRegister = async () => {
    Keyboard.dismiss();
    setCargando(true);
    setMensajeError('');

    const { nombre, correo, usuario, dni, pass, pass_2, telefono, claveAdmin } = formData;
    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validaciones (solo al enviar)
    if (!nombre || !correo || !usuario || !dni || !pass || !pass_2) {
      setMensajeError('Por favor, completa todos los campos');
      setCargando(false);
      return;
    }

    if (!correoValido.test(correo)) {
      setMensajeError('Correo electrónico no válido');
      setCargando(false);
      return;
    }

    if (pass !== pass_2) {
      setMensajeError('Las contraseñas no coinciden');
      setCargando(false);
      return;
    }

    if (!aceptoPoliticas) {
      setMensajeError('Debes aceptar las políticas de privacidad');
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/registro', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          nombre, 
          correo, 
          usuario, 
          dni, 
          pass, 
          pass_2, 
          telefono, 
          clave_admin: claveAdmin 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeError('');
        Alert.alert('Éxito', 'Usuario registrado con éxito');
        
        // Limpiar formulario
        setFormData({
          nombre: '',
          correo: '',
          usuario: '',
          dni: '',
          telefono: '',
          pass: '',
          pass_2: '',
          claveAdmin: ''
        });
        setAceptoPoliticas(false);
        
        // Navegar al login
        navigation.navigate('Login');
      } else {
        setMensajeError(data.error || 'Error al registrar el usuario');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setMensajeError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  // Navegar a las políticas de privacidad
  const navigateToPoliticas = () => {
    Linking.openURL('https://drive.google.com/file/d/1wJ_KyccZQE6VPjGLy8ThGCvXFj2OrhoC/view?usp=sharing');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
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
            <View style={[styles.formContainer, { backgroundColor: colors.card }]}>
              
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={[styles.title, { color: colors.text }]}>Crear cuenta</Text>
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

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Únete a nuestra comunidad deportiva
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
                placeholder="Nombre completo"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.nombre}
                onChangeText={(text) => handleInputChange('nombre', text)}
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(correoRef)}
                autoComplete="name"
                textContentType="name"
                editable={!cargando}
              />
              
              <TextInput
                ref={correoRef}
                placeholder="Correo electrónico"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.correo}
                onChangeText={(text) => handleInputChange('correo', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(usuarioRef)}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!cargando}
              />

              <TextInput
                ref={usuarioRef}
                placeholder="Nombre de usuario"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.usuario}
                onChangeText={(text) => handleInputChange('usuario', text)}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(dniRef)}
                autoComplete="username"
                textContentType="username"
                editable={!cargando}
              />
              
              <TextInput
                ref={dniRef}
                placeholder="DNI (Con Letra)"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.dni}
                onChangeText={(text) => handleInputChange('dni', text)}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(telefonoRef)}
                autoComplete="off"
                editable={!cargando}
              />
              
              <TextInput
                ref={telefonoRef}
                placeholder="Número de Teléfono"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.telefono}
                onChangeText={handleTelefonoChange}
                keyboardType="phone-pad"
                maxLength={15}
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(passRef)}
                autoComplete="tel"
                textContentType="telephoneNumber"
                editable={!cargando}
              />

              <TextInput
                ref={passRef}
                placeholder="Contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.pass}
                onChangeText={(text) => handleInputChange('pass', text)}
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(pass2Ref)}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!cargando}
              />
              
              <TextInput
                ref={pass2Ref}
                placeholder="Repetir contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.pass_2}
                onChangeText={(text) => handleInputChange('pass_2', text)}
                returnKeyType="next"
                onSubmitEditing={() => focusNextField(claveAdminRef)}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!cargando}
              />
              
              <TextInput
                ref={claveAdminRef}
                placeholder="Clave de administrador (opcional)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                value={formData.claveAdmin}
                onChangeText={(text) => handleInputChange('claveAdmin', text)}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                autoComplete="off"
                editable={!cargando}
              />

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => !cargando && setAceptoPoliticas(!aceptoPoliticas)}
                  disabled={cargando}
                >
                  <View style={[
                    styles.checkboxIcon, 
                    { borderColor: colors.border },
                    aceptoPoliticas && [styles.checkboxChecked, { backgroundColor: colors.primary }]
                  ]}>
                    {aceptoPoliticas && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={[styles.checkboxText, { color: colors.text }]}>
                    Acepto las{' '}
                    <Text style={[styles.politicasLink, { color: colors.primary }]} onPress={navigateToPoliticas}>
                      políticas de privacidad
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  cargando && styles.buttonDisabled
                ]}
                onPress={handleRegister}
                activeOpacity={0.8}
                disabled={cargando}
              >
                {cargando ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="reload" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Registrando...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Crear Cuenta</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textMuted }]}>o</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate('Login')}
                disabled={cargando}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  ¿Ya tienes cuenta?{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Inicia sesión</Text>
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
  formContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
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
    fontSize: Platform.OS === 'web' ? 32 : 26,
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
  checkboxContainer: {
    width: '100%',
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 5,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderWidth: 0,
  },
  checkboxText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  politicasLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  },
  contentContainerStyle: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
});