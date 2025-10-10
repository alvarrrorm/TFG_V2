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
  StatusBar,
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

  // Estados para hover effects
  const [isHoveredBack, setIsHoveredBack] = useState(false);

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

  // Función para obtener el nombre del polideportivo
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

  // Renderizado de pistas
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

  // Renderizado de reservas
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

  // Contenido principal que se mostrará en el FlatList
  const renderContent = () => {
    switch (activeTab) {
      case 'polideportivos':
        return (
          <View style={styles.tabContent}>
            <View style={styles.listHeader}>
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
            
            {polideportivos.length === 0 ? (
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
            ) : (
              <View style={styles.listContent}>
                {polideportivos.map((item) => (
                  <View key={item.id.toString()}>
                    {renderPolideportivoItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 'pistas':
        return (
          <View style={styles.tabContent}>
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
                <View style={styles.listContent}>
                  {sections.map((section, index) => (
                    <View key={`section-${index}`}>
                      {renderSectionHeader({ section: { title: section.title } })}
                      {section.data.map((pista) => (
                        <View key={pista.id}>
                          {renderPistaItem({ item: pista })}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );

      case 'reservas':
        return (
          <View style={styles.tabContent}>
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
            
            {reservas.length === 0 ? (
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
            ) : (
              <View style={styles.listContent}>
                {reservas.map((item) => (
                  <View key={item.id.toString()}>
                    {renderReservaItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

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
      <StatusBar barStyle="light-content" />
      
      {/* Modales (mantener igual) */}
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

      {/* ESTRUCTURA IDÉNTICA AL SELECTOR - CON SCROLL FUNCIONAL */}
      <FlatList
        data={[]} // Datos vacíos ya que usamos ListHeaderComponent para todo
        keyExtractor={(item, index) => index.toString()}
        
        // Header fijo con navegación + todo el contenido
        ListHeaderComponent={
          <>
            {/* Header fijo igual al Selector */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.headerTop}>
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[
                      styles.backButton,
                      isHoveredBack && styles.backButtonHovered
                    ]}
                    activeOpacity={0.8}
                    onMouseEnter={() => Platform.OS === 'web' && setIsHoveredBack(true)}
                    onMouseLeave={() => Platform.OS === 'web' && setIsHoveredBack(false)}
                  >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                    <Text style={styles.backText}>Volver</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.welcomeText}>Panel de Administración</Text>
                </View>
                
                <Text style={styles.username}>Bienvenido, {usuario?.nombre || 'Administrador'}</Text>
                
                {/* Tabs de navegación */}
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
            </View>

            {/* Contenido principal */}
            <View style={styles.content}>
              {renderContent()}
            </View>
          </>
        }

        renderItem={null} // No necesitamos renderizar items individuales
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchData}
          />
        }
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },

  // Header - RESPONSIVE
  header: {
    backgroundColor: 'white',
    paddingVertical: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        paddingHorizontal: '10%',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        paddingHorizontal: 20,
      }
    }),
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerContent: {
    alignItems: 'center',
    ...Platform.select({
      web: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
      },
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  backButtonHovered: {
    backgroundColor: '#2980B9',
  },
  backText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    flex: 1,
    ...Platform.select({
      web: {
        fontSize: 24,
      },
      small: {
        fontSize: 20,
      },
    }),
  },
  username: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Tabs de navegación - RESPONSIVE
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    backgroundColor: '#E1E8ED',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5DDE5',
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 600,
      },
    }),
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        paddingVertical: 12,
      },
      small: {
        paddingVertical: 8,
        paddingHorizontal: 12,
      },
    }),
  },
  activeTab: {
    backgroundColor: '#3498DB',
  },
  tabText: {
    fontWeight: '600',
    color: '#7F8C8D',
    fontSize: 13,
    textAlign: 'center',
    ...Platform.select({
      web: {
        fontSize: 14,
      },
      small: {
        fontSize: 12,
      },
    }),
  },
  activeTabText: {
    color: 'white',
    fontWeight: '700',
  },

  // Contenido principal - RESPONSIVE
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    ...Platform.select({
      web: {
        paddingHorizontal: '10%',
      },
      default: {
        paddingHorizontal: 0,
      }
    }),
  },
  content: {
    ...Platform.select({
      web: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        paddingHorizontal: 16,
      }
    }),
  },
  tabContent: {
    flex: 1,
  },

  // Formularios - RESPONSIVE
  formularioContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
        marginHorizontal: 'auto',
        marginVertical: 16,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
      }
    }),
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  formularioContainerLarge: {
    ...Platform.select({
      web: {
        padding: 24,
      },
      default: {
        padding: 20,
      }
    }),
  },
  formularioContainerSmall: {
    padding: 12,
  },

  // Listas - RESPONSIVE
  listHeader: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
        marginHorizontal: 'auto',
        marginVertical: 16,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
      }
    }),
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  listaContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
        marginHorizontal: 'auto',
        marginVertical: 16,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
      }
    }),
  },
  listContent: {
    paddingHorizontal: 0,
  },

  // Secciones - RESPONSIVE
  seccionTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 16,
    ...Platform.select({
      web: {
        fontSize: 20,
      },
      small: {
        fontSize: 16,
      },
    }),
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },

  // Inputs - RESPONSIVE
  input: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#FDFEFE',
    color: '#2C3E50',
    ...Platform.select({
      web: {
        fontSize: 14,
      },
    }),
  },
  inputLarge: {
    padding: 14,
  },
  inputSmall: {
    padding: 10,
    fontSize: 14,
  },
  errorTexto: {
    color: '#E74C3C',
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: '#FDECEA',
    padding: 8,
    borderRadius: 4,
  },

  // Dropdowns - RESPONSIVE
  dropdown: {
    borderColor: '#BDC3C7',
    marginBottom: 16,
    borderRadius: 6,
    backgroundColor: '#FDFEFE',
  },
  dropdownLarge: {
    minHeight: 48,
  },
  dropdownSmall: {
    minHeight: 42,
  },
  dropdownContainer: {
    borderColor: '#BDC3C7',
    borderRadius: 6,
    backgroundColor: '#FDFEFE',
  },

  // Botones - RESPONSIVE
  botonAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
    ...Platform.select({
      web: {
        padding: 14,
        maxWidth: 300,
        alignSelf: 'center',
      },
    }),
  },
  botonDisabled: {
    backgroundColor: '#A9CCE3',
  },
  botonAgregarTexto: {
    color: 'white',
    fontWeight: '700',
    marginRight: 8,
    fontSize: 15,
    ...Platform.select({
      web: {
        fontSize: 16,
      },
      small: {
        fontSize: 14,
      },
    }),
  },

  // Estados vacíos
  listaVaciaContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        paddingVertical: 60,
      },
    }),
  },
  listaVacia: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginVertical: 20,
    fontSize: 16,
    fontStyle: 'italic',
    ...Platform.select({
      web: {
        fontSize: 18,
      },
      small: {
        fontSize: 14,
      },
    }),
  },
  listaVaciaSubtexto: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
    ...Platform.select({
      small: {
        fontSize: 12,
      },
    }),
  },

  // Section headers
  sectionHeader: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
    ...Platform.select({
      web: {
        marginHorizontal: 16,
      },
    }),
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    ...Platform.select({
      web: {
        fontSize: 16,
      },
      small: {
        fontSize: 14,
      },
    }),
  },

  // Tarjetas - RESPONSIVE
  polideportivoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginHorizontal: 16,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        marginHorizontal: 16,
      }
    }),
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  pistaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: {
        marginHorizontal: 16,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        marginHorizontal: 16,
      }
    }),
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  reservaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        marginHorizontal: 16,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        marginHorizontal: 16,
      }
    }),
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },

  // Contenido de tarjetas - RESPONSIVE
  polideportivoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  polideportivoInfo: {
    flex: 1,
    minWidth: 200,
  },
  polideportivoNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    ...Platform.select({
      web: {
        fontSize: 17,
      },
      small: {
        fontSize: 15,
      },
    }),
  },
  polideportivoDireccion: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
    ...Platform.select({
      small: {
        fontSize: 13,
      },
    }),
  },
  polideportivoTelefono: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
    ...Platform.select({
      small: {
        fontSize: 13,
      },
    }),
  },
  pistasCountContainer: {
    backgroundColor: '#E1E8ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  pistasCount: {
    fontSize: 12,
    color: '#34495E',
    fontWeight: '600',
  },

  pistaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  pistaInfo: {
    flex: 1,
    minWidth: 200,
  },
  pistaNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    ...Platform.select({
      web: {
        fontSize: 17,
      },
      small: {
        fontSize: 15,
      },
    }),
  },
  pistaDetalles: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
    ...Platform.select({
      small: {
        fontSize: 13,
      },
    }),
  },
  estadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  estadoTexto: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
    ...Platform.select({
      small: {
        fontSize: 13,
      },
    }),
  },

  // Acciones - RESPONSIVE
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  botonAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#E1E8ED',
  },
  textoAccion: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
    color: '#34495E',
    ...Platform.select({
      small: {
        fontSize: 12,
      },
    }),
  },
  textoEliminar: {
    color: '#E74C3C',
  },

  reservaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  reservaInfoPrincipal: {
    flex: 1,
    minWidth: 200,
  },
  reservaNombrePista: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    ...Platform.select({
      web: {
        fontSize: 17,
      },
      small: {
        fontSize: 15,
      },
    }),
  },
  reservaTipo: {
    fontSize: 12,
    color: '#7F8C8D',
    backgroundColor: '#E1E8ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: '600',
    ...Platform.select({
      small: {
        fontSize: 11,
      },
    }),
  },
  reservaInfo: {
    marginVertical: 8,
  },
  reservaTexto: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
    lineHeight: 20,
    ...Platform.select({
      small: {
        fontSize: 13,
        lineHeight: 18,
      },
    }),
  },

  // Estados
  estadoReserva: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  estadoReservaTexto: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },

  // Modales - RESPONSIVE
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
      }
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2C3E50',
    textAlign: 'center',
    ...Platform.select({
      web: {
        fontSize: 20,
      },
    }),
  },
  modalPistaNombre: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#34495E',
    fontWeight: '600',
  },
  modalPolideportivoInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#FDFEFE',
    color: '#2C3E50',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  modalButton: {
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
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
    fontSize: 15,
  },
});