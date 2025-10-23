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
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Lista de prefijos telefónicos internacionales
const prefijosTelefonicos = [
  { codigo: '+34', pais: 'España', bandera: '🇪🇸' },
  { codigo: '+1', pais: 'EE.UU./Canadá', bandera: '🇺🇸' },
  { codigo: '+44', pais: 'Reino Unido', bandera: '🇬🇧' },
  { codigo: '+33', pais: 'Francia', bandera: '🇫🇷' },
  { codigo: '+49', pais: 'Alemania', bandera: '🇩🇪' },
  { codigo: '+39', pais: 'Italia', bandera: '🇮🇹' },
  { codigo: '+351', pais: 'Portugal', bandera: '🇵🇹' },
  { codigo: '+52', pais: 'México', bandera: '🇲🇽' },
  { codigo: '+54', pais: 'Argentina', bandera: '🇦🇷' },
  { codigo: '+56', pais: 'Chile', bandera: '🇨🇱' },
  { codigo: '+57', pais: 'Colombia', bandera: '🇨🇴' },
  { codigo: '+51', pais: 'Perú', bandera: '🇵🇪' },
  { codigo: '+55', pais: 'Brasil', bandera: '🇧🇷' },
];

// Expresiones regulares para validación
const validaciones = {
  nombre: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s']{2,50}$/,
  correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  usuario: /^[a-zA-Z0-9_]{3,20}$/,
  dni: /^[0-9]{8}[A-Za-z]$/,
  telefono: /^[+]?[0-9\s\-()]{7,15}$/,
  pass: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};

export default function Register({ navigation }) {
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    usuario: '',
    dni: '',
    telefono: '',
    prefijo: '+34',
    claveAdmin: '',
    pass: '',
    pass_2: ''
  });
  const [mensajeError, setMensajeError] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});
  const [aceptoPoliticas, setAceptoPoliticas] = useState(false);
  const [mostrarModalPrefijos, setMostrarModalPrefijos] = useState(false);

  const telefonoInputRef = useRef();

  // Manejar cambios en los campos con validación
  const handleChange = (field, value) => {
    let valorProcesado = value;
    
    switch(field) {
      case 'dni':
        valorProcesado = value.toUpperCase().slice(0, 9);
        break;
      case 'telefono':
        valorProcesado = value.replace(/[^0-9]/g, '');
        break;
      case 'nombre':
        valorProcesado = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s']/g, '');
        break;
      case 'usuario':
        valorProcesado = value.replace(/[^a-zA-Z0-9_]/g, '');
        break;
    }

    setFormData(prev => ({
      ...prev,
      [field]: valorProcesado
    }));

    validarCampo(field, valorProcesado);
    setMensajeError('');
  };

  // Validar campo individual
  const validarCampo = (field, value) => {
    let esValido = true;
    let mensajeError = '';

    switch(field) {
      case 'nombre':
        if (value && !validaciones.nombre.test(value)) {
          esValido = false;
          mensajeError = 'El nombre debe contener solo letras y espacios (2-50 caracteres)';
        }
        break;
      
      case 'correo':
        if (value && !validaciones.correo.test(value)) {
          esValido = false;
          mensajeError = 'Formato de correo electrónico no válido';
        }
        break;
      
      case 'usuario':
        if (value && !validaciones.usuario.test(value)) {
          esValido = false;
          mensajeError = 'El usuario debe tener 3-20 caracteres (solo letras, números y _)';
        }
        break;
      
      case 'dni':
        if (value && !validaciones.dni.test(value)) {
          esValido = false;
          mensajeError = 'DNI debe tener 8 números y 1 letra';
        } else if (value.length === 9) {
          const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
          const numero = value.slice(0, 8);
          const letra = value.slice(8).toUpperCase();
          const letraCalculada = letras[numero % 23];
          
          if (letra !== letraCalculada) {
            esValido = false;
            mensajeError = 'La letra del DNI no es válida';
          }
        }
        break;
      
      case 'telefono':
        const telefonoCompleto = formData.prefijo + value;
        if (value && !validaciones.telefono.test(telefonoCompleto)) {
          esValido = false;
          mensajeError = 'Número de teléfono no válido';
        }
        break;
      
      case 'pass':
        if (value && !validaciones.pass.test(value)) {
          esValido = false;
          mensajeError = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial';
        }
        break;
    }

    setErroresCampos(prev => ({
      ...prev,
      [field]: esValido ? '' : mensajeError
    }));

    return esValido;
  };

  // Validar todos los campos antes del registro
  const validarFormulario = () => {
    const nuevosErrores = {};
    let formularioValido = true;

    if (!formData.nombre) {
      nuevosErrores.nombre = 'El nombre es obligatorio';
      formularioValido = false;
    }
    if (!formData.correo) {
      nuevosErrores.correo = 'El correo es obligatorio';
      formularioValido = false;
    }
    if (!formData.usuario) {
      nuevosErrores.usuario = 'El usuario es obligatorio';
      formularioValido = false;
    }
    if (!formData.dni) {
      nuevosErrores.dni = 'El DNI es obligatorio';
      formularioValido = false;
    }
    if (!formData.pass) {
      nuevosErrores.pass = 'La contraseña es obligatoria';
      formularioValido = false;
    }
    if (!formData.pass_2) {
      nuevosErrores.pass_2 = 'Debes repetir la contraseña';
      formularioValido = false;
    }

    Object.keys(formData).forEach(field => {
      if (formData[field] && !validarCampo(field, formData[field])) {
        formularioValido = false;
      }
    });

    setErroresCampos(nuevosErrores);
    return formularioValido;
  };

  // Manejar el registro del usuario
  const handleRegister = async () => {
    Keyboard.dismiss();

    if (!validarFormulario()) {
      setMensajeError('Por favor, corrige los errores en el formulario');
      return;
    }

    const { nombre, correo, usuario, dni, pass, pass_2, telefono, prefijo, claveAdmin } = formData;

    if (pass !== pass_2) {
      setMensajeError('Las contraseñas no coinciden');
      return;
    }

    if (!aceptoPoliticas) {
      setMensajeError('Debes aceptar las políticas de privacidad');
      return;
    }

    try {
      const telefonoCompleto = prefijo + telefono;
      const response = await fetch('http://localhost:3001/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre, 
          correo, 
          usuario, 
          dni, 
          pass, 
          pass_2, 
          telefono: telefonoCompleto, 
          clave_admin: claveAdmin 
        })
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

  // Seleccionar prefijo telefónico
  const seleccionarPrefijo = (prefijo) => {
    setFormData(prev => ({ ...prev, prefijo }));
    setMostrarModalPrefijos(false);
    setTimeout(() => {
      telefonoInputRef.current?.focus();
    }, 100);
  };

  // Abrir modal de prefijos
  const abrirModalPrefijos = () => {
    Keyboard.dismiss();
    setMostrarModalPrefijos(true);
  };

  // Campos del formulario
  const formFields = [
    { 
      key: 'nombre', 
      placeholder: 'Nombre completo *', 
      props: { 
        autoCapitalize: 'words',
        returnKeyType: 'next'
      } 
    },
    { 
      key: 'correo', 
      placeholder: 'Correo electrónico *', 
      props: { 
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        returnKeyType: 'next'
      } 
    },
    { 
      key: 'usuario', 
      placeholder: 'Nombre de usuario *', 
      props: { 
        autoCapitalize: 'none',
        returnKeyType: 'next'
      } 
    },
    { 
      key: 'dni', 
      placeholder: 'DNI (8 números + letra) *', 
      props: { 
        autoCapitalize: 'characters',
        returnKeyType: 'next',
        maxLength: 9
      } 
    },
    { 
      key: 'claveAdmin', 
      placeholder: 'Clave administrador', 
      props: { 
        secureTextEntry: true,
        returnKeyType: 'next'
      } 
    },
    { 
      key: 'pass', 
      placeholder: 'Contraseña *', 
      props: { 
        secureTextEntry: true,
        returnKeyType: 'next'
      } 
    },
    { 
      key: 'pass_2', 
      placeholder: 'Repetir contraseña *', 
      props: { 
        secureTextEntry: true,
        returnKeyType: 'done',
        onSubmitEditing: handleRegister
      } 
    },
  ];

  // Render item para la lista de prefijos
  const renderPrefijoItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.prefijoItem,
        formData.prefijo === item.codigo && styles.prefijoItemSelected
      ]}
      onPress={() => seleccionarPrefijo(item.codigo)}
    >
      <Text style={styles.prefijoBandera}>{item.bandera}</Text>
      <Text style={styles.prefijoCodigo}>{item.codigo}</Text>
      <Text style={styles.prefijoPais}>{item.pais}</Text>
    </TouchableOpacity>
  );

  // Componente con TODO el contenido del formulario
  const FormContent = () => (
    <View style={styles.content}>
      <View style={styles.card}>
        {/* Header con icono */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🎾</Text>
          </View>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>Únete a nuestra comunidad deportiva</Text>
        </View>

        {mensajeError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{mensajeError}</Text>
          </View>
        ) : null}

        {/* Campos del formulario */}
        {formFields.slice(0, 4).map((field) => (
          <View key={field.key}>
            <TextInput
              placeholder={field.placeholder}
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                erroresCampos[field.key] && styles.inputError
              ]}
              value={formData[field.key]}
              onChangeText={(text) => handleChange(field.key, text)}
              {...field.props}
            />
            {erroresCampos[field.key] ? (
              <Text style={styles.errorCampo}>{erroresCampos[field.key]}</Text>
            ) : null}
          </View>
        ))}

        {/* Campo de teléfono integrado con selector de prefijo */}
        <View style={styles.telefonoContainer}>
          <Text style={styles.telefonoLabel}>Teléfono</Text>
          <View style={[
            styles.telefonoInputWrapper,
            erroresCampos.telefono && styles.telefonoInputWrapperError
          ]}>
            {/* Selector de prefijo */}
            <TouchableOpacity 
              style={styles.prefijoSelector}
              onPress={abrirModalPrefijos}
            >
              <Text style={styles.prefijoText}>{formData.prefijo}</Text>
              <Text style={styles.prefijoArrow}>▼</Text>
            </TouchableOpacity>

            {/* Input del número de teléfono */}
            <TextInput
              ref={telefonoInputRef}
              placeholder="Número de teléfono"
              placeholderTextColor="#9CA3AF"
              style={styles.telefonoInput}
              value={formData.telefono}
              onChangeText={(text) => handleChange('telefono', text)}
              keyboardType="phone-pad"
              maxLength={15}
              returnKeyType="next"
            />
          </View>
          {erroresCampos.telefono ? (
            <Text style={styles.errorCampo}>{erroresCampos.telefono}</Text>
          ) : null}
        </View>

        {/* Resto de campos después del teléfono */}
        {formFields.slice(4).map((field) => (
          <View key={field.key}>
            <TextInput
              placeholder={field.placeholder}
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                erroresCampos[field.key] && styles.inputError
              ]}
              value={formData[field.key]}
              onChangeText={(text) => handleChange(field.key, text)}
              {...field.props}
            />
            {erroresCampos[field.key] ? (
              <Text style={styles.errorCampo}>{erroresCampos[field.key]}</Text>
            ) : null}
          </View>
        ))}

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
          style={styles.registerButton}
          onPress={handleRegister}
          activeOpacity={0.9}
        >
          <Text style={styles.buttonText}>Crear Cuenta</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes una cuenta?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Item vacío para el FlatList
  const renderEmptyItem = () => null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        data={[{}]} // Array con un elemento vacío
        keyExtractor={(item, index) => index.toString()}
        
        // Todo el contenido del formulario como header
        ListHeaderComponent={<FormContent />}
        
        renderItem={renderEmptyItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'} // ← SCROLL EN WEB
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />

      {/* Modal para seleccionar prefijo */}
      <Modal
        visible={mostrarModalPrefijos}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMostrarModalPrefijos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu país</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalPrefijos(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={prefijosTelefonicos}
              keyExtractor={(item) => item.codigo}
              renderItem={renderPrefijoItem}
              style={styles.prefijosList}
              showsVerticalScrollIndicator={true}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: isWeb ? 40 : 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    marginVertical: 10,
    maxWidth: isWeb ? 500 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  icon: {
    fontSize: 30,
  },
  title: {
    fontSize: isWeb ? 32 : 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: isWeb ? 16 : 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorCampo: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  // Estilos para el campo de teléfono
  telefonoContainer: {
    marginBottom: 12,
  },
  telefonoLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  telefonoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  telefonoInputWrapperError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  prefijoSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minWidth: 80,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  prefijoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  prefijoArrow: {
    fontSize: 10,
    color: '#6B7280',
  },
  telefonoInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  // Estilos del modal de prefijos
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  prefijosList: {
    maxHeight: 400,
  },
  prefijoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prefijoItemSelected: {
    backgroundColor: '#F3F4F6',
  },
  prefijoBandera: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
  },
  prefijoCodigo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    width: 60,
  },
  prefijoPais: {
    fontSize: 16,
    color: '#6B7280',
    flex: 1,
  },
  registerButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      ':hover': {
        backgroundColor: '#4338CA',
      },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: isWeb ? 18 : 16,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  checkboxContainer: {
    width: '100%',
    marginBottom: 25,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    ...(isWeb && {
      cursor: 'pointer',
    }),
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
    fontSize: isWeb ? 15 : 14,
    color: '#4B5563',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
    ...(isWeb && {
      cursor: 'pointer',
    }),
  },
  politicasLink: {
    color: '#4F46E5',
    fontWeight: '600',
    textDecorationLine: 'underline',
    ...(isWeb && {
      cursor: 'pointer',
    }),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    textDecorationLine: 'underline',
    ...(isWeb && {
      cursor: 'pointer',
    }),
  },
});