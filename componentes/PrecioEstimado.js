import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PrecioEstimado({ 
  precio, 
  duracion, 
  precioHora, 
  esEdicion = false, 
  precioAnterior = 0 
}) {
  const hayCambio = esEdicion && precio !== precioAnterior;
  
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>
        {esEdicion ? 'Precio Actualizado' : 'Precio Estimado'}
      </Text>
      
      {esEdicion && hayCambio && (
        <View style={styles.cambioContainer}>
          <Text style={styles.cambioTexto}>
            Precio anterior: {precioAnterior} €
          </Text>
        </View>
      )}
      
      <View style={styles.desglose}>
        <Text style={styles.desgloseTexto}>
          {duracion}h × {precioHora}€/hora = {duracion * precioHora}€
        </Text>
      </View>
      
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={[styles.totalPrecio, hayCambio && styles.precioCambiado]}>
          {precio} €
        </Text>
      </View>
      
      {hayCambio && (
        <Text style={styles.notaCambio}>
          💰 El precio se ha actualizado por los cambios realizados
        </Text>
      )}
    </View>
  );
}

// ESTILOS CORREGIDOS - Asegúrate de que StyleSheet esté importado correctamente
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  titulo: {
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
});