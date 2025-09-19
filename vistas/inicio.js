import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import { useUser } from '../contexto/UserContex';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Inicio({ navigation }) {
  const { usuario } = useUser();
  const [hoverStates, setHoverStates] = useState({
    login: false,
    register: false,
    reserve: false
  });

  // 🔹 Limpieza de sesión al abrir la pantalla
  useEffect(() => {
    (async function clearSessionData() {
      try {
        if (Platform.OS === 'web') {
          // --- BORRAR COOKIES ACCESIBLES DESDE JS ---
          if (typeof document !== 'undefined' && document.cookie) {
            document.cookie.split(';').forEach(cookie => {
              const name = cookie.split('=')[0].trim();
              document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
            });
          }

          // --- BORRAR localStorage y sessionStorage ---
          try {
            localStorage && localStorage.clear();
            sessionStorage && sessionStorage.clear();
          } catch (e) {
            console.warn('No se pudo limpiar local/sessionStorage:', e);
          }

          // --- LLAMAR AL SERVIDOR PARA EXPIRAR COOKIES HttpOnly ---
          try {
            await fetch('/api/logout', {
              method: 'POST',
              credentials: 'include',
            });
          } catch (e) {
            console.warn('Error llamando a logout en backend:', e);
          }

        } else {
          // --- EN MÓVIL: BORRAR AsyncStorage (tokens de sesión) ---
          await AsyncStorage.clear();
        }

        console.log('✅ Sesión previa limpiada.');
      } catch (err) {
        console.error('Error limpiando sesión previa:', err);
      }
    })();
  }, []);

  const handleHover = (button, isHovered) => {
    if (Platform.OS === 'web') {
      setHoverStates(prev => ({ ...prev, [button]: isHovered }));
    }
  };

  const handleReserva = () => {
    if (usuario) {
      navigation.navigate('Reservas');
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <View style={styles.overlay}>
      <FlatList
        data={[]}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.container}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  Bienvenido a <Text style={styles.titleHighlight}>Depo</Text>
                </Text>
                <Text style={styles.subtitle}>Tu pasión, nuestro compromiso</Text>

                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.loginButton,
                      hoverStates.login && styles.buttonHovered
                    ]}
                    onPress={() => navigation.navigate('Login')}
                    onMouseEnter={() => handleHover('login', true)}
                    onMouseLeave={() => handleHover('login', false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Iniciar Sesión</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.registerButton,
                      hoverStates.register && styles.buttonHovered
                    ]}
                    onPress={() => navigation.navigate('Registro')}
                    onMouseEnter={() => handleHover('register', true)}
                    onMouseLeave={() => handleHover('register', false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Registrarse</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.content}>
                <Text style={styles.contentTitle}>¿Qué es Depo?</Text>
                <Text style={styles.contentText}>
                  Depo es tu plataforma premium para descubrir, organizar y disfrutar actividades deportivas.
                  Conecta con otros apasionados del deporte, reserva instalaciones de primera calidad y participa
                  en eventos exclusivos. ¡Transforma tu experiencia deportiva con nosotros!
                </Text>

                <TouchableOpacity
                  style={[
                    styles.reserveButton,
                    hoverStates.reserve && styles.reserveButtonHovered
                  ]}
                  onPress={handleReserva}
                  onMouseEnter={() => handleHover('reserve', true)}
                  onMouseLeave={() => handleHover('reserve', false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reserveButtonText}>
                    {usuario ? 'Reserva Ahora' : 'Reserva tu Espacio'}
                  </Text>
                  <Text style={styles.reserveSubtext}>
                    {usuario ? '¡No pierdas tu lugar!' : 'Inicia tu experiencia deportiva'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.featuresTitle}>Beneficios Exclusivos</Text>
                <View style={styles.featuresContainer}>
                  <View style={styles.featureItem}>
                    <Text style={styles.featureIcon}>⏱️</Text>
                    <Text style={styles.featureText}>Reservas rápidas</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Text style={styles.featureIcon}>🤝</Text>
                    <Text style={styles.featureText}>Comunidad activa</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        }
        contentContainerStyle={{ padding: 20 }}
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { alignItems: 'center', justifyContent: 'flex-start' },
  header: {
    width: '100%', maxWidth: 1000, alignItems: 'center',
    marginBottom: 40, marginTop: 20,
  },
  title: {
    fontSize: 52, fontWeight: '800', color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5, marginBottom: 5,
  },
  titleHighlight: { color: '#4facfe' },
  subtitle: {
    fontSize: 18, color: 'rgba(255,255,255,0.9)',
    fontWeight: '500', marginBottom: 30,
  },
  buttonGroup: {
    flexDirection: 'row', marginTop: 30, gap: 20,
    justifyContent: 'center', flexWrap: 'wrap',
  },
  button: {
    borderRadius: 25, minWidth: 180,
    paddingVertical: 16, paddingHorizontal: 30,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  buttonHovered: {
    transform: [{ translateY: -2 }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  loginButton: {
    backgroundColor: '#4facfe',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  registerButton: {
    backgroundColor: '#43e97b',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    color: 'white', fontSize: 18,
    fontWeight: '700', letterSpacing: 0.5,
  },
  content: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 25, padding: 35, maxWidth: 1000,
    alignItems: 'center', marginBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  contentTitle: {
    fontSize: 32, fontWeight: '800',
    color: '#1a365d', marginBottom: 20, textAlign: 'center',
  },
  contentText: {
    fontSize: 17, lineHeight: 26, color: '#4a5568',
    textAlign: 'center', marginBottom: 30, fontWeight: '500',
  },
  reserveButton: {
    borderRadius: 30, minWidth: 250,
    paddingVertical: 18, paddingHorizontal: 40,
    backgroundColor: '#ff758c', alignItems: 'center',
    justifyContent: 'center', marginBottom: 30,
    elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  reserveButtonHovered: {
    transform: [{ translateY: -2 }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 10,
    backgroundColor: '#ff8fa3',
  },
  reserveButtonText: {
    color: 'white', fontSize: 20,
    fontWeight: '800', letterSpacing: 0.5,
  },
  reserveSubtext: {
    color: 'rgba(255,255,255,0.9)', fontSize: 14,
    fontWeight: '500', marginTop: 3,
  },
  featuresTitle: {
    fontSize: 22, fontWeight: '700',
    color: '#2d3748', marginBottom: 15, textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 20, marginTop: 10,
  },
  featureItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(74, 85, 104, 0.1)',
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 15, minWidth: 120,
    transition: 'transform 0.2s ease',
  },
  featureIcon: { fontSize: 24, marginBottom: 5 },
  featureText: {
    fontSize: 14, fontWeight: '600',
    color: '#2d3748', textAlign: 'center',
  },
});
