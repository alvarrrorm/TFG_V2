import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  Modal,
  TextInput
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

  useEffect(() => {
    console.log('Datos recibidos en ResumenReserva:', reserva);
  }, [reserva]);

  if (!reserva) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.errorTexto}>No se han recibido datos de la reserva.</Text>
      </View>
    );
  }

  const manejarPago = async () => {
    if (Platform.OS === 'web') {
      // Mostrar modal con formulario de pago en web
      setModalVisible(true);
    } else {
      // Proceso simplificado para móvil
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
      console.log('Enviando pago para reserva ID:', reserva.id);
      
      const response = await fetch(`http://localhost:3001/reservas/${reserva.id}/pagar`, {
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
      console.log('Pago exitoso:', data);

      const reservaActualizada = {
        ...reserva,
        estado: 'pagado',
        ...data.data
      };

      const mensajeExito = `Pago de ${reserva.precio} € procesado correctamente.\nReserva #${reserva.id}`;

      if (Platform.OS === 'web') {
        alert(mensajeExito);
        navigation.navigate('Reservas', { reserva: reservaActualizada });
      } else {
        Alert.alert(
          'Pago exitoso',
          mensajeExito,
          [{ text: 'OK', onPress: () => navigation.navigate('Reservas', { reserva: reservaActualizada }) }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error en el pago', 
        error.message || 'No se pudo completar el pago. Por favor intente nuevamente.'
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Resumen de la Reserva</Text>

      <View style={styles.seccion}>
        <Text style={styles.subtitulo}>Detalles de la Reserva</Text>
        
        <View style={styles.dato}>
          <Text style={styles.label}>Usuario:</Text>
          <Text style={styles.valor}>{reserva.nombre_usuario || 'Desconocido'}</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Numero de Reserva:</Text>
          <Text style={styles.valor}>{reserva.id || 'No especificado'}</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Pista:</Text>
          <Text style={styles.valor}>{reserva.nombre_pista || reserva.pista || 'No especificado'}</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.valor}>{formatoFechaLegible(reserva.fecha)}</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Horario:</Text>
          <Text style={styles.valor}>{reserva.hora_inicio} - {reserva.hora_fin}</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Precio Total:</Text>
          <Text style={styles.precio}>{reserva.precio} €</Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.label}>Estado:</Text>
          <Text style={[styles.valor, reserva.estado === 'pagado' ? styles.estadoPagado : styles.estadoPendiente]}>
            {reserva.estado || 'Pendiente'}
          </Text>
        </View>
      </View>

      {reserva.estado !== 'pagado' && (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Procesar Pago</Text>
          
          <Text style={styles.infoPago}>
            Puedes pagar ahora o más tarde. Tu reserva seguirá activa.
          </Text>
          
          <TouchableOpacity 
            style={styles.botonPagar} 
            onPress={manejarPago}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Pagar Ahora</Text>}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.botonPagar, styles.botonMasTarde]} 
            onPress={() => {
              setModalVisible(false);
              navigation.navigate('Reservas', { reserva });
            }}
            disabled={loading}
          >
            <Text style={styles.botonTexto}>Pagar Más Tarde</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de pago en web */}
      {Platform.OS === 'web' && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitulo}>Datos de Pago</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Nombre en la tarjeta"
                value={datosPago.nombre}
                onChangeText={(text) => setDatosPago({...datosPago, nombre: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Número de tarjeta"
                value={formatoTarjeta(datosPago.tarjeta)}
                onChangeText={(text) => setDatosPago({...datosPago, tarjeta: text.replace(/\D/g, '')})}
                keyboardType="numeric"
                maxLength={19}
              />
              
              <View style={styles.filaInputs}>
                <TextInput
                  style={[styles.input, styles.inputMedio]}
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
                
                <TextInput
                  style={[styles.input, styles.inputMedio]}
                  placeholder="CVV"
                  value={datosPago.cvv}
                  onChangeText={(text) => setDatosPago({...datosPago, cvv: text.replace(/\D/g, '').slice(0, 4)})}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              
              <View style={styles.botonesModal}>
                <TouchableOpacity 
                  style={[styles.botonModal, styles.botonCancelar]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.textoBotonModal}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.botonModal, styles.botonConfirmar, !validarFormulario() && styles.botonDisabled]}
                  onPress={procesarPago}
                  disabled={!validarFormulario() || loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBotonModal}>Confirmar Pago</Text>}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.botonModal, styles.botonMasTarde]}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('Reservas', { reserva });
                }}
              >
                <Text style={styles.textoBotonModal}>Pagar Más Tarde</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: '#2C3E50',
    textAlign: 'center',
  },
  seccion: {
    marginBottom: 25,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#34495E',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
    paddingBottom: 8,
  },
  dato: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    width: 120,
    color: '#7F8C8D',
    fontSize: 15,
  },
  valor: {
    flex: 1,
    color: '#2C3E50',
    fontSize: 15,
  },
  precio: {
    flex: 1,
    color: '#27AE60',
    fontSize: 16,
    fontWeight: '700',
  },
  estadoPagado: {
    color: '#27AE60',
    fontWeight: '600',
  },
  estadoPendiente: {
    color: '#F39C12',
    fontWeight: '600',
  },
  infoPago: {
    color: '#7F8C8D',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  botonPagar: {
    backgroundColor: '#2ECC71',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  botonMasTarde: {
    backgroundColor: '#3498DB',
    marginTop: 10,
  },
  botonTexto: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTexto: {
    color: '#E74C3C',
    fontSize: 18,
    textAlign: 'center',
  },
  // Estilos para el modal (web)
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 500,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#FFF',
  },
  filaInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputMedio: {
    width: '48%',
  },
  botonesModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  botonModal: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  botonCancelar: {
    backgroundColor: '#E0E0E0',
  },
  botonConfirmar: {
    backgroundColor: '#2ECC71',
  },
  botonMasTardeModal: {
    backgroundColor: '#3498DB',
    marginTop: 15,
    alignSelf: 'center',
    width: '100%',
  },
  botonDisabled: {
    backgroundColor: '#A9DFBF',
    opacity: 0.7,
  },
  textoBotonModal: {
    color: '#FFF',
    fontWeight: '600',
  },
});
