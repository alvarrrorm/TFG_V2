import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Checkbox } from 'react-native-paper';
import { UserContext } from '../contexto/UserContex';
import CalendarioWeb from './CalendarioWeb';
import PrecioEstimado from './PrecioEstimado';
import ResumenReserva from './ResumenReserva';

export default function FormularioReserva({ navigation }) {
  const { usuario, dni } = useContext(UserContext);
  const nombre = usuario || '';

  const [pistas, setPistas] = useState([]);
  const [loadingPistas, setLoadingPistas] = useState(true);
  const [form, setForm] = useState({
    pista: '',
    fecha: '',
    horaInicio: '08:00',
    horaFin: '09:00',
    ludoteca: false,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const horasDisponibles = Array.from({ length: 15 }, (_, i) => {
    const h = 8 + i;
    return `${h.toString().padStart(2, '0')}:00`;
  });

useEffect(() => {
  const fetchPistas = async () => {
    setLoadingPistas(true);
    try {
      const res = await fetch('http://localhost:3001/pistas');
      if (!res.ok) throw new Error('Failed to fetch pistas');
      const response = await res.json();
      
      // Verifica si la respuesta tiene la estructura esperada
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error('Invalid data format received');
      }
      
      setPistas(response.data); // Usamos response.data en lugar de response directamente
    } catch (error) {
      console.error('Error fetching pistas:', error);
      Alert.alert('Error', 'No se pudieron cargar las pistas');
      setPistas([]);
    } finally {
      setLoadingPistas(false);
    }
  };

  fetchPistas();
}, []);

  const formatoFechaLegible = fechaISO => {
    if (!fechaISO) return 'Selecciona una fecha';
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fechaISO).toLocaleDateString('es-ES', opciones);
  };

  const calcularPrecio = () => {
    if (!form.pista || !form.horaInicio || !form.horaFin) return 0;
    
    if (!Array.isArray(pistas)) return 0;
    
    const pista = pistas.find(p => p.id.toString() === form.pista);
    if (!pista || !pista.precio) return 0;

    const hi = parseInt(form.horaInicio.split(':')[0], 10);
    const hf = parseInt(form.horaFin.split(':')[0], 10);
    const duracion = hf - hi;
    if (duracion <= 0) return 0;

    return pista.precio * duracion;
  };

  const precioTotal = calcularPrecio();
  const pistaSeleccionada = Array.isArray(pistas) 
    ? pistas.find(p => p.id.toString() === form.pista)
    : null;
    
  const duracion = form.horaInicio && form.horaFin
    ? parseInt(form.horaFin.split(':')[0], 10) - parseInt(form.horaInicio.split(':')[0], 10)
    : 0;

 const handleSubmit = async () => {
  if (!form.pista || !form.fecha) {
    Alert.alert('Error', 'Por favor completa todos los campos');
    return;
  }
  if (form.horaFin <= form.horaInicio) {
    Alert.alert('Error', 'La hora de fin debe ser mayor que la de inicio');
    return;
  }

  setLoading(true);
  try {
    const res = await fetch('http://localhost:3001/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni_usuario: dni,
        nombre_usuario: nombre,
        pista: form.pista,
        fecha: form.fecha,
        hora_inicio: form.horaInicio,
        hora_fin: form.horaFin,
        ludoteca: form.ludoteca,
        estado: 'pendiente',
        precio: precioTotal,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear la reserva');
    }

    const data = await res.json();

    // Asegúrate de que data contiene el ID de la reserva creada
    if (!data.data || !data.data.id) {
      throw new Error('No se recibió el ID de la reserva');
    }

    // Navegar a ResumenReserva con todos los datos necesarios
    navigation.navigate('ResumenReserva', {
      reserva: {
        id: data.data.id, // Asegúrate de que esto está llegando
        dni_usuario: dni,
        nombre_usuario: nombre,
        pista: form.pista,
        nombre_pista: pistaSeleccionada?.nombre || '',
        fecha: form.fecha,
        hora_inicio: form.horaInicio,
        hora_fin: form.horaFin,
        ludoteca: form.ludoteca,
        estado: 'pendiente',
        precio: precioTotal,
        tipo_pista: pistaSeleccionada?.tipo || ''
      }
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    Alert.alert('Error', error.message || 'Ocurrió un error al crear la reserva');
  } finally {
    setLoading(false);
  }
};
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <View style={styles.userContainer}>
        <Text style={styles.userText}>{nombre || 'No identificado'}</Text>
      </View>

      <Text style={styles.label}>Selecciona la pista</Text>
      <View style={styles.pickerWrapper}>
        {loadingPistas ? (
          <ActivityIndicator size="small" color="#1976D2" style={styles.loadingIndicator} />
        ) : (
          <Picker
            selectedValue={form.pista}
            onValueChange={value => setForm({ ...form, pista: value })}
            style={styles.picker}
            dropdownIconColor="#1976D2"
          >
            <Picker.Item label="Selecciona una pista" value="" />
            {pistas.map(pista => (
              <Picker.Item
                key={pista.id}
                label={`${pista.nombre} - ${pista.precio} €/h`}
                value={pista.id.toString()}
              />
            ))}
          </Picker>
        )}
      </View>

      <Text style={styles.label}>Fecha de la reserva</Text>
      {Platform.OS === 'web' ? (
        <View style={{ marginBottom: 20, position: 'relative', zIndex: 10 }}>
          <CalendarioWeb
            selectedDate={form.fecha}
            onChangeDate={fechaISO => setForm({ ...form, fecha: fechaISO })}
          />
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.datePickerButton}
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
              locale='es'
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setForm({ ...form, fecha: selectedDate.toISOString().split('T')[0] });
                }
              }}
            />
          )}
        </>
      )}

      <View style={styles.pickerRow}>
        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerLabel}>Desde</Text>
          <Picker
            selectedValue={form.horaInicio}
            onValueChange={value => setForm({ ...form, horaInicio: value })}
            style={styles.picker}
            dropdownIconColor="#1976D2"
          >
            {horasDisponibles.map(hora => (
              <Picker.Item key={hora} label={hora} value={hora} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerLabel}>Hasta</Text>
          <Picker
            selectedValue={form.horaFin}
            onValueChange={value => setForm({ ...form, horaFin: value })}
            style={styles.picker}
            dropdownIconColor="#1976D2"
          >
            {horasDisponibles.filter(h => h > form.horaInicio).map(hora => (
              <Picker.Item key={hora} label={hora} value={hora} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.checkboxContainer}>
        <Checkbox
          status={form.ludoteca ? 'checked' : 'unchecked'}
          onPress={() => setForm({ ...form, ludoteca: !form.ludoteca })}
          color="#1976D2"
        />
        <Text style={styles.checkboxLabel}>Incluir servicio de ludoteca</Text>
      </View>

      {precioTotal > 0 && (
        <>
          <PrecioEstimado
            precio={precioTotal}
            duracion={duracion}
            precioHora={pistaSeleccionada?.precio || 0}
          />
          <ResumenReserva
            pista={pistaSeleccionada?.nombre || ''}
            precioHora={pistaSeleccionada?.precio || 0}
            duracion={duracion}
            total={precioTotal}
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.boton, (loading || !form.pista || !form.fecha) && styles.botonDisabled]}
        onPress={handleSubmit}
        disabled={loading || !form.pista || !form.fecha}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>Reservar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fdfdfd',
    borderRadius: 16,
    maxWidth: 600,
    width: '100%',
    marginHorizontal: 'auto',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1976D2',
  },
  userContainer: {
    backgroundColor: '#eee',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  userText: {
    color: '#444',
    fontSize: 16,
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerLabel: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#1976D2',
    marginLeft: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1976D2',
  },
  loadingIndicator: {
    padding: 15,
  },
  boton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  botonTexto: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  botonDisabled: {
    backgroundColor: '#90caf9',
  },
});