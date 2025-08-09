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

export default function AdminPanel({ navigation }) {
  const { usuario } = useUser();
  const [pistas, setPistas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState(null);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'Fútbol', value: 'Fútbol' },
    { label: 'Baloncesto', value: 'Baloncesto' },
    { label: 'Tenis', value: 'Tenis' },
    { label: 'Padel', value: 'Padel' },
    { label: 'Voley', value: 'Voley' },
    { label: 'Futbol Sala', value: 'Futbol Sala' }
  ]);
  const [errorNombreRepetido, setErrorNombreRepetido] = useState('');
  const [activeTab, setActiveTab] = useState('pistas');
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isSmallScreen = width < 400;
  const [modalVisible, setModalVisible] = useState(false);
  const [pistaEditando, setPistaEditando] = useState(null);
  const [precioEditando, setPrecioEditando] = useState('');

  // Cargar pistas y reservas desde la API
const fetchData = useCallback(async () => {
  try {
    setRefreshing(true);
    
    const pistasResponse = await fetch(API_URL);
    if (!pistasResponse.ok) throw new Error(`Error ${pistasResponse.status}: ${await pistasResponse.text()}`);
    const pistasData = await pistasResponse.json();
    
   
    if (!pistasData.success || !Array.isArray(pistasData.data)) {
      throw new Error('Formato de respuesta inválido');
    }
    
    setPistas(pistasData.data); 
    
    const reservasResponse = await fetch(RESERVAS_URL);
    if (!reservasResponse.ok) throw new Error(`Error ${reservasResponse.status}: ${await reservasResponse.text()}`);
    const reservasData = await reservasResponse.json();
    
    // Verifica también la estructura de las reservas
    if (!reservasData.success || !Array.isArray(reservasData.data)) {
      throw new Error('Formato de respuesta inválido para reservas');
    }
    
    setReservas(reservasData.data);
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
    Alert.alert('Error', 'No se pudieron cargar los datos');
    setPistas([]); 
    setReservas([]);
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
  if (!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio) {
    Alert.alert('Error', 'Nombre, tipo y precio son obligatorios');
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
      }),
    });

    const responseData = await response.json();

    if (response.status === 409) {
      setErrorNombreRepetido(responseData.error || 'Ya existe una pista con ese nombre.');
      return;
    }

    if (!response.ok) {
      throw new Error(responseData.error || `Error ${response.status}`);
    }

    // Aquí está el cambio importante - usamos responseData.data
    setPistas((prevPistas) => [...prevPistas, responseData.data]);
    setNuevoNombre('');
    setNuevoTipo(null);
    setNuevoPrecio('');
    setOpen(false);
    Alert.alert('Éxito', 'Pista agregada correctamente');
  } catch (error) {
    console.error('Error al agregar pista:', error);
    Alert.alert('Error', error.message || 'No se pudo agregar la pista');
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

  // Confirmar y eliminar reserva
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

  // Petición para cancelar reserva
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

    const response = await fetch(`${API_URL}/${id}/mantenimiento`, {  // Cambiado a /mantenimiento
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
    
    // Actualiza el estado local con los datos devueltos por el backend
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
  // Abrir modal para editar precio
  const abrirModalEditar = (pista) => {
    setPistaEditando(pista);
    setPrecioEditando(pista.precio.toString());
    setModalVisible(true);
  };

  // Guardar cambios de precio
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

  const renderPistaItem = ({ item }) => (
    <View style={[
      styles.pistaCard, 
      isLargeScreen && styles.pistaCardLarge,
      isSmallScreen && styles.pistaCardSmall
    ]}>
      <View style={styles.pistaHeader}>
        <View>
          <Text style={[
            styles.pistaNombre, 
            isLargeScreen && styles.pistaNombreLarge,
            isSmallScreen && styles.pistaNombreSmall
          ]}>
            {item.nombre}
          </Text>
          <Text style={styles.pistaPrecio}>{item.precio} €/hora</Text>
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

  const renderReservaItem = ({ item }) => (
    <View style={[
      styles.reservaCard, 
      isLargeScreen && styles.reservaCardLarge,
      isSmallScreen && styles.reservaCardSmall
    ]}>
      <View style={styles.reservaHeader}>
        <Text style={[
          styles.reservaNombrePista, 
          isLargeScreen && styles.reservaNombrePistaLarge,
          isSmallScreen && styles.reservaNombrePistaSmall
        ]}>
          {item.pistaNombre}
        </Text>
        <Text style={[
          styles.reservaTipo, 
          isLargeScreen && styles.reservaTipoLarge,
          isSmallScreen && styles.reservaTipoSmall
        ]}>
          {item.pistaTipo}
        </Text>
      </View>
      
   <View style={styles.reservaInfo}>
  <Text style={[
    styles.reservaTexto, 
    isLargeScreen && styles.reservaTextoLarge,
    isSmallScreen && styles.reservaTextoSmall
  ]}>
    Usuario: {item.nombre_usuario || 'Desconocido'}
  </Text>
  <Text style={[
    styles.reservaTexto, 
    isLargeScreen && styles.reservaTextoLarge,
    isSmallScreen && styles.reservaTextoSmall
  ]}>
    Fecha: {new Date(item.fecha).toLocaleDateString()}
  </Text>
  <Text style={[
    styles.reservaTexto, 
    isLargeScreen && styles.reservaTextoLarge,
    isSmallScreen && styles.reservaTextoSmall
  ]}>
    Hora: {item.hora_inicio} - {item.hora_fin}
  </Text>
  <Text style={[
    styles.reservaTexto, 
    isLargeScreen && styles.reservaTextoLarge,
    isSmallScreen && styles.reservaTextoSmall
  ]}>
    Precio: {(() => {
      const precioNum = Number(item.precio);
      return isNaN(precioNum) ? '--' : precioNum.toFixed(2);
    })()} €
  </Text>
  <Text style={[
    styles.reservaTexto, 
    isLargeScreen && styles.reservaTextoLarge,
    isSmallScreen && styles.reservaTextoSmall
  ]}>
    Estado: {item.estado || 'Pendiente'}
  </Text>
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

      {activeTab === 'pistas' ? (
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
                (!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio) && styles.botonDisabled,
                isLargeScreen && styles.botonAgregarLarge,
                isSmallScreen && styles.botonAgregarSmall
              ]}
              onPress={agregarPista}
              disabled={!nuevoNombre.trim() || !nuevoTipo || !nuevoPrecio}
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
              <Text style={[
                styles.listaVacia, 
                isLargeScreen && styles.listaVaciaLarge,
                isSmallScreen && styles.listaVaciaSmall
              ]}>
                No hay pistas registradas
              </Text>
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
            <Text style={[
              styles.listaVacia, 
              isLargeScreen && styles.listaVaciaLarge,
              isSmallScreen && styles.listaVaciaSmall
            ]}>
              No hay reservas activas
            </Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  },
  headerLarge: {
    paddingVertical: 30,
  },
  headerSmall: {
    padding: 10,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  tituloLarge: {
    fontSize: 32,
  },
  tituloSmall: {
    fontSize: 20,
  },
  subtitulo: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 4,
  },
  subtituloLarge: {
    fontSize: 20,
    marginTop: 8,
  },
  subtituloSmall: {
    fontSize: 14,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#E1E8ED',
    overflow: 'hidden',
  },
  tabsContainerLarge: {
    marginTop: 24,
    borderRadius: 12,
  },
  tabsContainerSmall: {
    marginTop: 8,
    borderRadius: 6,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  tabButtonLarge: {
    paddingVertical: 14,
  },
  tabButtonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activeTab: {
    backgroundColor: '#3498DB',
  },
  tabText: {
    fontWeight: '600',
    color: '#7F8C8D',
  },
  tabTextLarge: {
    fontSize: 18,
  },
  tabTextSmall: {
    fontSize: 14,
  },
  activeTabText: {
    color: 'white',
  },
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
  input: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: '#FDFEFE',
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
  },
  errorTextoLarge: {
    fontSize: 16,
  },
  errorTextoSmall: {
    fontSize: 12,
  },
  dropdown: {
    borderColor: '#BDC3C7',
    marginBottom: 16,
    borderRadius: 10,
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
  botonAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 10,
    padding: 14,
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
  },
  listaVaciaLarge: {
    fontSize: 18,
    marginVertical: 30,
  },
  listaVaciaSmall: {
    fontSize: 14,
    marginVertical: 15,
  },
  sectionHeader: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  sectionHeaderLarge: {
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 12,
    borderRadius: 12,
  },
  sectionHeaderSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 6,
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
  pistaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
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
    alignItems: 'center',
    marginBottom: 10,
  },
  pistaNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
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
  estadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
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
  },
  botonAccionLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  botonAccionSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  botonEliminar: {
    backgroundColor: '#FDECEA',
  },
  botonCancelar: {
    backgroundColor: '#FDECEA',
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
  },
  textoAccionSmall: {
    fontSize: 12,
    marginLeft: 4,
  },
  textoEliminar: {
    color: '#E74C3C',
  },
  reservaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECF0F1',
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
  },
  reservaTextoLarge: {
    fontSize: 16,
  },
  reservaTextoSmall: {
    fontSize: 12,
  },
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalContentLarge: {
    padding: 30,
  },
  modalContentSmall: {
    padding: 15,
    width: '95%',
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
  },
  modalTitleSmall: {
    fontSize: 18,
  },
  modalPistaNombre: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#34495E',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalInputLarge: {
    padding: 16,
    fontSize: 18,
  },
  modalInputSmall: {
    padding: 10,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
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
  },
});