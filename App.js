import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { UserProvider } from './contexto/UserContex';
import Login from './vistas/login';
import Registro from './vistas/registro';
import Inicio from './vistas/inicio';
import Selector from './vistas/selector';
import CrearReserva from './vistas/NuevaReserva';
import AdminPanel from './vistas/admin';
import ResumenReserva from './vistas/ResumenReserva';
import FormularioReserva from './componentes/FormularioReserva';

import MisReservas from './vistas/MisReservas';

const Stack = createStackNavigator();

export default function App() {
  return (
    <UserProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Inicio"
          screenOptions={{
            headerTitle: '',               
            headerBackTitleVisible: false, 
            headerStyle: {
              backgroundColor: 'transparent',  
              elevation: 0,   
              shadowOpacity: 0, 
            },
            headerTintColor: '#000', 
          }}
        >
          <Stack.Screen 
            name="Inicio" 
            component={Inicio} 
            options={{
              headerShown: false,        
            }}
          />
          <Stack.Screen 
            name="Login" 
            component={Login} 
          />
          <Stack.Screen 
            name="Registro" 
            component={Registro} 
          />
          <Stack.Screen 
            name="Reservas" 
            component={Selector} 
            options={{
              headerShown: false,         
            }}
          />
          <Stack.Screen 
  name="FormularioReserva" 
  component={FormularioReserva}
  options={{ title: 'Nueva Reserva' }}
/>
          <Stack.Screen
            name="CrearReserva"
            component={CrearReserva}
          />
          <Stack.Screen
            name="AdminPanel"
            component={AdminPanel}
          />
          <Stack.Screen
            name="ResumenReserva"
            component={ResumenReserva}
            options={{
              headerShown: true,         
              title: 'Resumen de Reserva', 
            }}
            />
          <Stack.Screen
            name="MisReservas"
            component={MisReservas}
            options={{
              headerShown: true,         
              title: 'Mis Reservas', 
            }}
          />
         
        </Stack.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}
