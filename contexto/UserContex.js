import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserContext = createContext();

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState({
    nombre: null,
    dni: null,
    rol: null
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedUser = await AsyncStorage.getItem('userData');
        if (savedUser) {
          setUserData(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUser();
  }, []);

  const login = async (nombre, dni, rol) => {
    const newUserData = { nombre, dni, rol };
    setUserData(newUserData);
    await AsyncStorage.setItem('userData', JSON.stringify(newUserData));
  };

  const logout = async () => {
    setUserData({ nombre: null, dni: null, rol: null });
    await AsyncStorage.removeItem('userData');
  };

  return (
    <UserContext.Provider value={{
      usuario: userData.nombre, 
      dni: userData.dni,
      rol: userData.rol,
      login,
      logout
    }}>
      {children}
    </UserContext.Provider>
  );
};