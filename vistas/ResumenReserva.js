import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';

export default function ResumenReserva({ route, navigation }) {
  const reserva = route?.params?.reserva;
  const mensaje = route?.params?.mensaje;
  const precioActualizado = route?.params?.precioActualizado;
  
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [datosPago, setDatosPago] = useState({
    nombre: '',
    tarjeta: '',
    expiracion: '',
    cvv: ''
  });

  const { width, height } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  const isMediumScreen = width > 480;
  const isSmallScreen = width < 380;

  // 👇 FUNCIÓN MEJORADA PARA FORMATEAR FECHA
  const formatoFechaLegible = (fechaInput) => {
    if (!fechaInput) return 'No especificado';
    
    let fechaObj;
    
    // Si ya es un string ISO
    if (typeof fechaInput === 'string' && fechaInput.includes('T')) {
      fechaObj = new Date(fechaInput);
    } 
    // Si es formato YYYY-MM-DD
    else if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
      fechaObj = new Date(fechaInput + 'T00:00:00');
    }
    // Otros casos
    else {
      fechaObj = new Date(fechaInput);
    }
    
    if (isNaN(fechaObj.getTime())) {
      return 'Fecha inválida';
    }
    
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return fechaObj.toLocaleDateString('es-ES', opciones);
  };

  // 👇 FUNCIÓN MEJORADA PARA OBTENER PRECIO
  const obtenerPrecio = () => {
    if (reserva?.precio === undefined || reserva?.precio === null) return 0;
    return typeof reserva.precio === 'string' ? parseFloat(reserva.precio) : reserva.precio;
  };

  // 👇 FUNCIONES MEJORADAS PARA OBTENER NOMBRES
  const obtenerPolideportivo = () => {
    return reserva?.polideportivo_nombre || 
           reserva?.nombre_polideportivo || 
           (reserva?.polideportivo_id ? `Polideportivo ${reserva.polideportivo_id}` : 'No especificado');
  };

  const obtenerPista = () => {
    return reserva?.pistaNombre || 
           reserva?.nombre_pista || 
           (reserva?.pista_id ? `Pista ${reserva.pista_id}` : 'No especificado');
  };

  const obtenerNombreUsuario = () => {
    return reserva?.nombre_usuario || 'Desconocido';
  };

  useEffect(() => {
    console.log('Datos completos de reserva recibidos:', reserva);
    console.log('Precio de la reserva:', obtenerPrecio());
    console.log('Mensaje:', mensaje);
    console.log('Precio actualizado:', precioActualizado);
    
    // Mostrar mensaje de éxito si existe
    if (mensaje && Platform.OS === 'web') {
      alert(mensaje);
    } else if (mensaje) {
      Alert.alert('Éxito', mensaje);
    }
  }, [reserva, mensaje, precioActualizado]);

  if (!reserva) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centrado}>
          <Text style={styles.errorTexto}>No se han recibido datos de la reserva.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const manejarEditarReserva = () => {
    console.log('Editando reserva:', reserva);
    navigation.navigate('FormularioReserva', { reserva });
  };

  const manejarCancelarReserva = async () => {
    if (!reserva?.id) {
      Alert.alert('Error', 'No se encontró el ID de la reserva');
      return;
    }

    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro de que quieres cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sí, cancelar', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('Cancelando reserva ID:', reserva.id);
              
              const response = await fetch(`http://localhost:3001/reservas/${reserva.id}/cancelar`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
              }

              const data = await response.json();
              console.log('Cancelación exitosa:', data);

              if (!data.success) {
                throw new Error(data.error || 'Error al cancelar la reserva');
              }

              Alert.alert(
                'Reserva Cancelada',
                'Tu reserva ha sido cancelada correctamente.',
                [{ text: 'OK', onPress: () => navigation.navigate('Reservas') }]
              );
            } catch (error) {
              console.error('Error en cancelación:', error);
              Alert.alert(
                'Error al cancelar', 
                error.message || 'No se pudo cancelar la reserva. Por favor intente nuevamente.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const manejarPago = async () => {
    if (Platform.OS === 'web') {
      setModalVisible(true);
    } else {
      procesarPago();
    }
  };

  const procesarPago = async () => {
    if (!reserva?.id) {
      Alert.alert('Error', 'No se encontró el ID de la reserva');
      return;
    }

    setLoading(true);

    try {
      console.log('Confirmando reserva ID:', reserva.id);
      
      const response = await fetch(`http://localhost:3001/reservas/${reserva.id}/confirmar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Confirmación exitosa:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al confirmar la reserva');
      }

      const reservaActualizada = {
        ...reserva,
        estado: 'confirmada',
        ...data.data
      };

      const precioFinal = obtenerPrecio();
      const mensajeExito = `Reserva #${reserva.id} confirmada correctamente.\nTotal: ${precioFinal} €`;

      if (Platform.OS === 'web') {
        alert(mensajeExito);
        navigation.navigate('Reservas', { reserva: reservaActualizada });
      } else {
        Alert.alert(
          'Reserva confirmada',
          mensajeExito,
          [{ text: 'OK', onPress: () => navigation.navigate('Reservas', { reserva: reservaActualizada }) }]
        );
      }
    } catch (error) {
      console.error('Error en confirmación:', error);
      Alert.alert(
        'Error al confirmar', 
        error.message || 'No se pudo confirmar la reserva. Por favor intente nuevamente.'
      );
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };

  const formatoTarjeta = (numero) => {
    const limpio = numero.replace(/\D/g, '');
    const partes = [];
    for (let i = 0; i < limpio.length; i += 4) {
      partes.push(limpio.substr(i, 4));
    }
    return partes.join(' ');
  };

  const validarFormulario = () => {
    return (
      datosPago.nombre.trim() &&
      datosPago.tarjeta.replace(/\D/g, '').length >= 13 &&
      datosPago.expiracion.length === 5 &&
      datosPago.cvv.length >= 3
    );
  };

  const estaConfirmada = reserva.estado === 'confirmada';
  const estaPendiente = reserva.estado === 'pendiente';
  const precioReserva = obtenerPrecio();

  const ReservaContent = () => (
    <View style={styles.content}>
      {/* Header con gradiente */}
      <View style={styles.header}>
        <Text style={[styles.titulo, isSmallScreen && styles.tituloSmall]}>
          Resumen de Reserva
        </Text>
        <Text style={[styles.subtituloHeader, isSmallScreen && styles.subtituloHeaderSmall]}>
          Revisa y confirma los detalles de tu reserva
        </Text>
        
        {/* 👇 MOSTRAR MENSAJE DE PRECIO ACTUALIZADO */}
        {precioActualizado && (
          <View style={styles.precioActualizadoBanner}>
            <Text style={styles.precioActualizadoText}>
              ✅ El precio se ha actualizado correctamente
            </Text>
          </View>
        )}
      </View>

      {/* Tarjeta principal de detalles */}
      <View style={[styles.tarjeta, isLargeScreen && styles.tarjetaLarge]}>
        <View style={[styles.encabezadoTarjeta, isSmallScreen && styles.encabezadoTarjetaSmall]}>
          <Text style={[styles.tituloTarjeta, isSmallScreen && styles.tituloTarjetaSmall]}>
            Detalles de la Reserva
          </Text>
          <View style={[styles.badgeEstado, estaConfirmada ? styles.badgeConfirmado : styles.badgePendiente]}>
            <Text style={styles.badgeTexto}>
              {estaConfirmada ? '✅ Confirmada' : '⏳ Pendiente'}
            </Text>
          </View>
        </View>

        <View style={styles.gridDetalles}>
          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Usuario</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              {obtenerNombreUsuario()}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Número de Reserva</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              #{reserva.id || 'Pendiente'}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Polideportivo</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              {obtenerPolideportivo()}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Pista</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              {obtenerPista()}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Fecha</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              {formatoFechaLegible(reserva.fecha)}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Horario</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              {reserva.hora_inicio} - {reserva.hora_fin}
            </Text>
          </View>

          {/* 👇 SECCIÓN DE PRECIO DESTACADA */}
          <View style={[styles.datoContainer, styles.datoPrecio, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Precio Total</Text>
            <View style={styles.precioContainer}>
              <Text style={[styles.precio, isSmallScreen && styles.precioSmall]}>
                {precioReserva} €
              </Text>
              {precioActualizado && (
                <Text style={styles.precioActualizadoBadge}>
                  Actualizado
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Botones de acción para reservas pendientes */}
        {estaPendiente && (
          <View style={styles.botonesAccionContainer}>
            <TouchableOpacity 
              style={[styles.botonAccion, styles.botonEditar]}
              onPress={manejarEditarReserva}
              disabled={loading}
            >
              <Text style={styles.botonAccionTexto}>✏️ Modificar Reserva</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.botonAccion, styles.botonCancelar]}
              onPress={manejarCancelarReserva}
              disabled={loading}
            >
              <Text style={styles.botonAccionTexto}>🗑️ Cancelar Reserva</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sección de confirmación */}
      {estaPendiente && (
        <View style={[styles.tarjeta, isLargeScreen && styles.tarjetaLarge]}>
          <Text style={[styles.tituloTarjeta, isSmallScreen && styles.tituloTarjetaSmall]}>
            Confirmar Reserva
          </Text>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={[styles.infoText, isSmallScreen && styles.infoTextSmall]}>
              Puedes confirmar tu reserva ahora o más tarde. Tu reserva seguirá activa como pendiente.
            </Text>
          </View>
          
          <View style={[
            styles.botonesContainer, 
            isMediumScreen && styles.botonesFila,
            isSmallScreen && styles.botonesContainerSmall
          ]}>
            <TouchableOpacity 
              style={[
                styles.botonPrincipal, 
                styles.botonConfirmar,
                isSmallScreen && styles.botonPrincipalSmall
              ]} 
              onPress={manejarPago}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={[styles.botonTexto, isSmallScreen && styles.botonTextoSmall]}>
                    Confirmar Ahora
                  </Text>
                  <Text style={[styles.botonSubtexto, isSmallScreen && styles.botonSubtextoSmall]}>
                    Pagar {precioReserva} €
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.botonPrincipal, 
                styles.botonSecundario,
                isSmallScreen && styles.botonPrincipalSmall
              ]} 
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('Reservas', { reserva });
              }}
              disabled={loading}
            >
              <Text style={[
                styles.botonTexto, 
                styles.botonTextoSecundario,
                isSmallScreen && styles.botonTextoSmall
              ]}>
                Confirmar Más Tarde
              </Text>
              <Text style={[
                styles.botonSubtexto, 
                styles.botonSubtextoSecundario,
                isSmallScreen && styles.botonSubtextoSmall
              ]}>
                Ir a mis reservas
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Información para reservas confirmadas */}
      {estaConfirmada && (
        <View style={[styles.tarjeta, isLargeScreen && styles.tarjetaLarge]}>
          <Text style={[styles.tituloTarjeta, isSmallScreen && styles.tituloTarjetaSmall]}>
            Reserva Confirmada
          </Text>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>✅</Text>
            <Text style={[styles.infoText, isSmallScreen && styles.infoTextSmall]}>
              Tu reserva ha sido confirmada y pagada. Presenta este número de reserva en el polideportivo: 
              <Text style={styles.numeroReserva}> #{reserva.id}</Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmptyItem = () => null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        data={[{}]}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={<ReservaContent />}
        renderItem={renderEmptyItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />

      {/* Modal de confirmación en web */}
      {Platform.OS === 'web' && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[
              styles.modalContent, 
              isLargeScreen && styles.modalContentLarge,
              isSmallScreen && styles.modalContentSmall
            ]}>
              <View style={styles.modalHeader}>
                <Text style={[
                  styles.modalTitulo,
                  isSmallScreen && styles.modalTituloSmall
                ]}>
                  Confirmar Pago
                </Text>
                <TouchableOpacity 
                  style={styles.botonCerrar}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.botonCerrarTexto}>×</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.infoBoxModal}>
                <Text style={[
                  styles.infoTextModal,
                  isSmallScreen && styles.infoTextModalSmall
                ]}>
                  Completa los datos de pago para confirmar tu reserva en {obtenerPolideportivo()}
                </Text>
              </View>
              
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[
                    styles.inputLabel,
                    isSmallScreen && styles.inputLabelSmall
                  ]}>
                    Nombre en la tarjeta
                  </Text>
                  <TextInput
                    style={[styles.input, isSmallScreen && styles.inputSmall]}
                    placeholder="Ej: Juan Pérez"
                    value={datosPago.nombre}
                    onChangeText={(text) => setDatosPago({...datosPago, nombre: text})}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[
                    styles.inputLabel,
                    isSmallScreen && styles.inputLabelSmall
                  ]}>
                    Número de tarjeta
                  </Text>
                  <TextInput
                    style={[styles.input, isSmallScreen && styles.inputSmall]}
                    placeholder="0000 0000 0000 0000"
                    value={formatoTarjeta(datosPago.tarjeta)}
                    onChangeText={(text) => setDatosPago({...datosPago, tarjeta: text.replace(/\D/g, '')})}
                    keyboardType="numeric"
                    maxLength={19}
                  />
                </View>
                
                <View style={[
                  styles.filaInputs,
                  isSmallScreen && styles.filaInputsSmall
                ]}>
                  <View style={styles.inputGroup}>
                    <Text style={[
                      styles.inputLabel,
                      isSmallScreen && styles.inputLabelSmall
                    ]}>
                      Fecha expiración
                    </Text>
                    <TextInput
                      style={[styles.input, isSmallScreen && styles.inputSmall]}
                      placeholder="MM/AA"
                      value={datosPago.expiracion}
                      onChangeText={(text) => {
                        const limpio = text.replace(/[^0-9]/g, '');
                        if (limpio.length > 2) {
                          setDatosPago({...datosPago, expiracion: `${limpio.substring(0, 2)}/${limpio.substring(2, 4)}`});
                        } else {
                          setDatosPago({...datosPago, expiracion: limpio});
                        }
                      }}
                      maxLength={5}
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={[
                      styles.inputLabel,
                      isSmallScreen && styles.inputLabelSmall
                    ]}>
                      CVV
                    </Text>
                    <TextInput
                      style={[styles.input, isSmallScreen && styles.inputSmall]}
                      placeholder="123"
                      value={datosPago.cvv}
                      onChangeText={(text) => setDatosPago({...datosPago, cvv: text.replace(/\D/g, '').slice(0, 4)})}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>
              
              <View style={styles.resumenPago}>
                <Text style={[
                  styles.resumenLabel,
                  isSmallScreen && styles.resumenLabelSmall
                ]}>
                  Total a pagar:
                </Text>
                <Text style={[
                  styles.resumenPrecio,
                  isSmallScreen && styles.resumenPrecioSmall
                ]}>
                  {precioReserva} €
                </Text>
              </View>
              
              <View style={[
                styles.botonesModal,
                isSmallScreen && styles.botonesModalSmall
              ]}>
                <TouchableOpacity 
                  style={[styles.botonModal, styles.botonCancelarModal]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.textoBotonModal}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.botonModal, styles.botonConfirmarModal, !validarFormulario() && styles.botonDisabled]}
                  onPress={procesarPago}
                  disabled={!validarFormulario() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.textoBotonModal}>
                      Pagar {precioReserva} €
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.botonMasTardeModal}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('Reservas', { reserva });
                }}
              >
                <Text style={styles.textoBotonMasTarde}>Confirmar más tarde</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// Los estilos se mantienen igual...
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: '#667eea',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 16,
  },
  titulo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  tituloSmall: {
    fontSize: 24,
  },
  subtituloHeader: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  subtituloHeaderSmall: {
    fontSize: 14,
  },
  precioActualizadoBanner: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  precioActualizadoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  tarjetaLarge: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  encabezadoTarjeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  encabezadoTarjetaSmall: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  tituloTarjeta: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  tituloTarjetaSmall: {
    fontSize: 18,
  },
  badgeEstado: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeConfirmado: {
    backgroundColor: '#dcfce7',
  },
  badgePendiente: {
    backgroundColor: '#fef3c7',
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  gridDetalles: {
    gap: 16,
  },
  datoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  datoContainerSmall: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  datoPrecio: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  datoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    flex: 1,
  },
  datoLabelSmall: {
    fontSize: 13,
  },
  datoValor: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    flex: 2,
    textAlign: 'right',
  },
  datoValorSmall: {
    fontSize: 14,
    textAlign: 'left',
    flex: 1,
  },
  precioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  precio: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  precioSmall: {
    fontSize: 20,
  },
  precioActualizadoBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  botonesAccionContainer: {
    marginTop: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
  },
  botonAccion: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
  },
  botonEditar: {
    backgroundColor: '#fff',
    borderColor: '#3b82f6',
  },
  botonCancelar: {
    backgroundColor: '#fff',
    borderColor: '#ef4444',
  },
  botonAccionTexto: {
    fontSize: 16,
    fontWeight: '600',
  },
  numeroReserva: {
    fontWeight: '700',
    color: '#059669',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  infoTextSmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  botonesContainer: {
    gap: 12,
  },
  botonesContainerSmall: {
    gap: 8,
  },
  botonesFila: {
    flexDirection: 'row',
  },
  botonPrincipal: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  botonPrincipalSmall: {
    padding: 14,
  },
  botonConfirmar: {
    backgroundColor: '#059669',
  },
  botonSecundario: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  botonTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  botonTextoSmall: {
    fontSize: 14,
  },
  botonTextoSecundario: {
    color: '#374151',
  },
  botonSubtexto: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  botonSubtextoSmall: {
    fontSize: 11,
  },
  botonSubtextoSecundario: {
    color: '#6b7280',
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  errorTexto: {
    color: '#dc2626',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Estilos para el modal (web) - se mantienen igual
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 0,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalContentLarge: {
    maxWidth: 600,
  },
  modalContentSmall: {
    maxWidth: '100%',
    marginHorizontal: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalTituloSmall: {
    fontSize: 20,
  },
  botonCerrar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonCerrarTexto: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '300',
  },
  infoBoxModal: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
  },
  infoTextModal: {
    fontSize: 14,
    color: '#0369a1',
    textAlign: 'center',
    fontWeight: '500',
  },
  infoTextModalSmall: {
    fontSize: 13,
  },
  formContainer: {
    padding: 20,
    paddingTop: 0,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputLabelSmall: {
    fontSize: 13,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1f2937',
  },
  inputSmall: {
    padding: 12,
    fontSize: 14,
  },
  filaInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  filaInputsSmall: {
    flexDirection: 'column',
    gap: 12,
  },
  resumenPago: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    marginTop: 8,
  },
  resumenLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  resumenLabelSmall: {
    fontSize: 15,
  },
  resumenPrecio: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  resumenPrecioSmall: {
    fontSize: 20,
  },
  botonesModal: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  botonesModalSmall: {
    flexDirection: 'column',
    gap: 8,
  },
  botonModal: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  botonCancelarModal: {
    backgroundColor: '#6b7280',
  },
  botonConfirmarModal: {
    backgroundColor: '#059669',
  },
  botonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.7,
  },
  textoBotonModal: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  botonMasTardeModal: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  textoBotonMasTarde: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});