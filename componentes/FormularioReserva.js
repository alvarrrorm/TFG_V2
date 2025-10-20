import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  FlatList,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Checkbox } from 'react-native-paper';
import { UserContext } from '../contexto/UserContex';
import CalendarioWeb from './CalendarioWeb';
import PrecioEstimado from './PrecioEstimado';

export default function FormularioReserva({ navigation }) {
  const { usuario, dni } = useContext(UserContext);
  const nombre = usuario || '';

  const [polideportivos, setPolideportivos] = useState([]);
  const [loadingPolideportivos, setLoadingPolideportivos] = useState(true);
  const [pistas, setPistas] = useState([]);
  const [loadingPistas, setLoadingPistas] = useState(true);
  const [reservasExistentes, setReservasExistentes] = useState([]);
  const [misReservasPendientes, setMisReservasPendientes] = useState([]);
  const [form, setForm] = useState({
    polideportivo: '',
    pista: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    ludoteca: false,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorPistas, setErrorPistas] = useState('');
  const [reservaCreada, setReservaCreada] = useState(null);
  const [validandoDisponibilidad, setValidandoDisponibilidad] = useState(false);
  const [errores, setErrores] = useState({});

  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  const horasDisponibles = Array.from({ length: 15 }, (_, i) => {
    const h = 8 + i;
    return `${h.toString().padStart(2, '0')}:00`;
  });

  const hoy = new Date().toISOString().split("T")[0];
  const esHoy = form.fecha === hoy;
  const horaActual = new Date().getHours();
  const horasFiltradas = esHoy
    ? horasDisponibles.filter(h => parseInt(h.split(":")[0], 10) > horaActual)
    : horasDisponibles;

  // Obtener polideportivo seleccionado
  const polideportivoSeleccionado = form.polideportivo 
    ? polideportivos.find(p => p.id.toString() === form.polideportivo)
    : null;

  // --- Cargar polideportivos ---
  useEffect(() => {
    const fetchPolideportivos = async () => {
      setLoadingPolideportivos(true);
      try {
        const res = await fetch('http://localhost:3001/polideportivos');
        const data = await res.json();
        if (data.success) setPolideportivos(data.data);
      } catch (error) {
        console.error('Error cargando polideportivos:', error);
        setErrores(prev => ({ ...prev, general: 'No se pudieron cargar los polideportivos' }));
      } finally {
        setLoadingPolideportivos(false);
      }
    };
    fetchPolideportivos();
  }, []);

  // --- Cargar TODAS las pistas al inicio ---
  useEffect(() => {
    const fetchTodasLasPistas = async () => {
      setLoadingPistas(true);
      try {
        const res = await fetch('http://localhost:3001/pistas/disponibles');
        const response = await res.json();

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error('Formato de datos inválido');
        }

        setPistas(response.data);
      } catch (error) {
        console.error('Error fetching pistas:', error);
        setErrores(prev => ({ ...prev, general: 'No se pudieron cargar las pistas' }));
        setPistas([]);
      } finally {
        setLoadingPistas(false);
      }
    };
    fetchTodasLasPistas();
  }, []);

  // --- Cargar mis reservas pendientes ---
  useEffect(() => {
    const fetchMisReservas = async () => {
      if (!dni) return;
      
      try {
        const res = await fetch(`http://localhost:3001/reservas?nombre_usuario=${encodeURIComponent(nombre)}`);
        const data = await res.json();
        
        if (data.success) {
          const reservasPendientes = data.data.filter(reserva => reserva.estado === 'pendiente');
          setMisReservasPendientes(reservasPendientes || []);
        }
      } catch (error) {
        console.error('Error cargando mis reservas:', error);
      }
    };
    fetchMisReservas();
  }, [dni, nombre]);

  // --- Cargar reservas existentes cuando se selecciona fecha y pista ---
  useEffect(() => {
    const fetchReservasExistentes = async () => {
      if (!form.fecha || !form.polideportivo) {
        setReservasExistentes([]);
        return;
      }

      setValidandoDisponibilidad(true);
      try {
        const res = await fetch(
          `http://localhost:3001/reservas/disponibilidad?fecha=${form.fecha}&polideportivo=${form.polideportivo}`
        );
        const data = await res.json();
        
        if (data.success) {
          setReservasExistentes(data.data || []);
        }
      } catch (error) {
        console.error('Error cargando reservas existentes:', error);
        setReservasExistentes([]);
      } finally {
        setValidandoDisponibilidad(false);
      }
    };

    // Debounce para no hacer muchas llamadas
    const timeoutId = setTimeout(fetchReservasExistentes, 500);
    return () => clearTimeout(timeoutId);
  }, [form.fecha, form.polideportivo]);

  // --- Filtrar pistas localmente cuando cambia el polideportivo ---
  const pistasFiltradas = form.polideportivo 
    ? pistas.filter(pista => pista.polideportivo_id && pista.polideportivo_id.toString() === form.polideportivo)
    : [];

  // --- Validaciones en tiempo real ---
  useEffect(() => {
    const nuevosErrores = {};

    // Validar campos obligatorios
    if (!form.polideportivo) nuevosErrores.polideportivo = 'Selecciona un polideportivo';
    if (!form.pista) nuevosErrores.pista = 'Selecciona una pista';
    if (!form.fecha) nuevosErrores.fecha = 'Selecciona una fecha';
    if (!form.horaInicio) nuevosErrores.horaInicio = 'Selecciona hora de inicio';
    if (!form.horaFin) nuevosErrores.horaFin = 'Selecciona hora de fin';

    // Validar fecha
    if (form.fecha && form.fecha < hoy) {
      nuevosErrores.fecha = 'No puedes reservar en fechas pasadas';
    }

    // Validar horas
    if (form.horaInicio && form.horaFin && form.horaFin <= form.horaInicio) {
      nuevosErrores.horaFin = 'La hora de fin debe ser mayor que la de inicio';
    }

    if (form.fecha === hoy && form.horaInicio && parseInt(form.horaInicio.split(":")[0], 10) <= horaActual) {
      nuevosErrores.horaInicio = 'La hora seleccionada ya pasó';
    }

    // Validar disponibilidad de pista
    if (form.pista && form.fecha && form.horaInicio && form.horaFin) {
      const reservasEnPista = reservasExistentes.filter(
        reserva => reserva.pista_id.toString() === form.pista
      );

      const hayConflicto = reservasEnPista.some(reserva => {
        const reservaInicio = parseInt(reserva.hora_inicio.split(':')[0]);
        const reservaFin = parseInt(reserva.hora_fin.split(':')[0]);
        const nuevaInicio = parseInt(form.horaInicio.split(':')[0]);
        const nuevaFin = parseInt(form.horaFin.split(':')[0]);

        // Verificar si hay solapamiento
        return (nuevaInicio < reservaFin && nuevaFin > reservaInicio);
      });

      if (hayConflicto) {
        nuevosErrores.disponibilidad = 'La pista ya está reservada en este horario. Elige otro horario.';
      }
    }

    setErrores(nuevosErrores);
  }, [form, reservasExistentes, hoy, horaActual]);

  const formatoFechaLegible = fechaISO => {
    if (!fechaISO) return 'Selecciona una fecha';
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fechaISO).toLocaleDateString('es-ES', opciones);
  };

  const calcularPrecio = () => {
    if (!form.pista || !form.horaInicio || !form.horaFin) return 0;
    const pista = pistas.find(p => p.id.toString() === form.pista);
    if (!pista || !pista.precio) return 0;
    const hi = parseInt(form.horaInicio.split(':')[0], 10);
    const hf = parseInt(form.horaFin.split(':')[0], 10);
    const duracion = hf - hi;
    if (duracion <= 0) return 0;

    let total = pista.precio * duracion;
    if (form.ludoteca) total += 5;
    return total;
  };

  const precioTotal = calcularPrecio();
  const pistaSeleccionada = pistas.find(p => p.id.toString() === form.pista);
  const duracion = form.horaInicio && form.horaFin
    ? parseInt(form.horaFin.split(':')[0], 10) - parseInt(form.horaInicio.split(':')[0], 10)
    : 0;

  const handleSubmit = async () => {
    // Validar que no hay errores
    if (Object.keys(errores).length > 0) {
      Alert.alert('Error', 'Por favor, corrige los errores antes de continuar');
      return;
    }

    // Validar que el usuario no tenga ya una reserva pendiente
    if (misReservasPendientes.length > 0) {
      Alert.alert(
        'Reserva pendiente', 
        'Ya tienes una reserva pendiente. No puedes hacer más reservas hasta que completes o canceles la actual.'
      );
      return;
    }

    setLoading(true);
    try {
      const reservaData = {
        dni_usuario: dni,
        nombre_usuario: nombre || 'Usuario',
        pista_id: parseInt(form.pista),
        fecha: form.fecha,
        hora_inicio: form.horaInicio,
        hora_fin: form.horaFin,
        ludoteca: form.ludoteca,
        estado: 'pendiente'
        // El polideportivo_id se obtiene automáticamente en el backend
        // a partir de la pista seleccionada
      };

      console.log('Enviando datos de reserva:', reservaData);

      const res = await fetch('http://localhost:3001/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservaData),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear la reserva');
      }

      if (!data.success) {
        throw new Error(data.error || 'Error al crear la reserva');
      }

      console.log('Reserva creada exitosamente:', data.data);

      // Usar directamente los datos que devuelve el backend
      // que ya incluyen polideportivo_nombre, pistaNombre, etc.
      const reservaCreada = data.data;

      // Navegar al resumen con todos los datos completos
      navigation.navigate('ResumenReserva', { reserva: reservaCreada });
      
    } catch (error) {
      console.error('Error creando reserva:', error);
      Alert.alert('Error', error.message || 'Ocurrió un error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  // Componente con TODO el contenido del formulario
  const FormContent = () => (
    <View style={styles.content}>
      <Text style={styles.headerTitle}>Nueva Reserva</Text>
      <Text style={styles.headerSubtitle}>Completa los datos para realizar tu reserva</Text>

      {/* Error general */}
      {errores.general && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {errores.general}</Text>
        </View>
      )}

      {/* Alerta si el usuario ya tiene reserva pendiente */}
      {misReservasPendientes.length > 0 && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertText}>
            ⚠️ Ya tienes una reserva pendiente. No puedes hacer más reservas hasta que completes o canceles la actual.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>
        <View style={styles.userContainer}>
          <Text style={styles.userText}>{nombre || 'No identificado'}</Text>
        </View>

        <Text style={styles.label}>Selecciona el polideportivo</Text>
        <View style={styles.pickerWrapper}>
          {loadingPolideportivos ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : (
            <Picker
              selectedValue={form.polideportivo}
              onValueChange={value => setForm({ 
                ...form, 
                polideportivo: value, 
                pista: '', 
                fecha: '', 
                horaInicio: '', 
                horaFin: '' 
              })}
              style={styles.picker}
              dropdownIconColor="#1976D2"
            >
              <Picker.Item label="Selecciona un polideportivo" value="" />
              {polideportivos.map(p => (
                <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />
              ))}
            </Picker>
          )}
        </View>
        {errores.polideportivo && <Text style={styles.fieldError}>{errores.polideportivo}</Text>}

        {/* Información del polideportivo seleccionado */}
        {polideportivoSeleccionado && (
          <View style={styles.infoPolideportivo}>
            <Text style={styles.infoPolideportivoText}>
              📍 {polideportivoSeleccionado.nombre}
              {polideportivoSeleccionado.direccion && ` - ${polideportivoSeleccionado.direccion}`}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Selecciona la pista</Text>
        <View style={styles.pickerWrapper}>
          {loadingPistas ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : !form.polideportivo ? (
            <Picker enabled={false} style={styles.picker}>
              <Picker.Item label="Primero selecciona un polideportivo" value="" />
            </Picker>
          ) : pistasFiltradas.length === 0 ? (
            <Picker enabled={false} style={styles.picker}>
              <Picker.Item label="No hay pistas disponibles en este polideportivo" value="" />
            </Picker>
          ) : (
            <Picker
              selectedValue={form.pista}
              onValueChange={value => setForm({ ...form, pista: value })}
              style={styles.picker}
              dropdownIconColor="#1976D2"
            >
              <Picker.Item label="Selecciona una pista" value="" />
              {pistasFiltradas.map(pista => (
                <Picker.Item
                  key={pista.id}
                  label={`${pista.tipo} - ${pista.nombre} (€${pista.precio}/hora)`}
                  value={pista.id.toString()}
                />
              ))}
            </Picker>
          )}
        </View>
        {errores.pista && <Text style={styles.fieldError}>{errores.pista}</Text>}

        <Text style={styles.label}>Fecha de la reserva</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.calendarContainer}>
            <CalendarioWeb
              selectedDate={form.fecha}
              onChangeDate={fechaISO => {
                setForm({ ...form, fecha: fechaISO, horaInicio: '', horaFin: '' });
              }}
            />
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.datePickerButton, errores.fecha && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.datePickerText, !form.fecha && { color: '#888' }]}>
                {form.fecha ? formatoFechaLegible(form.fecha) : 'Selecciona una fecha'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={form.fecha ? new Date(form.fecha) : new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                locale="es"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const fechaISO = selectedDate.toISOString().split('T')[0];
                    setForm({ ...form, fecha: fechaISO, horaInicio: '', horaFin: '' });
                  }
                }}
              />
            )}
          </>
        )}
        {errores.fecha && <Text style={styles.fieldError}>{errores.fecha}</Text>}

        <View style={[styles.pickerRow, isMobile && styles.pickerColumn]}>
          <View style={[styles.timePickerWrapper, isMobile && styles.fullWidth]}>
            <Text style={styles.pickerLabel}>Hora inicio</Text>
            <Picker
              selectedValue={form.horaInicio}
              onValueChange={value => setForm({ ...form, horaInicio: value, horaFin: '' })}
              style={styles.picker}
              dropdownIconColor="#1976D2"
            >
              <Picker.Item label="Selecciona hora" value="" />
              {horasFiltradas.map(hora => (
                <Picker.Item key={hora} label={hora} value={hora} />
              ))}
            </Picker>
          </View>
          
          <View style={[styles.timePickerWrapper, isMobile && styles.fullWidth]}>
            <Text style={styles.pickerLabel}>Hora fin</Text>
            <Picker
              selectedValue={form.horaFin}
              onValueChange={value => setForm({ ...form, horaFin: value })}
              style={styles.picker}
              dropdownIconColor="#1976D2"
            >
              <Picker.Item label="Selecciona hora" value="" />
              {horasFiltradas
                .filter(h => !form.horaInicio || h > form.horaInicio)
                .map(hora => (
                <Picker.Item key={hora} label={hora} value={hora} />
              ))}
            </Picker>
          </View>
        </View>
        {(errores.horaInicio || errores.horaFin) && (
          <Text style={styles.fieldError}>{errores.horaInicio || errores.horaFin}</Text>
        )}

        {/* Error de disponibilidad */}
        {errores.disponibilidad && (
          <View style={styles.alertContainer}>
            <Text style={styles.alertText}>⚠️ {errores.disponibilidad}</Text>
          </View>
        )}

        {/* Indicador de validación de disponibilidad */}
        {validandoDisponibilidad && (
          <View style={styles.validandoContainer}>
            <ActivityIndicator size="small" color="#1976D2" />
            <Text style={styles.validandoText}>Verificando disponibilidad...</Text>
          </View>
        )}

        <View style={styles.checkboxContainer}>
          <Checkbox
            status={form.ludoteca ? 'checked' : 'unchecked'}
            onPress={() => setForm({ ...form, ludoteca: !form.ludoteca })}
            color="#1976D2"
          />
          <Text style={styles.checkboxLabel}>Incluir servicio de ludoteca (+5€)</Text>
        </View>

        {precioTotal > 0 && (
          <View style={styles.precioSection}>
            <PrecioEstimado
              precio={precioTotal}
              duracion={duracion}
              precioHora={pistaSeleccionada?.precio || 0}
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.boton, 
            (loading || Object.keys(errores).length > 0 || misReservasPendientes.length > 0) && styles.botonDisabled
          ]}
          onPress={handleSubmit}
          disabled={loading || Object.keys(errores).length > 0 || misReservasPendientes.length > 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : misReservasPendientes.length > 0 ? (
            <Text style={styles.botonTexto}>Reserva Pendiente</Text>
          ) : (
            <Text style={styles.botonTexto}>Reservar</Text>
          )}
        </TouchableOpacity>
      </View>
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
        
        // Todo el contenido del formulario como header
        ListHeaderComponent={<FormContent />}
        
        renderItem={renderEmptyItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 20,
    paddingTop: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  alertContainer: {
    backgroundColor: '#FEF3CD',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  alertText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
  },
  validandoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginBottom: 15,
  },
  validandoText: {
    marginLeft: 10,
    color: '#1976D2',
    fontSize: 14,
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: -15,
    marginBottom: 15,
    marginLeft: 10,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  userContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  timePickerWrapper: {
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    flex: 1,
    marginHorizontal: 5,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  fullWidth: {
    marginHorizontal: 0,
  },
  pickerLabel: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#1976D2',
    marginLeft: 10,
    marginTop: 5,
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 10,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
  },
  datePickerButton: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderColor: '#1976D2',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  datePickerText: {
    fontSize: 16,
    color: '#1976D2',
  },
  calendarContainer: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  precioSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  boton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  botonTexto: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  botonDisabled: {
    backgroundColor: '#90caf9',
  },
  infoPolideportivo: {
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
  },
  infoPolideportivoText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '500',
  },
});