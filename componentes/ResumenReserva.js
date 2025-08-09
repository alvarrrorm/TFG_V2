import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ResumenReserva({ pista, precio, duracion, total }) {
  if (!pista) return null;

  // Aseguramos que precio y total sean números válidos
  const precioSeguro = Number(precio) || 0;
  const totalSeguro = Number(total) || 0;
  const duracionSeguro = duracion || 0;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Resumen de la reserva</Text>
      <Text style={styles.linea}>
        Pista seleccionada: <Text style={styles.valor}>{pista}</Text>
      </Text>
      
      <Text style={styles.linea}>
        Duración: <Text style={styles.valor}>{duracionSeguro} hora(s)</Text>
      </Text>
      <Text style={styles.linea}>
        Precio total: <Text style={styles.valor}>{totalSeguro.toFixed(2)} €</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  titulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  linea: {
    fontSize: 15,
    marginBottom: 4,
    color: '#333',
  },
  valor: {
    fontWeight: '600',
    color: '#1976D2',
  },
});
