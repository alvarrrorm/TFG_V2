import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const PrecioEstimado = ({ pista, horaInicio, horaFin }) => {
  const [precio, setPrecio] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const obtenerPrecio = async () => {
      if (!pista || !horaInicio || !horaFin) return;

      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:3001/reservas/precio-estimado?pista=${encodeURIComponent(
            pista
          )}&hora_inicio=${horaInicio}&hora_fin=${horaFin}`
        );
        const data = await response.json();
        setPrecio(data.precioEstimado);
      } catch (error) {
        console.error('Error al obtener precio estimado:', error);
      } finally {
        setLoading(false);
      }
    };

    obtenerPrecio();
  }, [pista, horaInicio, horaFin]);

  if (!pista || !horaInicio || !horaFin) return null;

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="small" color="#555" />
      ) : precio !== null ? (
        <Text style={styles.text}>💰 Precio estimado: {precio.toFixed(2)} €</Text>
      ) : (
        <Text style={styles.text}>No se pudo calcular el precio</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f3f3f3',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});

export default PrecioEstimado;
