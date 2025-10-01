import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  RefreshControl, 
  TouchableOpacity, 
  Alert,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../contexto/UserContex';
import { useNavigation } from '@react-navigation/native';

const MisReservas = () => {
  const { dni, usuario: nombreUsuario } = useContext(UserContext);
  const navigation = useNavigation();

  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // --- Alert multiplataforma ---
  const showAlert = (title, message, buttons = [], options = {}) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, buttons, options);
    }
  };

  // --- Formatos ---
  const formatTime = (timeString) =>
    timeString ? timeString.split(':').slice(0, 2).join(':') : '';

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  // --- Cancelación ---
  const esCancelable = (fecha, hora_inicio) => {
    const ahora = new Date();
    const inicioReserva = new Date(`${fecha}T${hora_inicio}`);

    if (inicioReserva < ahora) {
      return { cancelable: false, motivo: 'jugado' };
    }

    const diffHoras = (inicioReserva - ahora) / (1000 * 60 * 60);
    if (diffHoras < 1) {
      return { cancelable: false, motivo: 'proximo' };
    }

    return { cancelable: true, motivo: null };
  };

  // --- Icono según tipo de pista ---
  const getPistaIcon = (tipo) => {
    switch ((tipo || '').toLowerCase()) {
      case 'tenis':
        return 'tennisball-outline';
      case 'pádel':
      case 'padel':
        return 'tennisball';
      case 'fútbol':
      case 'futbol':
        return 'football';
      case 'baloncesto':
        return 'basketball';
      default:
        return 'grid';
    }
  };

  // --- Fetch ---
  const fetchReservas = async () => {
    try {
      setError(null);
      if (!dni) {
        setReservas([]);
        return;
      }

      const response = await fetch(`http://localhost:3001/reservas?dni_usuario=${dni}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Formato de respuesta inválido del servidor');
      }

      const reservasUsuario = result.data.filter((r) => r.dni_usuario === dni);
      const reservasProcesadas = reservasUsuario.map((r) => ({
        ...r,
        fecha: formatDate(r.fecha),
        hora_inicio: formatTime(r.hora_inicio),
        hora_fin: formatTime(r.hora_fin),
        precio: parseFloat(r.precio || 0).toFixed(2)
      }));

      reservasProcesadas.sort(
        (a, b) => new Date(`${b.fecha}T${b.hora_inicio}`) - new Date(`${a.fecha}T${a.hora_inicio}`)
      );

      setReservas(reservasProcesadas);
    } catch (error) {
      setError(error.message);
      setReservas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- Cancelar ---
  const cancelarReserva = async (idReserva) => {
    try {
      const response = await fetch(`http://localhost:3001/reservas/${idReserva}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Error al cancelar la reserva');

      await fetchReservas();
      showAlert('Reserva cancelada', 'La reserva ha sido cancelada correctamente');
    } catch (error) {
      showAlert('Error', error.message || 'No se pudo cancelar la reserva');
    }
  };

  const confirmarCancelacion = (idReserva) => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que quieres cancelar esta reserva?')) {
        cancelarReserva(idReserva);
      }
    } else {
      Alert.alert('Cancelar reserva', '¿Seguro que quieres cancelar esta reserva?', [
        { text: 'No', style: 'cancel' },
        { text: 'Sí', onPress: () => cancelarReserva(idReserva) }
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservas();
  };

  useEffect(() => {
    fetchReservas();
  }, [dni]);

  // --- Render de cada tarjeta ---
  const renderItem = ({ item }) => {
    const { cancelable, motivo } = esCancelable(item.fecha, item.hora_inicio);

    let estado = 'Pendiente';
    let bgColor = '#FEF9C3';
    let badgeColor = '#FACC15';

    if (motivo === 'jugado') {
      estado = 'Jugado';
      bgColor = '#E5E7EB';
      badgeColor = '#6B7280';
    } else if (item.estado === 'pagado') {
      estado = 'Pagado';
      bgColor = '#D1FAE5';
      badgeColor = '#10B981';
    }

    return (
      <View style={[styles.reservaItem, { backgroundColor: bgColor }]}>
        <View style={styles.headerRow}>
          <View style={styles.row}>
            <Ionicons name={getPistaIcon(item.tipo_pista)} size={22} color="#374151" />
            <Text style={styles.reservaTitulo}>
              {item.nombre_pista || `Pista ${item.pista}`} ({item.tipo_pista})
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{estado}</Text>
          </View>
        </View>

        <Text style={styles.reservaTexto}>
          {formatDateForDisplay(item.fecha)}, {item.hora_inicio} - {item.hora_fin}
        </Text>
        <Text style={styles.reservaPrecio}>Precio: {item.precio}€</Text>

        {/* Botón Pagar si está pendiente */}
        {item.estado === 'pendiente' ? (
          <TouchableOpacity
            style={[styles.botonPagar, { marginBottom: 6 }]}
            onPress={() => navigation.navigate('ResumenReserva', { reserva: item })}
          >
            <Text style={styles.textoBoton}>Pagar Ahora</Text>
          </TouchableOpacity>
        ) : null}

        {/* Botón Cancelar */}
        {cancelable ? (
          <TouchableOpacity
            style={styles.botonCancelar}
            onPress={() => confirmarCancelacion(item.id)}
          >
            <Text style={styles.textoBotonCancelar}>Cancelar Reserva</Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={{
              backgroundColor: '#9CA3AF',
              padding: 8,
              borderRadius: 6,
              color: 'white',
              textAlign: 'center',
              marginTop: 6
            }}
          >
            {motivo === 'jugado' ? 'Ya jugado' : 'No cancelable (<1h)'}
          </Text>
        )}
      </View>
    );
  };

  // --- Loading ---
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{ marginTop: 10 }}>Cargando tus reservas...</Text>
      </View>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning" size={40} color="#EF4444" />
        <Text style={[styles.noReservas, { color: '#EF4444', marginTop: 10 }]}>
          Error: {error}
        </Text>
      </View>
    );
  }

  // --- Lista ---
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis Reservas ({nombreUsuario})</Text>
      <Text style={{ textAlign: 'center', color: '#6B7280', marginBottom: 10 }}>
        Las reservas se pueden cancelar hasta una hora antes del inicio
      </Text>

      {reservas.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar" size={50} color="#D1D5DB" style={{ marginBottom: 15 }} />
          <Text style={styles.noReservas}>No tienes reservas activas</Text>
        </View>
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5CF6']} />
          }
        />
      )}
    </View>
  );
};

// --- Estilos ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? 40 : 20,
    backgroundColor: '#F9FAFB',
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'auto',
    width: Platform.OS === 'web' ? '80%' : '100%',
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111827',
    textAlign: 'center',
  },
  reservaItem: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reservaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#1F2937',
  },
  reservaTexto: {
    fontSize: 15,
    marginBottom: 4,
    color: '#374151',
  },
  reservaPrecio: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
    color: '#111827',
  },
  botonCancelar: {
    marginTop: 8,
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  botonPagar: {
    marginTop: 8,
    backgroundColor: '#10b981',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  textoBoton: {
    color: 'white',
    fontWeight: 'bold',
  },
  textoBotonCancelar: {
    color: 'white',
    fontWeight: 'bold',
  },
  noReservas: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  lista: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});

export default MisReservas;
