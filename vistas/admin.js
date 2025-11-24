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
  Platform,
  Modal,
  StatusBar,
  Dimensions,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useUser } from '../contexto/UserContex';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';

const API_URL = 'https://tfgv2-production.up.railway.app/pistas';
const RESERVAS_URL = 'https://tfgv2-production.up.railway.app/reservas';
const POLIDEPORTIVOS_URL = 'https://tfgv2-production.up.railway.app/polideportivos';

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
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isSmallScreen = width < 400;
  const [modalVisible, setModalVisible] = useState(false);
  const [pistaEditando, setPistaEditando] = useState(null);
  const [precioEditando, setPrecioEditando] = useState('');
  const [modalPolideportivoVisible, setModalPolideportivoVisible] = useState(false);
  const [nuevoPolideportivoNombre, setNuevoPolideportivoNombre] = useState('');
  const [nuevoPolideportivoDireccion, setNuevoPolideportivoDireccion] = useState('');
  const [nuevoPolideportivoTelefono, setNuevoPolideportivoTelefono] = useState('');
  const [modalPistaVisible, setModalPistaVisible] = useState(false);
  const [filtroPolideportivo, setFiltroPolideportivo] = useState('todos');

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

  // Filtrar pistas por polideportivo
  const pistasFiltradas = filtroPolideportivo === 'todos' 
    ? pistas 
    : pistas.filter(pista => pista.polideportivo_id.toString() === filtroPolideportivo);

  // Agrupar pistas por tipo
  const pistasPorTipo = pistasFiltradas.reduce((acc, pista) => {
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

  // Obtener icono según el tipo de pista
  const getIconoTipoPista = (tipo) => {
    switch (tipo) {
      case 'Fútbol':
        return '⚽';
      case 'Baloncesto':
        return '🏀';
      case 'Tenis':
        return '🎾';
      case 'Padel':
        return '🎯';
      case 'Voley':
        return '🏐';
      case 'Futbol Sala':
        return '👟';
      default:
        return '🏟️';
    }
  };

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
      setModalPistaVisible(false);
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

  // Eliminar polideportivo - CORREGIDO
  const eliminarPolideportivo = async (id) => {
    // Verificar si hay pistas asociadas a este polideportivo
    const pistasAsociadas = pistas.filter(pista => pista.polideportivo_id === id);
    
    if (pistasAsociadas.length > 0) {
      Alert.alert(
        'No se puede eliminar',
        `Este polideportivo tiene ${pistasAsociadas.length} pista(s) asociada(s). Elimina primero todas las pistas antes de eliminar el polideportivo.`,
        [{ text: 'Entendido', style: 'cancel' }]
      );
      return;
    }

    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar este polideportivo?');
      if (confirmar) {
        await handleEliminarPolideportivo(id);
      }
    } else {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar este polideportivo?',
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
      
      Alert.alert('Éxito', 'Polideportivo eliminado correctamente');
    } catch (error) {
      console.error('Error al eliminar polideportivo:', error);
      Alert.alert('Error', error.message || 'No se pudo eliminar el polideportivo');
    }
  };

  // Eliminar pista
  const eliminarPista = async (id) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar esta pista?');
      if (confirmar) {
        await handleEliminar(id);
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

  const cancelarReserva = async (id) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm('¿Estás seguro de que deseas eliminar esta reserva?');
      if (confirmar) {
        await handleCancelarReserva(id);
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
      isLargeScreen && styles.polideportivoCardLarge
    ]}>
      <View style={styles.polideportivoHeader}>
        <View style={styles.polideportivoInfo}>
          <Text style={[
            styles.polideportivoNombre, 
            isLargeScreen && styles.polideportivoNombreLarge
          ]}>
            🏟️ {item.nombre}
          </Text>
          <Text style={styles.polideportivoDireccion}>📍 {item.direccion}</Text>
          {item.telefono && (
            <Text style={styles.polideportivoTelefono}>📞 Tel: {item.telefono}</Text>
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
          isLargeScreen && styles.botonAccionLarge
        ]}
        onPress={() => eliminarPolideportivo(item.id)}
      >
        <Ionicons 
          name="trash-outline" 
          size={isLargeScreen ? 24 : 20} 
          color="#F44336" 
        />
        <Text style={[
          styles.textoAccion, 
          styles.textoEliminar,
          isLargeScreen && styles.textoAccionLarge
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
      isLargeScreen && styles.pistaCardLarge
    ]}>
      <View style={styles.pistaHeader}>
        <View style={styles.pistaInfo}>
          <Text style={[
            styles.pistaNombre, 
            isLargeScreen && styles.pistaNombreLarge
          ]}>
            {getIconoTipoPista(item.tipo)} {item.nombre}
          </Text>
          <Text style={styles.pistaDetalles}>
            🏟️ {obtenerNombrePolideportivo(item.polideportivo_id)} • 💰 {item.precio} €/hora
          </Text>
        </View>
        <View style={styles.estadoContainer}>
          <View style={[
            styles.estadoIndicator,
            { backgroundColor: item.enMantenimiento ? '#FFA500' : '#4CAF50' }
          ]} />
          <Text style={styles.estadoTexto}>
            {item.enMantenimiento ? '🛠️ En mantenimiento' : '✅ Disponible'}
          </Text>
        </View>
      </View>

      <View style={[
        styles.accionesContainer, 
        isLargeScreen && styles.accionesContainerLarge
      ]}>
        <TouchableOpacity
          style={[
            styles.botonAccion,
            isLargeScreen && styles.botonAccionLarge
          ]}
          onPress={() => toggleMantenimiento(item.id)}
        >
          <MaterialIcons
            name={item.enMantenimiento ? 'handyman' : 'construction'}
            size={isLargeScreen ? 24 : 20}
            color={item.enMantenimiento ? '#FFA500' : '#607D8B'}
          />
          <Text style={[
            styles.textoAccion,
            isLargeScreen && styles.textoAccionLarge
          ]}>
            {item.enMantenimiento ? 'Reactivar' : 'Mantenimiento'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botonAccion,
            isLargeScreen && styles.botonAccionLarge
          ]}
          onPress={() => abrirModalEditar(item)}
        >
          <Ionicons 
            name="pencil-outline" 
            size={isLargeScreen ? 24 : 20} 
            color="#3498DB" 
          />
          <Text style={[
            styles.textoAccion,
            isLargeScreen && styles.textoAccionLarge
          ]}>
            Editar Precio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botonAccion, 
            styles.botonEliminar,
            isLargeScreen && styles.botonAccionLarge
          ]}
          onPress={() => eliminarPista(item.id)}
        >
          <Ionicons 
            name="trash-outline" 
            size={isLargeScreen ? 24 : 20} 
            color="#F44336" 
          />
          <Text style={[
            styles.textoAccion, 
            styles.textoEliminar,
            isLargeScreen && styles.textoAccionLarge
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
      isLargeScreen && styles.reservaCardLarge
    ]}>
      <View style={styles.reservaHeader}>
        <View style={styles.reservaInfoPrincipal}>
          <Text style={[
            styles.reservaNombrePista, 
            isLargeScreen && styles.reservaNombrePistaLarge
          ]}>
            {item.pistaNombre || item.pista}
          </Text>
          <Text style={[
            styles.reservaTipo, 
            isLargeScreen && styles.reservaTipoLarge
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
          isLargeScreen && styles.reservaTextoLarge
        ]}>
          👤 Usuario: {item.nombre_usuario || 'Desconocido'}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge
        ]}>
          📅 Fecha: {new Date(item.fecha).toLocaleDateString('es-ES')}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge
        ]}>
          ⏰ Hora: {item.hora_inicio} - {item.hora_fin}
        </Text>
        <Text style={[
          styles.reservaTexto, 
          isLargeScreen && styles.reservaTextoLarge
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
            isLargeScreen && styles.reservaTextoLarge
          ]}>
            🎯 Incluye ludoteca
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.botonAccion, 
          styles.botonCancelar,
          isLargeScreen && styles.botonAccionLarge
        ]}
        onPress={() => cancelarReserva(item.id)}
      >
        <Ionicons 
          name="close-circle-outline" 
          size={isLargeScreen ? 24 : 20} 
          color="#F44336" 
        />
        <Text style={[
          styles.textoAccion, 
          styles.textoEliminar,
          isLargeScreen && styles.textoAccionLarge
        ]}>
          Cancelar
        </Text>
      </TouchableOpacity>
    </View>
  );

  // CORREGIDO: Función para renderizar secciones
  const renderSectionHeader = ({ section }) => (
    <View style={[
      styles.sectionHeader, 
      isLargeScreen && styles.sectionHeaderLarge
    ]}>
      <Text style={[
        styles.sectionHeaderText, 
        isLargeScreen && styles.sectionHeaderTextLarge
      ]}>
        {getIconoTipoPista(section.title)} {section.title} ({section.data.length})
      </Text>
    </View>
  );

  // Contenido principal que se mostrará en el FlatList
  const renderContent = () => {
    switch (activeTab) {
      case 'polideportivos':
        return (
          <View style={styles.tabContent}>
            <View style={[
              styles.listHeader,
              isLargeScreen && styles.listHeaderLarge
            ]}>
              <View style={styles.seccionHeader}>
                <Text style={[
                  styles.seccionTitulo, 
                  isLargeScreen && styles.seccionTituloLarge
                ]}>
                  🏟️ Polideportivos ({polideportivos.length})
                </Text>
                <TouchableOpacity
                  style={[
                    styles.botonAgregar,
                    isLargeScreen && styles.botonAgregarLarge
                  ]}
                  onPress={() => setModalPolideportivoVisible(true)}
                >
                  <Text style={[
                    styles.botonAgregarTexto, 
                    isLargeScreen && styles.botonAgregarTextoLarge
                  ]}>
                    Agregar
                  </Text>
                  <Ionicons 
                    name="add-circle-outline" 
                    size={isLargeScreen ? 24 : 20} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {polideportivos.length === 0 ? (
              <View style={styles.listaVaciaContainer}>
                <Text style={[
                  styles.listaVacia, 
                  isLargeScreen && styles.listaVaciaLarge
                ]}>
                  No hay polideportivos registrados
                </Text>
                <TouchableOpacity
                  style={[
                    styles.botonAgregar,
                    isLargeScreen && styles.botonAgregarLarge
                  ]}
                  onPress={() => setModalPolideportivoVisible(true)}
                >
                  <Text style={[
                    styles.botonAgregarTexto, 
                    isLargeScreen && styles.botonAgregarTextoLarge
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
              styles.listHeader,
              isLargeScreen && styles.listHeaderLarge
            ]}>
              <View style={styles.seccionHeader}>
                <Text style={[
                  styles.seccionTitulo, 
                  isLargeScreen && styles.seccionTituloLarge
                ]}>
                  🎾 Pistas ({pistasFiltradas.length})
                </Text>
                <TouchableOpacity
                  style={[
                    styles.botonAgregar,
                    isLargeScreen && styles.botonAgregarLarge
                  ]}
                  onPress={() => setModalPistaVisible(true)}
                >
                  <Text style={[
                    styles.botonAgregarTexto, 
                    isLargeScreen && styles.botonAgregarTextoLarge
                  ]}>
                    Agregar Pista
                  </Text>
                  <Ionicons 
                    name="add-circle-outline" 
                    size={isLargeScreen ? 24 : 20} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>

              {/* Filtro por polideportivo */}
              <View style={styles.filtroContainer}>
                <Text style={[
                  styles.filtroLabel,
                  isLargeScreen && styles.filtroLabelLarge
                ]}>
                  Filtrar por polideportivo:
                </Text>
                <View style={styles.filtroBotones}>
                  <TouchableOpacity
                    style={[
                      styles.filtroBoton,
                      filtroPolideportivo === 'todos' && styles.filtroBotonActivo,
                      isLargeScreen && styles.filtroBotonLarge
                    ]}
                    onPress={() => setFiltroPolideportivo('todos')}
                  >
                    <Text style={[
                      styles.filtroBotonTexto,
                      filtroPolideportivo === 'todos' && styles.filtroBotonTextoActivo,
                      isLargeScreen && styles.filtroBotonTextoLarge
                    ]}>
                      Todos
                    </Text>
                  </TouchableOpacity>
                  {polideportivos.map(polideportivo => (
                    <TouchableOpacity
                      key={polideportivo.id}
                      style={[
                        styles.filtroBoton,
                        filtroPolideportivo === polideportivo.id.toString() && styles.filtroBotonActivo,
                        isLargeScreen && styles.filtroBotonLarge
                      ]}
                      onPress={() => setFiltroPolideportivo(polideportivo.id.toString())}
                    >
                      <Text style={[
                        styles.filtroBotonTexto,
                        filtroPolideportivo === polideportivo.id.toString() && styles.filtroBotonTextoActivo,
                        isLargeScreen && styles.filtroBotonTextoLarge
                      ]}>
                        {polideportivo.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {pistasFiltradas.length === 0 ? (
              <View style={styles.listaVaciaContainer}>
                <Text style={[
                  styles.listaVacia, 
                  isLargeScreen && styles.listaVaciaLarge
                ]}>
                  {filtroPolideportivo === 'todos' 
                    ? 'No hay pistas registradas' 
                    : 'No hay pistas en este polideportivo'
                  }
                </Text>
                <Text style={styles.listaVaciaSubtexto}>
                  {filtroPolideportivo === 'todos' 
                    ? 'Agrega tu primera pista usando el botón superior' 
                    : 'Cambia el filtro o agrega pistas a este polideportivo'
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.listContent}>
                {sections.map((section, index) => (
                  <View key={`section-${index}`}>
                    {renderSectionHeader({ section })}
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
        );

      case 'reservas':
        return (
          <View style={styles.tabContent}>
            <View style={[
              styles.listaContainer,
              isLargeScreen && styles.listaContainerLarge
            ]}>
              <Text style={[
                styles.seccionTitulo, 
                isLargeScreen && styles.seccionTituloLarge
              ]}>
                📋 Reservas Activas ({reservas.length})
              </Text>
            </View>
            
            {reservas.length === 0 ? (
              <View style={styles.listaVaciaContainer}>
                <Text style={[
                  styles.listaVacia, 
                  isLargeScreen && styles.listaVaciaLarge
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
      
      {/* Modal para agregar pista */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalPistaVisible}
        onRequestClose={() => setModalPistaVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            isLargeScreen && styles.modalContentLarge
          ]}>
            <Text style={[
              styles.modalTitle,
              isLargeScreen && styles.modalTitleLarge
            ]}>
              🎾 Agregar Nueva Pista
            </Text>
            
            <TextInput
              style={[
                styles.modalInput,
                isLargeScreen && styles.modalInputLarge
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
                isLargeScreen && styles.errorTextoLarge
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
                isLargeScreen && styles.dropdownLarge
              ]}
              dropDownContainerStyle={[
                styles.dropdownContainer,
                isLargeScreen && styles.dropdownContainerLarge
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
                isLargeScreen && styles.dropdownLarge
              ]}
              dropDownContainerStyle={[
                styles.dropdownContainer,
                isLargeScreen && styles.dropdownContainerLarge
              ]}
              zIndex={2000}
              zIndexInverse={2000}
            />

            <TextInput
              style={[
                styles.modalInput,
                isLargeScreen && styles.modalInputLarge
              ]}
              placeholder="Precio por hora (€)"
              value={nuevoPrecio}
              onChangeText={setNuevoPrecio}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalPistaVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonSave,
                  (!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio || !nuevoPolideportivo) && styles.botonDisabled
                ]}
                onPress={agregarPista}
                disabled={!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio || !nuevoPolideportivo}
              >
                <Text style={styles.modalButtonText}>Agregar Pista</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            isLargeScreen && styles.modalContentLarge
          ]}>
            <Text style={[
              styles.modalTitle,
              isLargeScreen && styles.modalTitleLarge
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
                isLargeScreen && styles.modalInputLarge
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
            isLargeScreen && styles.modalContentLarge
          ]}>
            <Text style={[
              styles.modalTitle,
              isLargeScreen && styles.modalTitleLarge
            ]}>
              🏟️ Agregar Polideportivo
            </Text>
            
            <TextInput
              style={[
                styles.modalInput,
                isLargeScreen && styles.modalInputLarge
              ]}
              placeholder="Nombre del polideportivo"
              value={nuevoPolideportivoNombre}
              onChangeText={setNuevoPolideportivoNombre}
              placeholderTextColor="#999"
            />
            
            <TextInput
              style={[
                styles.modalInput,
                isLargeScreen && styles.modalInputLarge
              ]}
              placeholder="Dirección"
              value={nuevoPolideportivoDireccion}
              onChangeText={setNuevoPolideportivoDireccion}
              placeholderTextColor="#999"
            />

            <TextInput
              style={[
                styles.modalInput,
                isLargeScreen && styles.modalInputLarge
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

      {/* ESTRUCTURA CON SCROLL FUNCIONAL */}
      <FlatList
        data={[]}
        keyExtractor={(item, index) => index.toString()}
        
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={[
              styles.header,
              isLargeScreen && styles.headerLarge
            ]}>
              <View style={[
                styles.headerContent,
                isLargeScreen && styles.headerContentLarge
              ]}>
                <View style={styles.headerTop}>
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                  >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                    <Text style={styles.backText}>Volver</Text>
                  </TouchableOpacity>
                  
                  <Text style={[
                    styles.welcomeText,
                    isLargeScreen && styles.welcomeTextLarge
                  ]}>
                    Panel de Administración
                  </Text>
                </View>
                
                <Text style={styles.username}>Bienvenido, {usuario?.nombre || 'Administrador'}</Text>
                
                {/* Tabs de navegación */}
                <View style={[
                  styles.tabsContainer,
                  isLargeScreen && styles.tabsContainerLarge
                ]}>
                  <TouchableOpacity
                    style={[
                      styles.tabButton, 
                      activeTab === 'polideportivos' && styles.activeTab,
                      isLargeScreen && styles.tabButtonLarge
                    ]}
                    onPress={() => setActiveTab('polideportivos')}
                  >
                    <Text style={[
                      styles.tabText, 
                      activeTab === 'polideportivos' && styles.activeTabText,
                      isLargeScreen && styles.tabTextLarge
                    ]}>
                      🏟️ Polideportivos
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.tabButton, 
                      activeTab === 'pistas' && styles.activeTab,
                      isLargeScreen && styles.tabButtonLarge
                    ]}
                    onPress={() => setActiveTab('pistas')}
                  >
                    <Text style={[
                      styles.tabText, 
                      activeTab === 'pistas' && styles.activeTabText,
                      isLargeScreen && styles.tabTextLarge
                    ]}>
                      🎾 Pistas
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.tabButton, 
                      activeTab === 'reservas' && styles.activeTab,
                      isLargeScreen && styles.tabButtonLarge
                    ]}
                    onPress={() => setActiveTab('reservas')}
                  >
                    <Text style={[
                      styles.tabText, 
                      activeTab === 'reservas' && styles.activeTabText,
                      isLargeScreen && styles.tabTextLarge
                    ]}>
                      📋 Reservas
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Contenido principal */}
            <View style={[
              styles.content,
              isLargeScreen && styles.contentLarge
            ]}>
              {renderContent()}
            </View>
          </>
        }

        renderItem={null}
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
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerLarge: {
    paddingHorizontal: '10%',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerContentLarge: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
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
  },
  welcomeTextLarge: {
    fontSize: 24,
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
  },
  tabsContainerLarge: {
    maxWidth: 600,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonLarge: {
    paddingVertical: 12,
  },
  activeTab: {
    backgroundColor: '#3498DB',
  },
  tabText: {
    fontWeight: '600',
    color: '#7F8C8D',
    fontSize: 13,
    textAlign: 'center',
  },
  tabTextLarge: {
    fontSize: 14,
  },
  activeTabText: {
    color: 'white',
    fontWeight: '700',
  },

  // Contenido principal - RESPONSIVE
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 16,
  },
  contentLarge: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: '10%',
  },
  tabContent: {
    flex: 1,
  },

  // Filtros - RESPONSIVE
  filtroContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  filtroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  filtroLabelLarge: {
    fontSize: 16,
  },
  filtroBotones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filtroBoton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#E1E8ED',
    borderWidth: 1,
    borderColor: '#D5DDE5',
  },
  filtroBotonLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filtroBotonActivo: {
    backgroundColor: '#3498DB',
    borderColor: '#2980B9',
  },
  filtroBotonTexto: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  filtroBotonTextoLarge: {
    fontSize: 14,
  },
  filtroBotonTextoActivo: {
    color: 'white',
  },

  // Listas - RESPONSIVE
  listHeader: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  listHeaderLarge: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    marginHorizontal: 'auto',
    marginVertical: 16,
    padding: 24,
  },
  listaContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  listaContainerLarge: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    marginHorizontal: 'auto',
    marginVertical: 16,
    padding: 24,
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
  },
  seccionTituloLarge: {
    fontSize: 20,
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
  errorTextoLarge: {
    fontSize: 14,
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
  dropdownContainer: {
    borderColor: '#BDC3C7',
    borderRadius: 6,
    backgroundColor: '#FDFEFE',
  },
  dropdownContainerLarge: {
    minHeight: 48,
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
  },
  botonAgregarLarge: {
    padding: 14,
    maxWidth: 300,
    alignSelf: 'center',
  },
  botonDisabled: {
    backgroundColor: '#A9CCE3',
  },
  botonAgregarTexto: {
    color: 'white',
    fontWeight: '700',
    marginRight: 8,
    fontSize: 15,
  },
  botonAgregarTextoLarge: {
    fontSize: 16,
  },

  // Estados vacíos - RESPONSIVE
  listaVaciaContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
  },
  listaVaciaSubtexto: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Section headers - RESPONSIVE
  sectionHeader: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
    marginHorizontal: 16,
  },
  sectionHeaderLarge: {
    marginHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  sectionHeaderTextLarge: {
    fontSize: 16,
  },

  // Tarjetas - RESPONSIVE
  polideportivoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  polideportivoCardLarge: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  pistaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  pistaCardLarge: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  reservaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  reservaCardLarge: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
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
  },
  polideportivoNombreLarge: {
    fontSize: 17,
  },
  polideportivoDireccion: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  polideportivoTelefono: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
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
  },
  pistaNombreLarge: {
    fontSize: 17,
  },
  pistaDetalles: {
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  estadoTexto: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },

  // Acciones - RESPONSIVE
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  accionesContainerLarge: {
    gap: 12,
  },
  botonAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#E1E8ED',
  },
  botonAccionLarge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textoAccion: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
    color: '#34495E',
  },
  textoAccionLarge: {
    fontSize: 14,
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
  },
  reservaNombrePistaLarge: {
    fontSize: 17,
  },
  reservaTipo: {
    fontSize: 12,
    color: '#7F8C8D',
    backgroundColor: '#E1E8ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: '600',
  },
  reservaTipoLarge: {
    fontSize: 13,
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
    fontSize: 15,
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
  },
  modalContentLarge: {
    padding: 24,
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2C3E50',
    textAlign: 'center',
  },
  modalTitleLarge: {
    fontSize: 20,
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
  modalInputLarge: {
    padding: 14,
    fontSize: 16,
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