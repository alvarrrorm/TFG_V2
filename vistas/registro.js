import React, { useState } from 'react';
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

const screenHeight = Dimensions.get('window').height;

export default function Register({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [dni, setDni] = useState('');
  const [pass, setPass] = useState('');
  const [pass_2, setPass2] = useState('');
  const [claveAdmin, setClaveAdmin] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [aceptoPoliticas, setAceptoPoliticas] = useState(false);
  const [telefono, setTelefono] = useState('');

  // Manejar el registro del usuario
  const handleRegister = async () => {
    Keyboard.dismiss();

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nombre || !correo || !usuario || !dni || !pass || !pass_2) {
      setMensajeError('Por favor, completa todos los campos');
      return;
    }

    if (!correoValido.test(correo)) {
      setMensajeError('Correo electrónico no válido');
      return;
    }

    if (pass !== pass_2) {
      setMensajeError('Las contraseñas no coinciden');
      return;
    }

    if (!aceptoPoliticas) {
      setMensajeError('Debes aceptar las políticas de privacidad');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, usuario, dni, pass, pass_2, telefono, clave_admin: claveAdmin })
      });

      const data = await response.json();

      if (response.ok) {
        setMensajeError('');
        Alert.alert('Éxito', 'Usuario registrado con éxito');
        navigation.navigate('Login');
      } else {
        setMensajeError(data.error || 'No se pudo registrar el usuario');
      }
    } catch (error) {
      console.error(error);
      setMensajeError('No se pudo conectar con el servidor');
    }
  };

  // Navegar a las políticas de privacidad
  const navigateToPoliticas = () => {
    Linking.openURL('https://drive.google.com/file/d/1wJ_KyccZQE6VPjGLy8ThGCvXFj2OrhoC/view?usp=sharing');
  };

  return (
    <View style={styles.overlay}>
      <FlatList
        data={[]}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={
          <View style={styles.container}>
            <View style={styles.formContainer}>
              <Text style={styles.title}>Crear cuenta</Text>
              <Text style={styles.subtitle}>Únete a nuestra comunidad deportiva</Text>

              {mensajeError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{mensajeError}</Text>
                </View>
              ) : null}

              <TextInput
                placeholder="Nombre completo"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={nombre}
                onChangeText={(text) => { setNombre(text); setMensajeError(''); }}
                returnKeyType="next"
              />
              <TextInput
                placeholder="Correo electrónico"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={correo}
                onChangeText={(text) => {
                  setCorreo(text);
                  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (text === '' || regex.test(text)) {
                    setMensajeError('');
                  } else {
                    setMensajeError('Correo electrónico no válido');
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <TextInput
                placeholder="Nombre de usuario"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={usuario}
                onChangeText={(text) => { setUsuario(text); setMensajeError(''); }}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TextInput
                placeholder="DNI (Con Letra)"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={dni}
                onChangeText={(text) => { setDni(text); setMensajeError(''); }}
                returnKeyType="next"
              />
              <TextInput
                placeholder="Número de Teléfono"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={telefono}
                onChangeText={(text) => {
                  // Solo guarda números
                  const soloNumeros = text.replace(/[^0-9]/g, '');
                  setTelefono(soloNumeros);
                  setMensajeError('');
                }}
                keyboardType="numeric"
                maxLength={15}
                returnKeyType="next"
              />


              <TextInput
                placeholder="Contraseña"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                style={styles.input}
                value={pass}
                onChangeText={(text) => { setPass(text); setMensajeError(''); }}
                returnKeyType="next"
              />
              <TextInput
                placeholder="Repetir contraseña"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                style={styles.input}
                value={pass_2}
                onChangeText={(text) => { setPass2(text); setMensajeError(''); }}
                returnKeyType="next"
              />
              <TextInput
                placeholder="Clave de administrador (opcional)"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                style={styles.input}
                value={claveAdmin}
                onChangeText={(text) => { setClaveAdmin(text); setMensajeError(''); }}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setAceptoPoliticas(!aceptoPoliticas)}
                >
                  <View style={[styles.checkboxIcon, aceptoPoliticas && styles.checkboxChecked]}>
                    {aceptoPoliticas && <Text style={styles.checkboxCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>
                    Acepto las{' '}
                    <Text style={styles.politicasLink} onPress={navigateToPoliticas}>
                      políticas de privacidad
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleRegister}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Registrarse</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.secondaryButtonText}>¿Ya tienes cuenta? Inicia sesión</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 32 : 26,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: 'rgba(249, 250, 251, 0.8)',
    color: '#1F2937',
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 15,
    textAlign: 'center',
  },
  checkboxContainer: {
    width: '100%',
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 5,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 15,
    color: '#4B5563',
  },
  politicasLink: {
    color: '#4F46E5',
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
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#6B7280',
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4F46E5',
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
