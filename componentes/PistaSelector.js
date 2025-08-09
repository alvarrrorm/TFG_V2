import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function PistaSelector({ value, onChange }) {
  const [pistas, setPistas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cargarPistas = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/pistas/disponibles');
        if (!response.ok) throw new Error('Error al cargar pistas disponibles');

        const data = await response.json();
        if (data.success) {
          setPistas(data.data); // Usamos directamente los datos ya filtrados del backend
        } else {
          throw new Error(data.error || 'Error en los datos recibidos');
        }
      } catch (error) {
        Alert.alert('Error', error.message || 'No se pudieron cargar las pistas disponibles');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    cargarPistas();
  }, []);

  if (loading) {
    return <ActivityIndicator size="small" color="#1976D2" style={{ marginVertical: 10 }} />;
  }

  return (
    <View style={styles.dropdown}>
      <Picker
        selectedValue={value || ''}
        onValueChange={(id) => onChange(id)}
        dropdownIconColor="#1976D2"
        style={styles.picker}
      >
        <Picker.Item label="Selecciona una pista" value="" />
        {pistas.map((p) => (
          <Picker.Item
            key={p.id}
            label={`${p.tipo} - ${p.nombre} (€${p.precio})`}
            value={p.id}
          />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderColor: '#cfd8dc',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  picker: {
    height: 50,
    color: '#333',
  },
});