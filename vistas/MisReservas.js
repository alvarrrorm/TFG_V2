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
  Platform,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../contexto/UserContex';
import { useNavigation } from '@react-navigation/native';

const MisReservas = () => {
  const { dni, usuario: nombreUsuario } = useContext(UserContext);
  const navigation = useNavigation();

  const [reservas, setReservas] = useState([]);
  const [reservasPasadas, setReservasPasadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarPasadas, setMostrarPasadas] = useState(false);

  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  const isMediumScreen = width > 480;

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

  // --- Validaciones MEJORADAS ---
  const esCancelable = (fecha, hora_inicio) => {
    const ahora = new Date();
    const inicioReserva = new Date(`${fecha}T${hora_inicio}`);

    // Si ya pasó la reserva
    if (inicioReserva < ahora) {
      return { cancelable: false, motivo: 'pasada', mensaje: 'Esta reserva ya ha pasado' };
    }

    // Calcular diferencia en minutos para ser más precisos
    const diffMinutos = (inicioReserva - ahora) / (1000 * 60);
    
    // No se puede cancelar si falta menos de 1 hora (60 minutos)
    if (diffMinutos < 60) {
      const minutosRestantes = Math.floor(diffMinutos);
      return { 
        cancelable: false, 
        motivo: 'proxima', 
        mensaje: `Solo se puede cancelar hasta 1 hora antes. Faltan ${minutosRestantes} minutos` 
      };
    }

    return { cancelable: true, motivo: null, mensaje: null };
  };

  const esPagable = (fecha, hora_inicio, estado) => {
    // Solo se puede pagar si está pendiente y no ha pasado la fecha/hora
    if (estado !== 'pendiente') {
      return { pagable: false, motivo: 'estado', mensaje: 'Esta reserva ya ha sido procesada' };
    }

    const ahora = new Date();
    const inicioReserva = new Date(`${fecha}T${hora_inicio}`);

    if (inicioReserva < ahora) {
      return { pagable: false, motivo: 'pasada', mensaje: 'Esta reserva ya ha pasado' };
    }

    return { pagable: true, motivo: null, mensaje: null };
  };

  const esReservaPasada = (fecha, hora_inicio) => {
    const ahora = new Date();
    const inicioReserva = new Date(`${fecha}T${hora_inicio}`);
    return inicioReserva < ahora;
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

  // --- Fetch adaptado a tu backend actual ---
  const fetchReservas = async () => {
    try {
      setError(null);
      if (!nombreUsuario) {
        setReservas([]);
        setReservasPasadas([]);
        return;
      }

      const response = await fetch(`https://tfgv2-production.up.railway.app/reservas?nombre_usuario=${encodeURIComponent(nombreUsuario)}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Formato de respuesta inválido del servidor');
      }

      // Adaptar los campos del backend a lo que espera el frontend
      const reservasAdaptadas = result.data.map((r) => ({
        id: r.id,
        dni_usuario: r.dni_usuario,
        nombre_usuario: r.nombre_usuario,
        // Mapear campos del backend a los nombres que espera el frontend
        pista: r.pista_id, // Convertir pista_id a pista
        nombre_pista: r.pistaNombre || `Pista ${r.pista_id}`, // pistaNombre → nombre_pista
        tipo_pista: r.pistaTipo || 'Desconocido', // pistaTipo → tipo_pista
        fecha: formatDate(r.fecha),
        hora_inicio: formatTime(r.hora_inicio),
        hora_fin: formatTime(r.hora_fin),
        precio: parseFloat(r.precio || 0).toFixed(2),
        estado: r.estado,
        polideportivo_nombre: r.polideportivo_nombre || 'Polideportivo',
        ludoteca: r.ludoteca || false
      }));

      // Separar reservas activas y pasadas
      const ahora = new Date();
      const reservasActivas = [];
      const reservasHistoricas = [];

      reservasAdaptadas.forEach(reserva => {
        const inicioReserva = new Date(`${reserva.fecha}T${reserva.hora_inicio}`);
        if (inicioReserva >= ahora && reserva.estado !== 'cancelada') {
          reservasActivas.push(reserva);
        } else {
          reservasHistoricas.push(reserva);
        }
      });

      // Ordenar por fecha
      reservasActivas.sort((a, b) => new Date(`${a.fecha}T${a.hora_inicio}`) - new Date(`${b.fecha}T${b.hora_inicio}`));
      reservasHistoricas.sort((a, b) => new Date(`${b.fecha}T${b.hora_inicio}`) - new Date(`${a.fecha}T${a.hora_inicio}`));

      setReservas(reservasActivas);
      setReservasPasadas(reservasHistoricas);
    } catch (error) {
      setError(error.message);
      setReservas([]);
      setReservasPasadas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- Cancelar reserva MEJORADO ---
  const cancelarReserva = async (idReserva) => {
    try {
      // Primero verificamos si todavía se puede cancelar (por si acaso)
      const reserva = [...reservas, ...reservasPasadas].find(r => r.id === idReserva);
      if (reserva) {
        const { cancelable, mensaje } = esCancelable(reserva.fecha, reserva.hora_inicio);
        if (!cancelable) {
          showAlert('No se puede cancelar', mensaje);
          await fetchReservas(); // Recargar para actualizar estado
          return;
        }
      }

      const response = await fetch(`hhttps://tfgv2-production.up.railway.app/reservas/${idReserva}`, {
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

  const confirmarCancelacion = (reserva) => {
    const { cancelable, mensaje } = esCancelable(reserva.fecha, reserva.hora_inicio);
    
    if (!cancelable) {
      showAlert('No se puede cancelar', mensaje);
      return;
    }

    const mensajeConfirmacion = `¿Estás seguro de que quieres cancelar esta reserva?\n\n` +
      `📍 ${reserva.polideportivo_nombre}\n` +
      `🎾 ${reserva.nombre_pista} (${reserva.tipo_pista})\n` +
      `📅 ${formatDateForDisplay(reserva.fecha)}\n` +
      `⏰ ${reserva.hora_inicio} - ${reserva.hora_fin}\n` +
      `💰 ${reserva.precio} €`;

    if (Platform.OS === 'web') {
      if (window.confirm(mensajeConfirmacion)) {
        cancelarReserva(reserva.id);
      }
    } else {
      Alert.alert('Cancelar reserva', mensajeConfirmacion, [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', onPress: () => cancelarReserva(reserva.id) }
      ]);
    }
  };

  // --- Manejar pago ---
  const manejarPago = (reserva) => {
    const { pagable, mensaje } = esPagable(reserva.fecha, reserva.hora_inicio, reserva.estado);
    
    if (!pagable) {
      showAlert('No se puede pagar', mensaje);
      return;
    }

    // Navegar al resumen para pagar
    navigation.navigate('ResumenReserva', { reserva });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservas();
  };

  useEffect(() => {
    fetchReservas();
  }, [nombreUsuario]);

  // --- Render de cada tarjeta de reserva CORREGIDO ---
  const RenderReservaItem = ({ item, esPasada = false }) => {
    const { cancelable, motivo: motivoCancelacion, mensaje: mensajeCancelacion } = esCancelable(item.fecha, item.hora_inicio);
    const { pagable, motivo: motivoPago, mensaje: mensajePago } = esPagable(item.fecha, item.hora_inicio, item.estado);

    let estado = 'Pendiente';
    let bgColor = '#FEF9C3';
    let badgeColor = '#FACC15';

    if (esPasada) {
      estado = 'Completada';
      bgColor = '#E5E7EB';
      badgeColor = '#6B7280';
    } else if (item.estado === 'confirmada') {
      estado = 'Confirmada';
      bgColor = '#D1FAE5';
      badgeColor = '#10B981';
    } else if (item.estado === 'cancelada') {
      estado = 'Cancelada';
      bgColor = '#FEE2E2';
      badgeColor = '#EF4444';
    } else if (motivoCancelacion === 'pasada') {
      estado = 'Pasada';
      bgColor = '#E5E7EB';
      badgeColor = '#6B7280';
    }

    return (
      <View style={[styles.reservaItem, { backgroundColor: bgColor }]}>
        <View style={styles.headerRow}>
          <View style={styles.row}>
            <Ionicons name={getPistaIcon(item.tipo_pista)} size={isLargeScreen ? 26 : 22} color="#374151" />
            <View style={styles.infoContainer}>
              <Text style={styles.reservaTitulo}>
                {item.nombre_pista} ({item.tipo_pista})
              </Text>
              <Text style={styles.polideportivoText}>
                {item.polideportivo_nombre}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{estado}</Text>
          </View>
        </View>

        <Text style={styles.reservaTexto}>
          {formatDateForDisplay(item.fecha)}, {item.hora_inicio} - {item.hora_fin}
        </Text>
        <Text style={styles.reservaPrecio}>Precio: {item.precio}€</Text>

        {/* BOTONES PARA RESERVAS ACTIVAS NO CANCELADAS */}
        {!esPasada && item.estado !== 'cancelada' && (
          <View style={[styles.botonesContainer, isMediumScreen && styles.botonesFila]}>
            
            {/* BOTÓN PAGAR - Solo para reservas pendientes */}
            {item.estado === 'pendiente' && (
              <TouchableOpacity
                style={[
                  styles.botonPagar, 
                  !pagable && styles.botonDeshabilitado,
                  isMediumScreen && styles.botonFlex
                ]}
                onPress={() => manejarPago(item)}
                disabled={!pagable}
              >
                <Text style={[
                  styles.textoBoton,
                  !pagable && styles.textoBotonDeshabilitado
                ]}>
                  {pagable ? 'Pagar Ahora' : 'No Pagable'}
                </Text>
              </TouchableOpacity>
            )}

            {/* BOTÓN CANCELAR - Para reservas pendientes Y confirmadas */}
            <TouchableOpacity
              style={[
                styles.botonCancelar,
                !cancelable && styles.botonDeshabilitado,
                isMediumScreen && styles.botonFlex
              ]}
              onPress={() => {
                if (cancelable) {
                  confirmarCancelacion(item);
                } else {
                  showAlert('No se puede cancelar', mensajeCancelacion);
                }
              }}
              disabled={!cancelable}
            >
              <Text style={[
                styles.textoBotonCancelar,
                !cancelable && styles.textoBotonDeshabilitado
              ]}>
                {cancelable ? 'Cancelar Reserva' : 'No Cancelable'}
              </Text>
            </TouchableOpacity>

            {/* BOTÓN VER DETALLES - Para reservas confirmadas */}
            {item.estado === 'confirmada' && (
              <TouchableOpacity
                style={[
                  styles.botonDetalles,
                  isMediumScreen && styles.botonFlex
                ]}
                onPress={() => navigation.navigate('ResumenReserva', { reserva: item })}
              >
                <Text style={styles.textoBoton}>Ver Detalles</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* MENSAJES INFORMATIVOS */}
        {!esPasada && item.estado === 'pendiente' && !pagable && (
          <Text style={styles.textoAdvertencia}>
            ⚠️ {mensajePago}
          </Text>
        )}

        {!esPasada && !cancelable && (
          <Text style={styles.textoAdvertencia}>
            ⚠️ {mensajeCancelacion}
          </Text>
        )}
      </View>
    );
  };

  // --- Componente con TODO el contenido ---
  const ReservasContent = () => (
    <View style={styles.content}>
      <Text style={styles.titulo}>Mis Reservas ({nombreUsuario})</Text>
      <Text style={styles.subtitulo}>
        Gestiona tus reservas activas y consulta el historial
      </Text>

      {/* Estadísticas rápidas */}
      <View style={styles.estadisticasContainer}>
        <View style={styles.estadisticaItem}>
          <Text style={styles.estadisticaNumero}>{reservas.length}</Text>
          <Text style={styles.estadisticaTexto}>Activas</Text>
        </View>
        <View style={styles.estadisticaItem}>
          <Text style={styles.estadisticaNumero}>{reservasPasadas.length}</Text>
          <Text style={styles.estadisticaTexto}>Histórico</Text>
        </View>
      </View>

      {/* RESERVAS ACTIVAS */}
      <View style={styles.seccionContainer}>
        <Text style={styles.seccionTitulo}>Reservas Activas</Text>
        <Text style={styles.seccionSubtitulo}>
          Próximas reservas pendientes de confirmar o pagar
        </Text>

        {reservas.length === 0 ? (
          <View style={styles.centeredSeccion}>
            <Ionicons name="calendar" size={isLargeScreen ? 60 : 40} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <Text style={styles.noReservas}>No tienes reservas activas</Text>
            <TouchableOpacity 
              style={styles.botonNuevaReserva}
              onPress={() => navigation.navigate('CrearReserva')}
            >
              <Text style={styles.textoBoton}>Hacer Nueva Reserva</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listaContainer}>
            {reservas.map((item) => (
              <RenderReservaItem key={item.id.toString()} item={item} esPasada={false} />
            ))}
          </View>
        )}
      </View>

      {/* HISTORIAL DE RESERVAS (oculto por defecto) */}
      {reservasPasadas.length > 0 && (
        <View style={styles.seccionContainer}>
          <TouchableOpacity 
            style={styles.botonHistorial}
            onPress={() => setMostrarPasadas(!mostrarPasadas)}
          >
            <Text style={styles.botonHistorialTexto}>
              {mostrarPasadas ? '📋 Ocultar Historial' : '📋 Ver Historial'} 
              ({reservasPasadas.length})
            </Text>
            <Ionicons 
              name={mostrarPasadas ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#6B7280" 
            />
          </TouchableOpacity>

          {mostrarPasadas && (
            <View style={styles.historialContainer}>
              <Text style={styles.seccionSubtitulo}>
                Reservas pasadas, completadas y canceladas
              </Text>
              <View style={styles.listaContainer}>
                {reservasPasadas.map((item) => (
                  <RenderReservaItem key={item.id.toString()} item={item} esPasada={true} />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // --- Item vacío para el FlatList ---
  const renderEmptyItem = () => null;

  // --- Loading ---
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <ActivityIndicator size={isLargeScreen ? "large" : "large"} color="#8B5CF6" />
          <Text style={[styles.loadingText, isLargeScreen && styles.loadingTextLarge]}>
            Cargando tus reservas...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <Ionicons name="warning" size={isLargeScreen ? 50 : 40} color="#EF4444" />
          <Text style={[styles.noReservas, { color: '#EF4444', marginTop: 10 }, isLargeScreen && styles.errorTextLarge]}>
            Error: {error}
          </Text>
          <TouchableOpacity style={styles.botonReintentar} onPress={fetchReservas}>
            <Text style={styles.textoBoton}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Lista con Scroll ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        data={[{}]} // Array con un elemento vacío
        keyExtractor={(item, index) => index.toString()}
        
        // Todo el contenido como header
        ListHeaderComponent={<ReservasContent />}
        
        renderItem={renderEmptyItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5CF6']} />
        }
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
    </SafeAreaView>
  );
};

// --- Estilos Responsive ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#1F2937',
    textAlign: 'center',
  },
  subtitulo: {
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 30,
    fontSize: 16,
    fontWeight: '500',
  },
  estadisticasContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 30,
  },
  estadisticaItem: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    minWidth: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  estadisticaNumero: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  estadisticaTexto: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  seccionContainer: {
    marginBottom: 30,
  },
  seccionTitulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  seccionSubtitulo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  botonHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  botonHistorialTexto: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  historialContainer: {
    marginTop: 10,
  },
  listaContainer: {
    paddingBottom: 10,
  },
  reservaItem: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginHorizontal: Platform.OS === 'web' ? 'auto' : 0,
    maxWidth: 800,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 10,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  reservaTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  polideportivoText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  reservaTexto: {
    fontSize: 16,
    marginBottom: 6,
    color: '#374151',
  },
  reservaPrecio: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
    color: '#111827',
  },
  botonesContainer: {
    marginTop: 12,
  },
  botonesFila: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  botonCancelar: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 140,
  },
  botonPagar: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 140,
  },
  botonDetalles: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 140,
  },
  botonFlex: {
    flex: 1,
  },
  botonDeshabilitado: {
    backgroundColor: '#9CA3AF',
  },
  botonReintentar: {
    marginTop: 20,
    backgroundColor: '#8B5CF6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  botonNuevaReserva: {
    marginTop: 15,
    backgroundColor: '#8B5CF6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 200,
  },
  textoBoton: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  textoBotonDeshabilitado: {
    color: '#E5E7EB',
  },
  textoBotonCancelar: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  textoAdvertencia: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 6,
    color: '#92400E',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 13,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  noReservas: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 15,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#6B7280',
  },
  loadingTextLarge: {
    fontSize: 18,
    marginTop: 20,
  },
  errorTextLarge: {
    fontSize: 18,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  centeredSeccion: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});

export default MisReservas;