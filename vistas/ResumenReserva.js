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

  useEffect(() => {
    console.log('Datos completos de reserva recibidos:', reserva);
    console.log('Polideportivo nombre:', obtenerPolideportivo());
    console.log('Pista nombre:', obtenerPista());
  }, [reserva]);

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

      const mensajeExito = `Reserva #${reserva.id} confirmada correctamente.\nTotal: ${reserva.precio || 0} €`;

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

  const formatoFechaLegible = (fechaISO) => {
    if (!fechaISO) return 'No especificado';
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fechaISO).toLocaleDateString('es-ES', opciones);
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

  // Función para obtener el nombre del polideportivo
  const obtenerPolideportivo = () => {
    // Prioridad: polideportivo_nombre (del JOIN) > nombre_polideportivo > polideportivo
    return reserva.polideportivo_nombre || 
           reserva.nombre_polideportivo || 
           reserva.polideportivo || 
           'No especificado';
  };

  // Función para obtener el nombre de la pista
  const obtenerPista = () => {
    return reserva.pistaNombre || 
           reserva.nombre_pista || 
           reserva.pista || 
           'No especificado';
  };

  // Componente con TODO el contenido
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
              {reserva.nombre_usuario || 'Desconocido'}
            </Text>
          </View>

          <View style={[styles.datoContainer, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Número de Reserva</Text>
            <Text style={[styles.datoValor, isSmallScreen && styles.datoValorSmall]}>
              #{reserva.id || 'Pendiente'}
            </Text>
          </View>

          {/* Información del Polideportivo - SIEMPRE VISIBLE */}
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

          <View style={[styles.datoContainer, styles.datoPrecio, isSmallScreen && styles.datoContainerSmall]}>
            <Text style={[styles.datoLabel, isSmallScreen && styles.datoLabelSmall]}>Precio Total</Text>
            <Text style={[styles.precio, isSmallScreen && styles.precioSmall]}>
              {reserva.precio || 0} €
            </Text>
          </View>
        </View>
      </View>

      {/* Sección de confirmación */}
      {!estaConfirmada && (
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
                    Procesar pago
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
    </View>
  );

  // Item vacío para el FlatList
  const renderEmptyItem = () => null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        data={[{}]} // Array con un elemento vacío
        keyExtractor={(item, index) => index.toString()}
        
        // Todo el contenido como header
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
                  {reserva.precio || 0} €
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
                      Pagar {reserva.precio || 0} €
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

// Los estilos se mantienen exactamente igual que en tu código original
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
  precio: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  precioSmall: {
    fontSize: 20,
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
  // Estilos para el modal (web)
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
    backgroundColor: '#fd0000ff',
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