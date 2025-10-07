import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
  SectionList,
  RefreshControl,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useUser } from '../contexto/UserContex';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';

const API_URL = 'http://localhost:3001/pistas';
const RESERVAS_URL = 'http://localhost:3001/reservas';
const POLIDEPORTIVOS_URL = 'http://localhost:3001/polideportivos';

export default function AdminPanel({ navigation }) {
  const { usuario } = useUser();
  const [pistas, setPistas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [polideportivos, setPolideportivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState(null);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevoPolideportivo, setNuevoPolideportivo] = useState(null);
  const [open, setOpen] = useState(false);
  const [openPolideportivo, setOpenPolideportivo] = useState(false);
  const [items, setItems] = useState([
    { label: 'Fútbol', value: 'Fútbol' },
    { label: 'Baloncesto', value: 'Baloncesto' },
    { label: 'Tenis', value: 'Tenis' },
    { label: 'Padel', value: 'Padel' },
    { label: 'Voley', value: 'Voley' },
    { label: 'Futbol Sala', value: 'Futbol Sala' }
  ]);
  const [polideportivosItems, setPolideportivosItems] = useState([]);
  const [errorNombreRepetido, setErrorNombreRepetido] = useState('');
  const [activeTab, setActiveTab] = useState('polideportivos');
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isSmallScreen = width < 400;
  const [modalVisible, setModalVisible] = useState(false);
  const [pistaEditando, setPistaEditando] = useState(null);
  const [precioEditando, setPrecioEditando] = useState('');
  const [modalPolideportivoVisible, setModalPolideportivoVisible] = useState(false);
  const [nuevoPolideportivoNombre, setNuevoPolideportivoNombre] = useState('');
  const [nuevoPolideportivoDireccion, setNuevoPolideportivoDireccion] = useState('');
const [nuevoPolideportivoTelefono, setNuevoPolideportivoTelefono] = useState('');

  // Cargar pistas, reservas y polideportivos desde la API
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Cargar polideportivos primero
      const polideportivosResponse = await fetch(POLIDEPORTIVOS_URL);
      if (!polideportivosResponse.ok) throw new Error(`Error ${polideportivosResponse.status}: ${await polideportivosResponse.text()}`);
      const polideportivosData = await polideportivosResponse.json();
      
      if (!polideportivosData.success || !Array.isArray(polideportivosData.data)) {
        throw new Error('Formato de respuesta inválido para polideportivos');
      }
      
      setPolideportivos(polideportivosData.data);
      
      // Preparar items para dropdown de polideportivos
      const polideportivosDropdownItems = polideportivosData.data.map(polideportivo => ({
        label: polideportivo.nombre,
        value: polideportivo.id
      }));
      setPolideportivosItems(polideportivosDropdownItems);
      
      // Cargar pistas
      const pistasResponse = await fetch(API_URL);
      if (!pistasResponse.ok) throw new Error(`Error ${pistasResponse.status}: ${await pistasResponse.text()}`);
      const pistasData = await pistasResponse.json();
      
      if (!pistasData.success || !Array.isArray(pistasData.data)) {
        throw new Error('Formato de respuesta inválido');
      }
      
      setPistas(pistasData.data); 
      
      // Cargar reservas
      const reservasResponse = await fetch(RESERVAS_URL);
      if (!reservasResponse.ok) throw new Error(`Error ${reservasResponse.status}: ${await reservasResponse.text()}`);
      const reservasData = await reservasResponse.json();
      
      if (!reservasData.success || !Array.isArray(reservasData.data)) {
        throw new Error('Formato de respuesta inválido para reservas');
      }
      
      setReservas(reservasData.data);
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
      setPistas([]); 
      setReservas([]);
      setPolideportivos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Agrupar pistas por tipo para el SectionList
  const pistasPorTipo = pistas.reduce((acc, pista) => {
    const tipo = pista.tipo;
    if (!acc[tipo]) {
      acc[tipo] = [];
    }
    acc[tipo].push(pista);
    return acc;
  }, {});

  const sections = Object.keys(pistasPorTipo).map(tipo => ({
    title: tipo,
    data: pistasPorTipo[tipo]
  }));

  // Agregar nueva pista
  const agregarPista = async () => {
    setErrorNombreRepetido('');
    if (!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio || !nuevoPolideportivo) {
      Alert.alert('Error', 'Nombre, tipo, precio y polideportivo son obligatorios');
      return;
    }

    const precioNumerico = parseFloat(nuevoPrecio);
    if (isNaN(precioNumerico)) {
      Alert.alert('Error', 'El precio debe ser un número válido');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: nuevoNombre.trim(),
          tipo: nuevoTipo,
          precio: precioNumerico,
          polideportivo_id: nuevoPolideportivo,
        }),
      });

      const responseData = await response.json();

      if (response.status === 409) {
        setErrorNombreRepetido(responseData.error || 'Ya existe una pista con ese nombre en este polideportivo.');
        return;
      }

      if (!response.ok) {
        throw new Error(responseData.error || `Error ${response.status}`);
      }

      setPistas((prevPistas) => [...prevPistas, responseData.data]);
      setNuevoNombre('');
      setNuevoTipo(null);
      setNuevoPrecio('');
      setNuevoPolideportivo(null);
      setOpen(false);
      setOpenPolideportivo(false);
      Alert.alert('Éxito', 'Pista agregada correctamente');
    } catch (error) {
      console.error('Error al agregar pista:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar la pista');
    }
  };

// Agregar nuevo polideportivo
const agregarPolideportivo = async () => {
  if (!nuevoPolideportivoNombre.trim() || !nuevoPolideportivoDireccion.trim()) {
    Alert.alert('Error', 'Nombre y dirección son obligatorios');
    return;
  }

  try {
    const response = await fetch(POLIDEPORTIVOS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: nuevoPolideportivoNombre.trim(),
        direccion: nuevoPolideportivoDireccion.trim(),
        telefono: nuevoPolideportivoTelefono.trim() || null,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || `Error ${response.status}`);
    }

    setPolideportivos((prevPolideportivos) => [...prevPolideportivos, responseData.data]);
    
    // Actualizar dropdown de polideportivos
    const nuevoItem = {
      label: responseData.data.nombre,
      value: responseData.data.id
    };
    setPolideportivosItems(prev => [...prev, nuevoItem]);
    
    // Limpiar formulario
    setNuevoPolideportivoNombre('');
    setNuevoPolideportivoDireccion('');
    setNuevoPolideportivoTelefono('');
    setModalPolideportivoVisible(false);
    Alert.alert('Éxito', 'Polideportivo agregado correctamente');
  } catch (error) {
    console.error('Error al agregar polideportivo:', error);
    Alert.alert('Error', error.message || 'No se pudo agregar el polideportivo');
  }
};

  // Eliminar polideportivo
  const eliminarPolideportivo = (id) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar este polideportivo? Se eliminarán todas sus pistas.');
      if (confirmar) {
        handleEliminarPolideportivo(id);
      }
    } else {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar este polideportivo? Se eliminarán todas sus pistas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => handleEliminarPolideportivo(id),
          },
        ]
      );
    }
  };

  const handleEliminarPolideportivo = async (id) => {
    try {
      const response = await fetch(`${POLIDEPORTIVOS_URL}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar el polideportivo');
      }

      setPolideportivos((prevPolideportivos) => prevPolideportivos.filter((polideportivo) => polideportivo.id !== id));
      setPolideportivosItems(prev => prev.filter(item => item.value !== id));
      
      // También eliminar pistas asociadas a este polideportivo
      setPistas((prevPistas) => prevPistas.filter((pista) => pista.polideportivo_id !== id));
      
      Alert.alert('Éxito', 'Polideportivo eliminado correctamente');
    } catch (error) {
      console.error('Error al eliminar polideportivo:', error);
      Alert.alert('Error', error.message || 'No se pudo eliminar el polideportivo');
    }
  };

  // Eliminar pista
  const eliminarPista = (id) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar esta pista?');
      if (confirmar) {
        handleEliminar(id);
      }
    } else {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar esta pista?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => handleEliminar(id),
          },
        ]
      );
    }
  };

  const handleEliminar = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error('Error al eliminar la pista');
      }

      setPistas((prevPistas) => prevPistas.filter((pista) => pista.id !== id));
      Alert.alert('Éxito', 'Pista eliminada correctamente');
    } catch (error) {
      console.error('Error al eliminar pista:', error);
      Alert.alert('Error', 'No se pudo eliminar la pista');
    }
  };

  const cancelarReserva = (id) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar esta reserva?');
      if (confirmar) {
        handleCancelarReserva(id);
      }
    } else {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar esta reserva?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => handleCancelarReserva(id),
          },
        ]
      );
    }
  };

  const handleCancelarReserva = async (id) => {
    try {
      const response = await fetch(`${RESERVAS_URL}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al cancelar la reserva');
      }

      setReservas((prevReservas) => prevReservas.filter((reserva) => reserva.id !== id));
      Alert.alert('Éxito', 'Reserva cancelada correctamente');
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      Alert.alert('Error', 'No se pudo cancelar la reserva');
    }
  };

  const toggleMantenimiento = async (id) => {
    try {
      const pista = pistas.find(p => p.id === id);
      if (!pista) return;

      const response = await fetch(`${API_URL}/${id}/mantenimiento`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enMantenimiento: !pista.enMantenimiento
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }

      const responseData = await response.json();
      
      setPistas(prevPistas => 
        prevPistas.map(p => 
          p.id === id ? { ...p, enMantenimiento: responseData.data.enMantenimiento } : p
        )
      );
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      Alert.alert('Error', error.message || 'No se pudo cambiar el estado');
    }
  };

  const abrirModalEditar = (pista) => {
    setPistaEditando(pista);
    setPrecioEditando(pista.precio.toString());
    setModalVisible(true);
  };

  const guardarPrecio = async () => {
    if (!pistaEditando || !precioEditando) {
      Alert.alert('Error', 'El precio no puede estar vacío');
      return;
    }

    const precioNumerico = parseFloat(precioEditando);
    if (isNaN(precioNumerico)) {
      Alert.alert('Error', 'El precio debe ser un número válido');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${pistaEditando.id}/precio`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          precio: precioNumerico,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el precio');
      }

      const pistaActualizada = await response.json();
      setPistas(pistas.map(p => p.id === pistaEditando.id ? pistaActualizada : p));
      setModalVisible(false);
      Alert.alert('Éxito', 'Precio actualizado correctamente');
    } catch (error) {
      console.error('Error al actualizar precio:', error);
      Alert.alert('Error', 'No se pudo actualizar el precio');
    }
  };

  // Función para obtener el nombre del polideportivo - ACTUALIZADA
  const obtenerNombrePolideportivo = (polideportivoId) => {
    const polideportivo = polideportivos.find(p => p.id === polideportivoId);
    return polideportivo ? polideportivo.nombre : 'Desconocido';
  };

  // Renderizado de items de polideportivos
  const renderPolideportivoItem = ({ item }) => (
    <View style={[
      styles.polideportivoCard, 
      isLargeScreen && styles.polideportivoCardLarge,
      isSmallScreen && styles.polideportivoCardSmall
    ]}>
      <View style={styles.polideportivoHeader}>
        <View style={styles.polideportivoInfo}>
          <Text style={[
            styles.polideportivoNombre, 
            isLargeScreen && styles.polideportivoNombreLarge,
            isSmallScreen && styles.polideportivoNombreSmall
          ]}>
            {item.nombre}
          </Text>
          <Text style={styles.polideportivoDireccion}>{item.direccion}</Text>
          {item.telefono && (
            <Text style={styles.polideportivoTelefono}>Tel: {item.telefono}</Text>
          )}
        </View>
        <View style={styles.pistasCountContainer}>
          <Text style={styles.pistasCount}>
            {pistas.filter(p => p.polideportivo_id === item.id).length} pistas
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.botonAccion, 
          styles.botonEliminar, 
          isLargeScreen && styles.botonAccionLarge,
          isSmallScreen && styles.botonAccionSmall
        ]}
        onPress={() => eliminarPolideportivo(item.id)}
      >
        <Ionicons 
          name="trash-outline" 
          size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
          color="#F44336" 
        />
        <Text style={[
          styles.textoAccion, 
          styles.textoEliminar, 
          isLargeScreen && styles.textoAccionLarge,
          isSmallScreen && styles.textoAccionSmall
        ]}>
          Eliminar
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Renderizado de pistas (actualizado para mostrar polideportivo)
  const renderPistaItem = ({ item }) => (
    <View style={[
      styles.pistaCard, 
      isLargeScreen && styles.pistaCardLarge,
      isSmallScreen && styles.pistaCardSmall
    ]}>
      <View style={styles.pistaHeader}>
        <View style={styles.pistaInfo}>
          <Text style={[
            styles.pistaNombre, 
            isLargeScreen && styles.pistaNombreLarge,
            isSmallScreen && styles.pistaNombreSmall
          ]}>
            {item.nombre}
          </Text>
          <Text style={styles.pistaDetalles}>
            {obtenerNombrePolideportivo(item.polideportivo_id)} • {item.precio} €/hora
          </Text>
        </View>
        <View style={styles.estadoContainer}>
          <View style={[
            styles.estadoIndicator,
            { backgroundColor: item.enMantenimiento ? '#FFA500' : '#4CAF50' }
          ]} />
          <Text style={styles.estadoTexto}>
            {item.enMantenimiento ? 'En mantenimiento' : 'Disponible'}
          </Text>
        </View>
      </View>

      <View style={[
        styles.accionesContainer, 
        isLargeScreen && styles.accionesContainerLarge,
        isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start' }
      ]}>
        <TouchableOpacity
          style={[
            styles.botonAccion, 
            isLargeScreen && styles.botonAccionLarge,
            isSmallScreen && styles.botonAccionSmall
          ]}
          onPress={() => toggleMantenimiento(item.id)}
        >
          <MaterialIcons
            name={item.enMantenimiento ? 'handyman' : 'construction'}
            size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)}
            color={item.enMantenimiento ? '#FFA500' : '#607D8B'}
          />
          <Text style={[
            styles.textoAccion, 
            isLargeScreen && styles.textoAccionLarge,
            isSmallScreen && styles.textoAccionSmall
          ]}>
            {item.enMantenimiento ? 'Reactivar' : 'Mantenimiento'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botonAccion, 
            isLargeScreen && styles.botonAccionLarge,
            isSmallScreen && styles.botonAccionSmall
          ]}
          onPress={() => abrirModalEditar(item)}
        >
          <Ionicons 
            name="pencil-outline" 
            size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
            color="#3498DB" 
          />
          <Text style={[
            styles.textoAccion, 
            isLargeScreen && styles.textoAccionLarge,
            isSmallScreen && styles.textoAccionSmall
          ]}>
            Editar Precio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botonAccion, 
            styles.botonEliminar, 
            isLargeScreen && styles.botonAccionLarge,
            isSmallScreen && styles.botonAccionSmall
          ]}
          onPress={() => eliminarPista(item.id)}
        >
          <Ionicons 
            name="trash-outline" 
            size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
            color="#F44336" 
          />
          <Text style={[
            styles.textoAccion, 
            styles.textoEliminar, 
            isLargeScreen && styles.textoAccionLarge,
            isSmallScreen && styles.textoAccionSmall
          ]}>
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizado de reservas (actualizado para mostrar información completa)
  const renderReservaItem = ({ item }) => (
    <View style={[
      styles.reservaCard, 
      isLargeScreen && styles.reservaCardLarge,
      isSmallScreen && styles.reservaCardSmall
    ]}>
      <View style={styles.reservaHeader}>
        <View style={styles.reservaInfoPrincipal}>
          <Text style={[
            styles.reservaNombrePista, 
            isLargeScreen && styles.reservaNombrePistaLarge,
            isSmallScreen && styles.reservaNombrePistaSmall
          ]}>
            {item.pistaNombre || item.pista}
          </Text>
          <Text style={[
            styles.reservaTipo, 
            isLargeScreen && styles.reservaTipoLarge,
            isSmallScreen && styles.reservaTipoSmall
          ]}>
            {item.pistaTipo || 'Pista'}
          </Text>
        </View>
        <View style={[
          styles.estadoReserva,
          { backgroundColor: 
            item.estado === 'confirmada' ? '#4CAF50' : 
            item.estado === 'cancelada' ? '#F44336' : 
            '#FFA500'
          }
        ]}>
          <Text style={styles.estadoReservaTexto}>
            {item.estado?.charAt(0).toUpperCase() + item.estado?.slice(1) || 'Pendiente'}
          </Text>
        </View>
      </View>
      
      <View style={styles.reservaInfo}>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge,
          isSmallScreen && styles.reservaTextoSmall
        ]}>
          👤 Usuario: {item.nombre_usuario || 'Desconocido'}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge,
          isSmallScreen && styles.reservaTextoSmall
        ]}>
          📅 Fecha: {new Date(item.fecha).toLocaleDateString('es-ES')}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge,
          isSmallScreen && styles.reservaTextoSmall
        ]}>
          ⏰ Hora: {item.hora_inicio} - {item.hora_fin}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge,
          isSmallScreen && styles.reservaTextoSmall
        ]}>
          💰 Precio: {(() => {
            const precioNum = Number(item.precio);
            return isNaN(precioNum) ? '--' : precioNum.toFixed(2);
          })()} €
        </Text>
        {item.ludoteca && (
          <Text style={[
            styles.reservaTexto, 
            styles.reservaLudoteca,
            isLargeScreen && styles.reservaTextoLarge,
            isSmallScreen && styles.reservaTextoSmall
          ]}>
            🎯 Incluye ludoteca
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.botonAccion, 
          styles.botonCancelar, 
          isLargeScreen && styles.botonAccionLarge,
          isSmallScreen && styles.botonAccionSmall
        ]}
        onPress={() => cancelarReserva(item.id)}
      >
        <Ionicons 
          name="close-circle-outline" 
          size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
          color="#F44336" 
        />
        <Text style={[
          styles.textoAccion, 
          styles.textoEliminar, 
          isLargeScreen && styles.textoAccionLarge,
          isSmallScreen && styles.textoAccionSmall
        ]}>
          Cancelar
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={[
      styles.sectionHeader, 
      isLargeScreen && styles.sectionHeaderLarge,
      isSmallScreen && styles.sectionHeaderSmall
    ]}>
      <Text style={[
        styles.sectionHeaderText, 
        isLargeScreen && styles.sectionHeaderTextLarge,
        isSmallScreen && styles.sectionHeaderTextSmall
      ]}>
        {title}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal para editar precio */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            isLargeScreen && styles.modalContentLarge,
            isSmallScreen && styles.modalContentSmall
          ]}>
            <Text style={[
              styles.modalTitle, 
              isLargeScreen && styles.modalTitleLarge,
              isSmallScreen && styles.modalTitleSmall
            ]}>
              Editar Precio
            </Text>
            <Text style={styles.modalPistaNombre}>
              {pistaEditando?.nombre}
            </Text>
            <Text style={styles.modalPolideportivoInfo}>
              {obtenerNombrePolideportivo(pistaEditando?.polideportivo_id)}
            </Text>
            
            <TextInput
              style={[
                styles.modalInput, 
                isLargeScreen && styles.modalInputLarge,
                isSmallScreen && styles.modalInputSmall
              ]}
              placeholder="Nuevo precio"
              value={precioEditando}
              onChangeText={setPrecioEditando}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={guardarPrecio}
              >
                <Text style={styles.modalButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para agregar polideportivo */}
<Modal
  animationType="slide"
  transparent={true}
  visible={modalPolideportivoVisible}
  onRequestClose={() => setModalPolideportivoVisible(false)}
>
  <View style={styles.modalContainer}>
    <View style={[
      styles.modalContent, 
      isLargeScreen && styles.modalContentLarge,
      isSmallScreen && styles.modalContentSmall
    ]}>
      <Text style={[
        styles.modalTitle, 
        isLargeScreen && styles.modalTitleLarge,
        isSmallScreen && styles.modalTitleSmall
      ]}>
        Agregar Polideportivo
      </Text>
      
      <TextInput
        style={[
          styles.modalInput, 
          isLargeScreen && styles.modalInputLarge,
          isSmallScreen && styles.modalInputSmall
        ]}
        placeholder="Nombre del polideportivo"
        value={nuevoPolideportivoNombre}
        onChangeText={setNuevoPolideportivoNombre}
        placeholderTextColor="#999"
      />
      
      <TextInput
        style={[
          styles.modalInput, 
          isLargeScreen && styles.modalInputLarge,
          isSmallScreen && styles.modalInputSmall
        ]}
        placeholder="Dirección"
        value={nuevoPolideportivoDireccion}
        onChangeText={setNuevoPolideportivoDireccion}
        placeholderTextColor="#999"
      />

      {/* Añadir este TextInput para el teléfono */}
      <TextInput
        style={[
          styles.modalInput, 
          isLargeScreen && styles.modalInputLarge,
          isSmallScreen && styles.modalInputSmall
        ]}
        placeholder="Teléfono (opcional)"
        value={nuevoPolideportivoTelefono}
        onChangeText={setNuevoPolideportivoTelefono}
        placeholderTextColor="#999"
        keyboardType="phone-pad"
      />
      
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.modalButtonCancel]}
          onPress={() => setModalPolideportivoVisible(false)}
        >
          <Text style={styles.modalButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButton, styles.modalButtonSave]}
          onPress={agregarPolideportivo}
        >
          <Text style={styles.modalButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      <View style={[
        styles.header, 
        isLargeScreen && styles.headerLarge,
        isSmallScreen && styles.headerSmall
      ]}>
        <Text style={[
          styles.titulo, 
          isLargeScreen && styles.tituloLarge,
          isSmallScreen && styles.tituloSmall
        ]}>
          Panel de Administración
        </Text>
        <Text style={[
          styles.subtitulo, 
          isLargeScreen && styles.subtituloLarge,
          isSmallScreen && styles.subtituloSmall
        ]}>
          Bienvenido, {usuario?.nombre || 'Administrador'}
        </Text>
        
        <View style={[
          styles.tabsContainer, 
          isLargeScreen && styles.tabsContainerLarge,
          isSmallScreen && styles.tabsContainerSmall
        ]}>
          <TouchableOpacity
            style={[
              styles.tabButton, 
              activeTab === 'polideportivos' && styles.activeTab,
              isLargeScreen && styles.tabButtonLarge,
              isSmallScreen && styles.tabButtonSmall
            ]}
            onPress={() => setActiveTab('polideportivos')}
          >
            <Text style={[
              styles.tabText, 
              activeTab === 'polideportivos' && styles.activeTabText,
              isLargeScreen && styles.tabTextLarge,
              isSmallScreen && styles.tabTextSmall
            ]}>
              Polideportivos
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton, 
              activeTab === 'pistas' && styles.activeTab,
              isLargeScreen && styles.tabButtonLarge,
              isSmallScreen && styles.tabButtonSmall
            ]}
            onPress={() => setActiveTab('pistas')}
          >
            <Text style={[
              styles.tabText, 
              activeTab === 'pistas' && styles.activeTabText,
              isLargeScreen && styles.tabTextLarge,
              isSmallScreen && styles.tabTextSmall
            ]}>
              Pistas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton, 
              activeTab === 'reservas' && styles.activeTab,
              isLargeScreen && styles.tabButtonLarge,
              isSmallScreen && styles.tabButtonSmall
            ]}
            onPress={() => setActiveTab('reservas')}
          >
            <Text style={[
              styles.tabText, 
              activeTab === 'reservas' && styles.activeTabText,
              isLargeScreen && styles.tabTextLarge,
              isSmallScreen && styles.tabTextSmall
            ]}>
              Reservas
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'polideportivos' ? (
        <FlatList
          data={polideportivos}
          renderItem={renderPolideportivoItem}
          keyExtractor={(item) => item.id.toString()}
          refreshing={refreshing}
          onRefresh={fetchData}
          ListHeaderComponent={
            <View style={[
              styles.listaContainer, 
              isLargeScreen && styles.listaContainerLarge,
              isSmallScreen && styles.listaContainerSmall
            ]}>
              <View style={styles.seccionHeader}>
                <Text style={[
                  styles.seccionTitulo, 
                  isLargeScreen && styles.seccionTituloLarge,
                  isSmallScreen && styles.seccionTituloSmall
                ]}>
                  Polideportivos ({polideportivos.length})
                </Text>
                <TouchableOpacity
                  style={[
                    styles.botonAgregar,
                    isLargeScreen && styles.botonAgregarLarge,
                    isSmallScreen && styles.botonAgregarSmall
                  ]}
                  onPress={() => setModalPolideportivoVisible(true)}
                >
                  <Text style={[
                    styles.botonAgregarTexto, 
                    isLargeScreen && styles.botonAgregarTextoLarge,
                    isSmallScreen && styles.botonAgregarTextoSmall
                  ]}>
                    Agregar
                  </Text>
                  <Ionicons 
                    name="add-circle-outline" 
                    size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.listaVaciaContainer}>
              <Text style={[
                styles.listaVacia, 
                isLargeScreen && styles.listaVaciaLarge,
                isSmallScreen && styles.listaVaciaSmall
              ]}>
                No hay polideportivos registrados
              </Text>
              <TouchableOpacity
                style={[
                  styles.botonAgregar,
                  isLargeScreen && styles.botonAgregarLarge,
                  isSmallScreen && styles.botonAgregarSmall
                ]}
                onPress={() => setModalPolideportivoVisible(true)}
              >
                <Text style={[
                  styles.botonAgregarTexto, 
                  isLargeScreen && styles.botonAgregarTextoLarge,
                  isSmallScreen && styles.botonAgregarTextoSmall
                ]}>
                  Agregar Primer Polideportivo
                </Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={[
            styles.reservasContentContainer,
            isLargeScreen && styles.reservasContentContainerLarge,
            isSmallScreen && styles.reservasContentContainerSmall
          ]}
        />
      ) : activeTab === 'pistas' ? (
        <ScrollView 
          style={[
            styles.scrollContainer, 
            isLargeScreen && styles.scrollContainerLarge,
            isSmallScreen && styles.scrollContainerSmall
          ]}
          contentContainerStyle={styles.scrollContentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchData}
            />
          }
        >
          <View style={[
            styles.formularioContainer, 
            isLargeScreen && styles.formularioContainerLarge,
            isSmallScreen && styles.formularioContainerSmall
          ]}>
            <Text style={[
              styles.seccionTitulo, 
              isLargeScreen && styles.seccionTituloLarge,
              isSmallScreen && styles.seccionTituloSmall
            ]}>
              Agregar Nueva Pista
            </Text>

            <TextInput
              style={[
                styles.input, 
                isLargeScreen && styles.inputLarge,
                isSmallScreen && styles.inputSmall
              ]}
              placeholder="Nombre de la pista"
              value={nuevoNombre}
              onChangeText={text => {
                setNuevoNombre(text);
                setErrorNombreRepetido('');
              }}
              placeholderTextColor="#999"
            />
            {errorNombreRepetido ? (
              <Text style={[
                styles.errorTexto, 
                isLargeScreen && styles.errorTextoLarge,
                isSmallScreen && styles.errorTextoSmall
              ]}>
                {errorNombreRepetido}
              </Text>
            ) : null}

            <DropDownPicker
              open={open}
              value={nuevoTipo}
              items={items}
              setOpen={setOpen}
              setValue={setNuevoTipo}
              setItems={setItems}
              placeholder="Seleccionar tipo"
              style={[
                styles.dropdown, 
                isLargeScreen && styles.dropdownLarge,
                isSmallScreen && styles.dropdownSmall
              ]}
              dropDownContainerStyle={[
                styles.dropdownContainer, 
                isLargeScreen && styles.dropdownContainerLarge,
                isSmallScreen && styles.dropdownContainerSmall
              ]}
              zIndex={3000}
              zIndexInverse={1000}
              textStyle={[
                isLargeScreen ? styles.dropdownTextLarge : null,
                isSmallScreen ? styles.dropdownTextSmall : null
              ]}
            />

            <DropDownPicker
              open={openPolideportivo}
              value={nuevoPolideportivo}
              items={polideportivosItems}
              setOpen={setOpenPolideportivo}
              setValue={setNuevoPolideportivo}
              setItems={setPolideportivosItems}
              placeholder="Seleccionar polideportivo"
              style={[
                styles.dropdown, 
                isLargeScreen && styles.dropdownLarge,
                isSmallScreen && styles.dropdownSmall
              ]}
              dropDownContainerStyle={[
                styles.dropdownContainer, 
                isLargeScreen && styles.dropdownContainerLarge,
                isSmallScreen && styles.dropdownContainerSmall
              ]}
              zIndex={2000}
              zIndexInverse={2000}
              textStyle={[
                isLargeScreen ? styles.dropdownTextLarge : null,
                isSmallScreen ? styles.dropdownTextSmall : null
              ]}
            />

            <TextInput
              style={[
                styles.input, 
                isLargeScreen && styles.inputLarge,
                isSmallScreen && styles.inputSmall
              ]}
              placeholder="Precio por hora (€)"
              value={nuevoPrecio}
              onChangeText={setNuevoPrecio}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[
                styles.botonAgregar,
                (!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio || !nuevoPolideportivo) && styles.botonDisabled,
                isLargeScreen && styles.botonAgregarLarge,
                isSmallScreen && styles.botonAgregarSmall
              ]}
              onPress={agregarPista}
              disabled={!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio || !nuevoPolideportivo}
            >
              <Text style={[
                styles.botonAgregarTexto, 
                isLargeScreen && styles.botonAgregarTextoLarge,
                isSmallScreen && styles.botonAgregarTextoSmall
              ]}>
                Agregar Pista
              </Text>
              <Ionicons 
                name="add-circle-outline" 
                size={isLargeScreen ? 24 : (isSmallScreen ? 16 : 20)} 
                color="white" 
              />
            </TouchableOpacity>
          </View>

          <View style={[
            styles.listaContainer, 
            isLargeScreen && styles.listaContainerLarge,
            isSmallScreen && styles.listaContainerSmall
          ]}>
            <Text style={[
              styles.seccionTitulo, 
              isLargeScreen && styles.seccionTituloLarge,
              isSmallScreen && styles.seccionTituloSmall
            ]}>
              Pistas Disponibles ({pistas.length})
            </Text>

            {pistas.length === 0 ? (
              <View style={styles.listaVaciaContainer}>
                <Text style={[
                  styles.listaVacia, 
                  isLargeScreen && styles.listaVaciaLarge,
                  isSmallScreen && styles.listaVaciaSmall
                ]}>
                  No hay pistas registradas
                </Text>
                <Text style={styles.listaVaciaSubtexto}>
                  Agrega tu primera pista usando el formulario superior
                </Text>
              </View>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderPistaItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={reservas}
          renderItem={renderReservaItem}
          keyExtractor={(item) => item.id.toString()}
          refreshing={refreshing}
          onRefresh={fetchData}
          ListHeaderComponent={
            <View style={[
              styles.listaContainer, 
              isLargeScreen && styles.listaContainerLarge,
              isSmallScreen && styles.listaContainerSmall
            ]}>
              <Text style={[
                styles.seccionTitulo, 
                isLargeScreen && styles.seccionTituloLarge,
                isSmallScreen && styles.seccionTituloSmall
              ]}>
                Reservas Activas ({reservas.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.listaVaciaContainer}>
              <Text style={[
                styles.listaVacia, 
                isLargeScreen && styles.listaVaciaLarge,
                isSmallScreen && styles.listaVaciaSmall
              ]}>
                No hay reservas activas
              </Text>
              <Text style={styles.listaVaciaSubtexto}>
                Las reservas aparecerán aquí cuando los usuarios realicen reservas
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.reservasContentContainer,
            isLargeScreen && styles.reservasContentContainerLarge,
            isSmallScreen && styles.reservasContentContainerSmall
          ]}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  // Contenedores principales
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },

  // Header y navegación
  header: {
    marginBottom: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerLarge: {
    paddingVertical: 30,
    paddingHorizontal: 40,
  },
  headerSmall: {
    padding: 15,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  tituloLarge: {
    fontSize: 32,
    fontWeight: '800',
  },
  tituloSmall: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  subtituloLarge: {
    fontSize: 20,
    marginTop: 8,
  },
  subtituloSmall: {
    fontSize: 14,
    marginTop: 2,
  },

  // Pestañas de navegación
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#E1E8ED',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5DDE5',
  },
  tabsContainerLarge: {
    marginTop: 24,
    borderRadius: 12,
    minWidth: 400,
  },
  tabsContainerSmall: {
    marginTop: 8,
    borderRadius: 6,
    alignSelf: 'stretch',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonLarge: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  tabButtonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activeTab: {
    backgroundColor: '#3498DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontWeight: '600',
    color: '#7F8C8D',
    fontSize: 14,
  },
  tabTextLarge: {
    fontSize: 16,
  },
  tabTextSmall: {
    fontSize: 12,
  },
  activeTabText: {
    color: 'white',
    fontWeight: '700',
  },

  // Contenedores de scroll
  scrollContainer: {
    flex: 1,
  },
  scrollContainerLarge: {
    paddingHorizontal: 40,
  },
  scrollContainerSmall: {
    paddingHorizontal: 8,
  },
  scrollContentContainer: {
    paddingBottom: 32,
  },

  // Formularios
  formularioContainer: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  formularioContainerLarge: {
    margin: 24,
    padding: 30,
    borderRadius: 18,
  },
  formularioContainerSmall: {
    margin: 8,
    padding: 12,
    borderRadius: 10,
  },

  // Secciones y títulos
  seccionTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34495E',
    marginBottom: 16,
  },
  seccionTituloLarge: {
    fontSize: 24,
    marginBottom: 20,
  },
  seccionTituloSmall: {
    fontSize: 16,
    marginBottom: 12,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Inputs y formularios
  input: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: '#FDFEFE',
    color: '#2C3E50',
  },
  inputLarge: {
    padding: 18,
    fontSize: 18,
    borderRadius: 12,
  },
  inputSmall: {
    padding: 10,
    fontSize: 14,
    borderRadius: 8,
  },
  errorTexto: {
    color: '#E74C3C',
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#FDECEA',
    padding: 8,
    borderRadius: 6,
  },
  errorTextoLarge: {
    fontSize: 16,
    padding: 12,
  },
  errorTextoSmall: {
    fontSize: 12,
    padding: 6,
  },

  // Dropdowns
  dropdown: {
    borderColor: '#BDC3C7',
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: '#FDFEFE',
  },
  dropdownLarge: {
    minHeight: 50,
    borderRadius: 12,
  },
  dropdownSmall: {
    minHeight: 40,
    borderRadius: 8,
  },
  dropdownContainer: {
    borderColor: '#BDC3C7',
    borderRadius: 10,
    backgroundColor: '#FDFEFE',
  },
  dropdownContainerLarge: {
    borderRadius: 12,
  },
  dropdownContainerSmall: {
    borderRadius: 8,
  },
  dropdownTextLarge: {
    fontSize: 18,
  },
  dropdownTextSmall: {
    fontSize: 14,
  },

  // Botones
  botonAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  botonAgregarLarge: {
    padding: 18,
    borderRadius: 12,
  },
  botonAgregarSmall: {
    padding: 10,
    borderRadius: 8,
  },
  botonDisabled: {
    backgroundColor: '#A9CCE3',
    shadowOpacity: 0,
    elevation: 0,
  },
  botonAgregarTexto: {
    color: 'white',
    fontWeight: '700',
    marginRight: 8,
    fontSize: 16,
  },
  botonAgregarTextoLarge: {
    fontSize: 18,
  },
  botonAgregarTextoSmall: {
    fontSize: 14,
  },

  // Listas y contenedores
  listaContainer: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  listaContainerLarge: {
    margin: 24,
    padding: 30,
    borderRadius: 18,
  },
  listaContainerSmall: {
    margin: 8,
    padding: 12,
    borderRadius: 10,
  },
  listaVacia: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginVertical: 20,
    fontSize: 16,
    fontStyle: 'italic',
  },
  listaVaciaLarge: {
    fontSize: 18,
    marginVertical: 30,
  },
  listaVaciaSmall: {
    fontSize: 14,
    marginVertical: 15,
  },

  // Section headers
  sectionHeader: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  sectionHeaderLarge: {
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 5,
  },
  sectionHeaderSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  sectionHeaderTextLarge: {
    fontSize: 20,
  },
  sectionHeaderTextSmall: {
    fontSize: 14,
  },

  // Tarjetas de polideportivos
  polideportivoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  polideportivoCardLarge: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  polideportivoCardSmall: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  polideportivoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  polideportivoNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    flex: 1,
  },
  polideportivoNombreLarge: {
    fontSize: 20,
  },
  polideportivoNombreSmall: {
    fontSize: 14,
  },
  polideportivoDireccion: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
    flex: 1,
  },
  pistasCountContainer: {
    backgroundColor: '#E1E8ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  pistasCount: {
    fontSize: 12,
    color: '#34495E',
    fontWeight: '600',
  },

  // Tarjetas de pistas
  pistaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  pistaCardLarge: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  pistaCardSmall: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  pistaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pistaNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    flex: 1,
  },
  pistaNombreLarge: {
    fontSize: 20,
  },
  pistaNombreSmall: {
    fontSize: 14,
  },
  pistaPrecio: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 4,
  },
  pistaInfo: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  estadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  estadoIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  estadoTexto: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },

  // Contenedores de acciones
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  accionesContainerLarge: {
    marginTop: 16,
  },
  botonAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E1E8ED',
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  botonAccionLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 12,
    marginBottom: 12,
  },
  botonAccionSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  botonEliminar: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5B7B1',
    borderWidth: 1,
  },
  botonCancelar: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5B7B1',
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  textoAccion: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
    color: '#34495E',
  },
  textoAccionLarge: {
    fontSize: 16,
    marginLeft: 8,
  },
  textoAccionSmall: {
    fontSize: 12,
    marginLeft: 4,
  },
  textoEliminar: {
    color: '#E74C3C',
  },

  // Tarjetas de reservas
  reservaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  reservaCardLarge: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  reservaCardSmall: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  reservaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reservaNombrePista: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    flex: 1,
  },
  reservaNombrePistaLarge: {
    fontSize: 20,
  },
  reservaNombrePistaSmall: {
    fontSize: 14,
  },
  reservaTipo: {
    fontSize: 12,
    color: '#7F8C8D',
    backgroundColor: '#E1E8ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: '600',
  },
  reservaTipoLarge: {
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reservaTipoSmall: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reservaInfo: {
    marginVertical: 8,
  },
  reservaTexto: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
    lineHeight: 20,
  },
  reservaTextoLarge: {
    fontSize: 16,
    lineHeight: 24,
  },
  reservaTextoSmall: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Contenedores de contenido
  reservasContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  reservasContentContainerLarge: {
    paddingHorizontal: 40,
    alignSelf: 'center',
    width: '80%',
    maxWidth: 800,
  },
  reservasContentContainerSmall: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },

  // Modales
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalContentLarge: {
    padding: 30,
    borderRadius: 16,
    maxWidth: 500,
  },
  modalContentSmall: {
    padding: 15,
    width: '95%',
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2C3E50',
    textAlign: 'center',
  },
  modalTitleLarge: {
    fontSize: 24,
    marginBottom: 15,
  },
  modalTitleSmall: {
    fontSize: 18,
    marginBottom: 8,
  },
  modalPistaNombre: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#34495E',
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#FDFEFE',
    color: '#2C3E50',
  },
  modalInputLarge: {
    padding: 16,
    fontSize: 18,
    borderRadius: 10,
  },
  modalInputSmall: {
    padding: 10,
    fontSize: 14,
    borderRadius: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalButtonCancel: {
    backgroundColor: '#E0E0E0',
  },
  modalButtonSave: {
    backgroundColor: '#3498DB',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  
loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  
  polideportivoInfo: {
    flex: 1,
  },
  
  polideportivoTelefono: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  
  pistaInfo: {
    flex: 1,
  },
  
  pistaDetalles: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  
  reservaInfoPrincipal: {
    flex: 1,
  },
  
  estadoReserva: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  
  estadoReservaTexto: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  
  reservaLudoteca: {
    color: '#E67E22',
    fontWeight: '600',
  },
  
  modalPolideportivoInfo: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  
  listaVaciaContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  listaVaciaSubtexto: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
});