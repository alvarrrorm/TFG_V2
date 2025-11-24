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
  Dimensions,
  Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Checkbox } from 'react-native-paper';
import { UserContext } from '../contexto/UserContex';
import CalendarioWeb from './CalendarioWeb';
import { useRoute } from '@react-navigation/native';

export default function FormularioReserva({ navigation }) {
  const { usuario, dni } = useContext(UserContext);
  const nombre = usuario || '';

  const route = useRoute();
  const reservaParaEditar = route.params?.reserva && Object.keys(route.params.reserva).length > 0 ? route.params.reserva : null;

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
  const [validandoDisponibilidad, setValidandoDisponibilidad] = useState(false);
  const [errores, setErrores] = useState({});
  const [precioCalculado, setPrecioCalculado] = useState(0);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

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

  const polideportivoSeleccionado = form.polideportivo 
    ? polideportivos.find(p => p.id.toString() === form.polideportivo)
    : null;

  // 👇 FUNCIÓN PARA FORMATEAR FECHA SI VIENE EN FORMATO ISO
  const formatearFechaDesdeBackend = (fechaInput) => {
    if (!fechaInput) return '';
    
    // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
    if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
      return fechaInput;
    }
    
    // Si es un string ISO, extraer solo la parte de la fecha
    if (typeof fechaInput === 'string' && fechaInput.includes('T')) {
      try {
        return fechaInput.split('T')[0];
      } catch (error) {
        console.error('Error formateando fecha desde backend:', error);
        return '';
      }
    }
    
    return fechaInput || '';
  };

  // 👇 FUNCIÓN MEJORADA PARA CALCULAR PRECIO
  const calcularPrecio = () => {
    // En modo edición, si no hay cambios, mantener el precio original
    if (reservaParaEditar) {
      const huboCambios = form.pista !== reservaParaEditar.pista_id?.toString() ||
                         form.horaInicio !== reservaParaEditar.hora_inicio ||
                         form.horaFin !== reservaParaEditar.hora_fin ||
                         form.ludoteca !== reservaParaEditar.ludoteca;
      
      if (!huboCambios && reservaParaEditar.precio) {
        return parseFloat(reservaParaEditar.precio);
      }
    }
    
    // Para nueva reserva o si hay cambios, calcular nuevo precio
    if (!form.pista || !form.horaInicio || !form.horaFin) {
      return reservaParaEditar?.precio ? parseFloat(reservaParaEditar.precio) : 0;
    }
    
    const pista = pistas.find(p => p.id.toString() === form.pista);
    if (!pista || !pista.precio) {
      return 0;
    }
    
    const hi = parseInt(form.horaInicio.split(':')[0], 10);
    const hf = parseInt(form.horaFin.split(':')[0], 10);
    const duracion = hf - hi;
    
    if (duracion <= 0) {
      return 0;
    }

    let total = parseFloat(pista.precio) * duracion;
    if (form.ludoteca) total += 5;
    
    return parseFloat(total.toFixed(2));
  };

  // 👇 RECALCULAR PRECIO AUTOMÁTICAMENTE
  useEffect(() => {
    const nuevoPrecio = calcularPrecio();
    setPrecioCalculado(nuevoPrecio);
  }, [form.pista, form.horaInicio, form.horaFin, form.ludoteca, reservaParaEditar]);

  const obtenerHorasOcupadas = () => {
    const set = new Set();
    reservasExistentes
      .filter(r => r.pista_id && r.pista_id.toString() === form.pista)
      .filter(r => !reservaParaEditar || r.id !== reservaParaEditar.id)
      .forEach(r => {
        const hi = parseInt(r.hora_inicio.split(':')[0]);
        const hf = parseInt(r.hora_fin.split(':')[0]);
        for(let h = hi; h < hf; h++){
          set.add(`${h.toString().padStart(2,'0')}:00`);
        }
      });
    return set;
  };

  const getHorasInicioDisponibles = () => {
    if (!form.pista || !form.fecha) {
      return horasFiltradas;
    }

    const horasOcupadas = obtenerHorasOcupadas();
    
    return horasFiltradas.filter(horaInicio => {
      if (horasOcupadas.has(horaInicio)) {
        return false;
      }
      
      const horaInicioNum = parseInt(horaInicio.split(':')[0], 10);
      const hayHorasFinDisponibles = horasFiltradas.some(horaFin => {
        const horaFinNum = parseInt(horaFin.split(':')[0], 10);
        if (horaFinNum <= horaInicioNum) return false;
        
        for (let h = horaInicioNum; h < horaFinNum; h++) {
          const horaIntermedia = `${h.toString().padStart(2, '0')}:00`;
          if (horasOcupadas.has(horaIntermedia)) {
            return false;
          }
        }
        return true;
      });
      
      return hayHorasFinDisponibles;
    });
  };

  const getHorasFinDisponibles = () => {
    if (!form.pista || !form.fecha || !form.horaInicio) {
      return [];
    }

    const horaInicioNum = parseInt(form.horaInicio.split(':')[0], 10);
    const horasOcupadas = obtenerHorasOcupadas();

    return horasFiltradas.filter(horaFin => {
      const horaFinNum = parseInt(horaFin.split(':')[0], 10);
      if (horaFinNum <= horaInicioNum) return false;

      for (let h = horaInicioNum; h < horaFinNum; h++) {
        const horaStr = `${h.toString().padStart(2, '0')}:00`;
        if (horasOcupadas.has(horaStr)) {
          return false;
        }
      }
      return true;
    });
  };

  const horasInicioDisponibles = getHorasInicioDisponibles();
  const horasFinDisponibles = getHorasFinDisponibles();

  const mostrarAlerta = (titulo, mensaje) => {
    if (Platform.OS === 'web') {
      setModalTitle(titulo);
      setModalMessage(mensaje);
      setModalVisible(true);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  useEffect(() => {
    const fetchPolideportivos = async () => {
      setLoadingPolideportivos(true);
      try {
        const res = await fetch('https://tfgv2-production.up.railway.app/polideportivos');
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

  useEffect(() => {
    const fetchTodasLasPistas = async () => {
      setLoadingPistas(true);
      try {
        const res = await fetch('https://tfgv2-production.up.railway.app/pistas/disponibles');
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

  useEffect(() => {
    const fetchMisReservas = async () => {
      if (!dni) return;
      
      try {
        const res = await fetch(`https://tfgv2-production.up.railway.app/reservas?nombre_usuario=${encodeURIComponent(nombre)}`);
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

  useEffect(() => {
    const fetchReservasExistentes = async () => {
      if (!form.fecha || !form.polideportivo) {
        setReservasExistentes([]);
        return;
      }

      setValidandoDisponibilidad(true);
      try {
        const res = await fetch(
          `https://tfgv2-production.up.railway.app/reservas/disponibilidad?fecha=${form.fecha}&polideportivo=${form.polideportivo}`
        );
        const data = await res.json();
        
        if (data.success) {
          const reservasActivas = data.data.filter(reserva => 
            reserva.estado !== 'cancelada'
          );
          setReservasExistentes(reservasActivas || []);
        } else {
          console.error('Error en respuesta del servidor:', data.error);
          setReservasExistentes([]);
        }
      } catch (error) {
        console.error('Error cargando reservas existentes:', error);
        setReservasExistentes([]);
      } finally {
        setValidandoDisponibilidad(false);
      }
    };

    const timeoutId = setTimeout(fetchReservasExistentes, 500);
    return () => clearTimeout(timeoutId);
  }, [form.fecha, form.polideportivo]);

  const pistasFiltradas = form.polideportivo 
    ? pistas.filter(pista => pista.polideportivo_id && pista.polideportivo_id.toString() === form.polideportivo)
    : [];

  // 👇 MANEJADORES DE CAMBIO
  const handlePolideportivoChange = (value) => {
    setForm({ 
      ...form, 
      polideportivo: value, 
      pista: '', 
      fecha: '', 
      horaInicio: '', 
      horaFin: '' 
    });
  };

  const handlePistaChange = (value) => {
    setForm({ 
      ...form, 
      pista: value, 
      horaInicio: '', 
      horaFin: '' 
    });
  };

  const handleFechaChange = (fechaISO) => {
    setForm({ 
      ...form, 
      fecha: fechaISO, 
      horaInicio: '', 
      horaFin: '' 
    });
  };

  const handleHoraInicioChange = (value) => {
    setForm({ 
      ...form, 
      horaInicio: value, 
      horaFin: '' 
    });
  };

  const handleHoraFinChange = (value) => {
    setForm({ 
      ...form, 
      horaFin: value 
    });
  };

  const handleLudotecaChange = () => {
    setForm({ 
      ...form, 
      ludoteca: !form.ludoteca 
    });
  };

  // 👇 INICIALIZACIÓN CORREGIDA PARA EDICIÓN
  useEffect(() => {
    if (reservaParaEditar) {
      console.log('🔧 MODO EDICIÓN - Cargando reserva:', reservaParaEditar);
      
      const pistaReserva = pistas.find(p => p.id === reservaParaEditar.pista_id);
      const polideportivoId = pistaReserva?.polideportivo_id?.toString();

      // 👇 FORMATEAR FECHA SI VIENE EN FORMATO ISO
      const fechaFormateada = formatearFechaDesdeBackend(reservaParaEditar.fecha);

      setForm({
        polideportivo: polideportivoId || '',
        pista: reservaParaEditar.pista_id?.toString() || '',
        fecha: fechaFormateada,
        horaInicio: reservaParaEditar.hora_inicio || '',
        horaFin: reservaParaEditar.hora_fin || '',
        ludoteca: reservaParaEditar.ludoteca || false,
      });

      // 👇 INICIALIZAR PRECIO CON EL VALOR EXISTENTE
      if (reservaParaEditar.precio) {
        setPrecioCalculado(parseFloat(reservaParaEditar.precio));
      }
    } else {
      console.log('🆕 MODO CREACIÓN - Formulario vacío');
      // Para nueva reserva, mantener el formulario vacío
    }
  }, [reservaParaEditar, pistas]);

  useEffect(() => {
    const nuevosErrores = {};

    if (!form.polideportivo) nuevosErrores.polideportivo = 'Selecciona un polideportivo';
    if (!form.pista) nuevosErrores.pista = 'Selecciona una pista';
    if (!form.fecha) nuevosErrores.fecha = 'Selecciona una fecha';
    if (!form.horaInicio) nuevosErrores.horaInicio = 'Selecciona hora de inicio';
    if (!form.horaFin) nuevosErrores.horaFin = 'Selecciona hora de fin';

    if (form.fecha && form.fecha < hoy) {
      nuevosErrores.fecha = 'No puedes reservar en fechas pasadas';
    }

    if (form.horaInicio && form.horaFin && form.horaFin <= form.horaInicio) {
      nuevosErrores.horaFin = 'La hora de fin debe ser mayor que la de inicio';
    }

    if (form.fecha === hoy && form.horaInicio && parseInt(form.horaInicio.split(":")[0], 10) <= horaActual) {
      nuevosErrores.horaInicio = 'La hora seleccionada ya pasó';
    }

    if (form.pista && form.fecha && form.horaInicio && form.horaFin) {
      const horasOcupadas = obtenerHorasOcupadas();
      const horaInicioNum = parseInt(form.horaInicio.split(':')[0], 10);
      const horaFinNum = parseInt(form.horaFin.split(':')[0], 10);
      
      let hayConflicto = false;
      for (let h = horaInicioNum; h < horaFinNum; h++) {
        const horaStr = `${h.toString().padStart(2, '0')}:00`;
        if (horasOcupadas.has(horaStr)) {
          hayConflicto = true;
          break;
        }
      }

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

  // 👇 FUNCIÓN CORREGIDA PARA CREAR/ACTUALIZAR RESERVA
  const handleSubmit = async () => {
    console.log('📤 Enviando reserva...');
    console.log('Modo:', reservaParaEditar ? 'EDICIÓN' : 'CREACIÓN');
    console.log('Precio calculado:', precioCalculado);

    if (Object.keys(errores).length > 0) {
      mostrarAlerta('Error', 'Por favor, corrige los errores antes de continuar');
      return;
    }

    // Validar que no haya reservas pendientes en modo creación
    if (!reservaParaEditar && misReservasPendientes.length > 0) {
      mostrarAlerta(
        'Reserva pendiente', 
        'Ya tienes una reserva pendiente. No puedes hacer más reservas hasta que completes o canceles la actual.'
      );
      return;
    }

    setLoading(true);
    try {
      // 👇 DETERMINAR PRECIO FINAL CORRECTAMENTE
      let precioFinal = precioCalculado;
      
      // En modo edición, si no hay cambios, mantener precio original
      if (reservaParaEditar) {
        const huboCambios = form.pista !== reservaParaEditar.pista_id?.toString() ||
                           form.horaInicio !== reservaParaEditar.hora_inicio ||
                           form.horaFin !== reservaParaEditar.hora_fin ||
                           form.ludoteca !== reservaParaEditar.ludoteca;
        
        if (!huboCambios && reservaParaEditar.precio) {
          precioFinal = parseFloat(reservaParaEditar.precio);
        }
      }

      const reservaData = {
        dni_usuario: dni,
        nombre_usuario: nombre || 'Usuario',
        pista_id: parseInt(form.pista),
        fecha: form.fecha, // ← Ya formateada correctamente
        hora_inicio: form.horaInicio,
        hora_fin: form.horaFin,
        ludoteca: form.ludoteca,
        estado: 'pendiente',
        precio: precioFinal
      };

      console.log('Datos a enviar:', reservaData);

      let response;
      
      if (reservaParaEditar) {
        // 👇 MODO EDICIÓN
        console.log('🔄 Actualizando reserva existente ID:', reservaParaEditar.id);
        response = await fetch(`https://tfgv2-production.up.railway.app/reservas/${reservaParaEditar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reservaData),
        });
      } else {
        // 👇 MODO CREACIÓN
        console.log('🆕 Creando nueva reserva');
        response = await fetch('https://tfgv2-production.up.railway.app/reservas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reservaData),
        });
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Error al ${reservaParaEditar ? 'actualizar' : 'crear'} la reserva`);
      }

      if (!data.success) {
        throw new Error(data.error || `Error al ${reservaParaEditar ? 'actualizar' : 'crear'} la reserva`);
      }

      console.log('✅ Reserva procesada exitosamente:', data.data);

      const reservaProcesada = data.data;
      
      // Determinar si hubo cambio de precio para mostrar en el resumen
      const precioCambiado = reservaParaEditar && 
                            parseFloat(reservaParaEditar.precio) !== precioFinal;
      
      // Navegar al resumen
      navigation.navigate('ResumenReserva', { 
        reserva: reservaProcesada,
        mensaje: reservaParaEditar ? 'Reserva actualizada correctamente' : 'Reserva creada correctamente',
        precioActualizado: precioCambiado
      });
      
    } catch (error) {
      console.error('❌ Error procesando reserva:', error);
      mostrarAlerta('Error', error.message || `Ocurrió un error al ${reservaParaEditar ? 'actualizar' : 'crear'} la reserva`);
    } finally {
      setLoading(false);
    }
  };

  const ModalAlerta = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{modalTitle}</Text>
          <Text style={styles.modalMessage}>{modalMessage}</Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>Aceptar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // 👇 COMPONENTE PRECIO ESTIMADO MEJORADO
  const PrecioEstimadoComponent = () => {
    const pistaSeleccionada = pistas.find(p => p.id.toString() === form.pista);
    const duracion = form.horaInicio && form.horaFin
      ? parseInt(form.horaFin.split(':')[0], 10) - parseInt(form.horaInicio.split(':')[0], 10)
      : 0;
    
    // Determinar si estamos mostrando precio original o recalculado
    const esPrecioRecalculado = reservaParaEditar && 
                               (form.pista !== reservaParaEditar.pista_id?.toString() ||
                                form.horaInicio !== reservaParaEditar.hora_inicio ||
                                form.horaFin !== reservaParaEditar.hora_fin ||
                                form.ludoteca !== reservaParaEditar.ludoteca);
    
    return (
      <View style={styles.precioContainer}>
        <Text style={styles.precioTitulo}>
          {reservaParaEditar && !esPrecioRecalculado ? 'Precio Actual' : 'Precio Estimado'}
        </Text>
        
        {esPrecioRecalculado && reservaParaEditar && (
          <View style={styles.cambioContainer}>
            <Text style={styles.cambioTexto}>
              Precio anterior: {parseFloat(reservaParaEditar.precio).toFixed(2)} €
            </Text>
          </View>
        )}
        
        {pistaSeleccionada && duracion > 0 && (
          <View style={styles.desglose}>
            <Text style={styles.desgloseTexto}>
              {duracion}h × {pistaSeleccionada.precio}€/hora = {(duracion * pistaSeleccionada.precio).toFixed(2)}€
            </Text>
            {form.ludoteca && (
              <Text style={styles.desgloseTexto}>
                + Ludoteca: 5€
              </Text>
            )}
          </View>
        )}
        
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={[
            styles.totalPrecio,
            esPrecioRecalculado && styles.precioCambiado
          ]}>
            {precioCalculado.toFixed(2)} €
          </Text>
        </View>
        
        {esPrecioRecalculado && (
          <Text style={styles.notaCambio}>
            * El precio se ha recalculado debido a cambios en la reserva
          </Text>
        )}
      </View>
    );
  };

  const FormContent = () => (
    <View style={styles.content}>
      <Text style={styles.headerTitle}>
        {reservaParaEditar ? 'Modificar Reserva' : 'Nueva Reserva'}
      </Text>
      <Text style={styles.headerSubtitle}>
        {reservaParaEditar 
          ? 'Modifica los datos de tu reserva pendiente' 
          : 'Completa los datos para realizar tu reserva'
        }
      </Text>

      {errores.general && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {errores.general}</Text>
        </View>
      )}

      {/* 👇 ALERTA SOLO EN MODO CREACIÓN */}
      {!reservaParaEditar && misReservasPendientes.length > 0 && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertText}>
            ⚠️ Ya tienes una reserva pendiente. No puedes hacer más reservas hasta que completes o canceles la actual.
          </Text>
        </View>
      )}

      {/* 👇 INDICADOR SOLO EN MODO EDICIÓN */}
      {reservaParaEditar && (
        <View style={styles.editandoContainer}>
          <Text style={styles.editandoText}>
            📝 Estás modificando tu reserva pendiente
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
              onValueChange={handlePolideportivoChange}
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
              onValueChange={handlePistaChange}
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
              onChangeDate={handleFechaChange}
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
                    handleFechaChange(fechaISO);
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
              onValueChange={handleHoraInicioChange}
              style={styles.picker}
              dropdownIconColor="#1976D2"
              enabled={horasInicioDisponibles.length > 0}
            >
              <Picker.Item 
                label={
                  horasInicioDisponibles.length > 0 
                    ? "Selecciona hora" 
                    : "No hay horas disponibles"
                } 
                value="" 
              />
              {horasInicioDisponibles.map(hora => (
                <Picker.Item key={hora} label={hora} value={hora} />
              ))}
            </Picker>
            {horasInicioDisponibles.length === 0 && form.pista && form.fecha && (
              <Text style={styles.noHorasText}>Todas las horas están ocupadas para esta fecha y pista</Text>
            )}
          </View>
          
          <View style={[styles.timePickerWrapper, isMobile && styles.fullWidth]}>
            <Text style={styles.pickerLabel}>Hora fin</Text>
            <Picker
              selectedValue={form.horaFin}
              onValueChange={handleHoraFinChange}
              style={styles.picker}
              dropdownIconColor="#1976D2"
              enabled={horasFinDisponibles.length > 0 && form.horaInicio !== ''}
            >
              <Picker.Item 
                label={
                  !form.horaInicio ? "Primero selecciona hora inicio" :
                  horasFinDisponibles.length > 0 ? "Selecciona hora" : 
                  "No hay horas disponibles para esta hora inicio"
                } 
                value="" 
              />
              {horasFinDisponibles.map(hora => (
                <Picker.Item key={hora} label={hora} value={hora} />
              ))}
            </Picker>
            {horasFinDisponibles.length === 0 && form.horaInicio && (
              <Text style={styles.noHorasText}>No hay horas de fin disponibles para esta hora de inicio</Text>
            )}
          </View>
        </View>
        {(errores.horaInicio || errores.horaFin) && (
          <Text style={styles.fieldError}>{errores.horaInicio || errores.horaFin}</Text>
        )}

        {errores.disponibilidad && (
          <View style={styles.alertContainer}>
            <Text style={styles.alertText}>⚠️ {errores.disponibilidad}</Text>
          </View>
        )}

        {validandoDisponibilidad && (
          <View style={styles.validandoContainer}>
            <ActivityIndicator size="small" color="#1976D2" />
            <Text style={styles.validandoText}>Verificando disponibilidad...</Text>
          </View>
        )}

        <View style={styles.checkboxContainer}>
          <Checkbox
            status={form.ludoteca ? 'checked' : 'unchecked'}
            onPress={handleLudotecaChange}
            color="#1976D2"
          />
          <Text style={styles.checkboxLabel}>Incluir servicio de ludoteca (+5€)</Text>
        </View>

        {/* 👇 MOSTRAR PRECIO CUANDO HAY DATOS VÁLIDOS */}
        {(form.pista && form.horaInicio && form.horaFin) && (
          <View style={styles.precioSection}>
            <PrecioEstimadoComponent />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.boton, 
            (loading || Object.keys(errores).length > 0 || (!reservaParaEditar && misReservasPendientes.length > 0)) && styles.botonDisabled
          ]}
          onPress={handleSubmit}
          disabled={loading || Object.keys(errores).length > 0 || (!reservaParaEditar && misReservasPendientes.length > 0)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : !reservaParaEditar && misReservasPendientes.length > 0 ? (
            <Text style={styles.botonTexto}>Reserva Pendiente</Text>
          ) : (
            <Text style={styles.botonTexto}>
              {reservaParaEditar ? 'Actualizar Reserva' : 'Reservar'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 👇 BOTÓN CANCELAR SOLO EN MODO EDICIÓN */}
        {reservaParaEditar && (
          <TouchableOpacity
            style={[styles.boton, styles.botonSecundario]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.botonSecundarioTexto}>Cancelar Edición</Text>
          </TouchableOpacity>
        )}
      </View>

      <ModalAlerta />
    </View>
  );

  const renderEmptyItem = () => null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        data={[{}]}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={<FormContent />}
        renderItem={renderEmptyItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
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
  editandoContainer: {
    backgroundColor: '#DBEAFE',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#1D4ED8',
  },
  editandoText: {
    color: '#1E3A8A',
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
    ...Platform.select({
      web: {
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
      },
    }),
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
  noHorasText: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
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
  precioContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  precioTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  cambioContainer: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  cambioTexto: {
    fontSize: 14,
    color: '#92400e',
    fontStyle: 'italic',
  },
  desglose: {
    marginBottom: 12,
  },
  desgloseTexto: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalPrecio: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  precioCambiado: {
    color: '#dc2626',
  },
  notaCambio: {
    fontSize: 12,
    color: '#dc2626',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  boton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  botonSecundario: {
    backgroundColor: '#6B7280',
    marginTop: 10,
  },
  botonTexto: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  botonSecundarioTexto: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});