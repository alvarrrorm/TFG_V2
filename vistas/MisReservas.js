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

const MisReservas = () => {
  const { dni, usuario: nombreUsuario } = useContext(UserContext);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Función para mostrar alertas multiplataforma
  const showAlert = (title, message, buttons = [], options = {}) => {
    if (Platform.OS === 'web') {
      // Usar window.alert para web
      window.alert(`${title}\n\n${message}`);
    } else {
      // Usar Alert de React Native para móvil
      Alert.alert(title, message, buttons, options);
    }
  };

  const formatTime = (timeString) => {
    return timeString ? timeString.split(':').slice(0, 2).join(':') : '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // CORRECCIÓN: Usar 'T00:00:00' para evitar problemas de zona horaria
    // o mejor aún, usar el método más robusto
    const date = new Date(dateString);
    
    // Asegurarnos de que la fecha se muestra correctamente
    // sin ajustes de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Función para formatear fecha para mostrar (más legible)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const fetchReservas = async () => {
    try {
      setError(null);
      
      // Verificar que tenemos el DNI del usuario
      if (!dni) {
        console.log('No hay DNI de usuario en el contexto');
        setReservas([]);
        return;
      }
      
      console.log(`Buscando reservas para DNI: ${dni}`);
      const response = await fetch(`http://localhost:3001/reservas?dni_usuario=${dni}`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Respuesta del servidor:', result);
      
      // Verificar que la respuesta tiene el formato correcto
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Formato de respuesta inválido del servidor');
      }

      // Procesar solo las reservas del usuario actual
      const reservasUsuario = result.data.filter(reserva => reserva.dni_usuario === dni);

      const reservasProcesadas = reservasUsuario.map(reserva => ({
        ...reserva,
        fecha: formatDate(reserva.fecha),
        hora_inicio: formatTime(reserva.hora_inicio),
        hora_fin: formatTime(reserva.hora_fin),
        precio: parseFloat(reserva.precio || 0).toFixed(2)
      }));

      const reservasOrdenadas = reservasProcesadas.sort((a, b) => {
        const dateA = new Date(`${a.fecha}T${a.hora_inicio}`);
        const dateB = new Date(`${b.fecha}T${b.hora_inicio}`);
        return dateB - dateA;
      });
      
      setReservas(reservasOrdenadas);
    } catch (error) {
      console.error('Error al cargar reservas:', error);
      setError(error.message);
      setReservas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const cancelarReserva = async (idReserva) => {
    try {
      const response = await fetch(`http://localhost:3001/reservas/${idReserva}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al cancelar la reserva');
      }

      // Actualizar la lista de reservas inmediatamente después de cancelar
      await fetchReservas();
      
      showAlert(
        'Reserva cancelada',
        'La reserva ha sido cancelada correctamente'
      );
    } catch (error) {
      showAlert(
        'Error',
        error.message || 'No se pudo cancelar la reserva'
      );
    }
  };

  const confirmarCancelacion = (idReserva) => {
    if (Platform.OS === 'web') {
      // Implementación para web con confirm
      const confirmar = window.confirm('¿Estás seguro de que quieres cancelar esta reserva?');
      if (confirmar) {
        cancelarReserva(idReserva);
      }
    } else {
      // Implementación para móvil con Alert
      Alert.alert(
        'Cancelar reserva',
        '¿Estás seguro de que quieres cancelar esta reserva?',
        [
          {
            text: 'No',
            style: 'cancel'
          },
          { 
            text: 'Sí', 
            onPress: () => cancelarReserva(idReserva) 
          }
        ]
      );
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservas();
  };

  useEffect(() => {
    fetchReservas();
  }, [dni]);

  const renderItem = ({ item }) => (
    <View style={styles.reservaItem}>
      <Ionicons 
        name={item.estado === 'pagado' ? 'checkmark-circle' : 'time'} 
        size={24} 
        color={item.estado === 'pagado' ? '#10B981' : '#F59E0B'} 
        style={styles.icon} 
      />
      <View style={styles.reservaInfo}>
        <Text style={styles.reservaTexto}>
          {/* CORRECCIÓN: Usar la función de formateo mejorada */}
          {formatDateForDisplay(item.fecha)}, de {item.hora_inicio} a {item.hora_fin}
        </Text>
        <Text style={styles.reservaSubtexto}>
          Pista: {item.nombre_pista || `Pista ${item.pista}`} ({item.tipo_pista})
        </Text>
        <Text style={styles.reservaEstado}>
          Estado: {item.estado === 'pagado' ? 'Pagado' : 'Pendiente'} - {item.precio}€
        </Text>
        <TouchableOpacity 
          style={styles.botonCancelar}
          onPress={() => confirmarCancelacion(item.id)}
        >
          <Text style={styles.textoBotonCancelar}>Cancelar Reserva</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{ marginTop: 10 }}>Cargando tus reservas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning" size={40} color="#EF4444" />
        <Text style={[styles.noReservas, { color: '#EF4444', marginTop: 10 }]}>
          Error: {error}
        </Text>
        <Text style={{ marginTop: 10, color: '#6B7280' }}>
          Desliza hacia abajo para reintentar
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis Reservas ({nombreUsuario})</Text>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#8B5CF6']}
            />
          }
        />
      )}
    </View>
  );
};

// Estilos mejorados para web y móvil
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }
      }
    })
  },
  icon: {
    marginRight: 15,
    marginTop: 3,
  },
  reservaInfo: {
    flex: 1,
  },
  reservaTexto: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  reservaSubtexto: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  reservaEstado: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  botonCancelar: {
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 5,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#DC2626'
        }
      }
    })
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
});

export default MisReservas;