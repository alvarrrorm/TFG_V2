import React from 'react';
import { View, ScrollView } from 'react-native';
import FormularioReserva from '../componentes/FormularioReserva';

export default function CrearReserva({ navigation }) {
  return (
    <ScrollView>
      <View style={{ flex: 1, padding: 20 }}>
        <FormularioReserva navigation={navigation} />
      </View>
    </ScrollView>

  );
}
