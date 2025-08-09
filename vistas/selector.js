import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  FlatList,
  Platform
} from 'react-native';
import { useUser } from '../contexto/UserContex';
import { Ionicons } from '@expo/vector-icons';



export default function Selector({ navigation }) {
  const { usuario, rol, logout } = useUser();
  const [isHoveredReserve, setIsHoveredReserve] = useState(false);
  const [isHoveredAdmin, setIsHoveredAdmin] = useState(false);
  const [isHoveredLogout, setIsHoveredLogout] = useState(false);
const [isHoveredMyReservations, setIsHoveredMyReservations] = useState(false);

  // Componente con TODO el contenido que va debajo del header fijo
  const Content = () => (
    <View style={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Gestión de Reservas</Text>
        <Text style={styles.subtitle}>Controla tus actividades deportivas</Text>
        
        {rol === 'admin' && (
          <TouchableOpacity
            style={[
              styles.button, 
              styles.adminButton,
              isHoveredAdmin && styles.buttonHovered
            ]}
            onPress={() => navigation.navigate('AdminPanel')}
            activeOpacity={0.9}
            onMouseEnter={() => Platform.OS === 'web' && setIsHoveredAdmin(true)}
            onMouseLeave={() => Platform.OS === 'web' && setIsHoveredAdmin(false)}
          >
            <Ionicons name="shield-outline" size={24} color="#fff" style={styles.buttonIcon} />
            <View>
              <Text style={styles.buttonText}>Panel de Administración</Text>
              <Text style={styles.buttonSubtext}>Gestionar pistas, usuarios y reservas</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.button, 
            styles.reserveButton,
            isHoveredReserve && styles.buttonHovered
          ]}
          onPress={() => navigation.navigate('CrearReserva')}
          activeOpacity={0.9}
          onMouseEnter={() => Platform.OS === 'web' && setIsHoveredReserve(true)}
          onMouseLeave={() => Platform.OS === 'web' && setIsHoveredReserve(false)}
        >
          <Ionicons name="calendar-outline" size={24} color="#fff" style={styles.buttonIcon} />
          <View>
            <Text style={styles.buttonText}>Nueva Reserva</Text>
            <Text style={styles.buttonSubtext}>Reservar pista ahora</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
  style={[
    styles.button,
    { backgroundColor: '#8B5CF6' }, // Color diferente (púrpura)
    isHoveredMyReservations && styles.buttonHovered
  ]}
  onPress={() => navigation.navigate('MisReservas')}
  activeOpacity={0.9}
  onMouseEnter={() => Platform.OS === 'web' && setIsHoveredMyReservations(true)}
  onMouseLeave={() => Platform.OS === 'web' && setIsHoveredMyReservations(false)}
>
  <Ionicons name="list-outline" size={24} color="#fff" style={styles.buttonIcon} />
  <View>
    <Text style={styles.buttonText}>Mis Reservas</Text>
    <Text style={styles.buttonSubtext}>Ver y gestionar reservas</Text>
  </View>
</TouchableOpacity>

      </View>

      {/* Sección de instrucciones */}
      <View style={[styles.card, styles.infoSection]}>
        <Text style={styles.sectionTitle}>Cómo hacer una reserva</Text>
        
        {[{
          number: '1',
          title: 'Selecciona "Nueva Reserva"',
          description: 'Accede al formulario de reserva'
        },{
          number: '2',
          title: 'Elige fecha y hora',
          description: 'Selecciona el momento que prefieras'
        },{
          number: '3',
          title: 'Selecciona la pista',
          description: 'Elige entre las disponibles'
        },{
          number: '4',
          title: 'Confirma tu reserva',
          description: '¡Listo! Recibirás un correo de confirmación'
        }].map(({number, title, description}) => (
          <View style={styles.step} key={number}>
            <View style={styles.stepNumberContainer}>
              <Text style={styles.stepNumber}>{number}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepDescription}>{description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.benefitsSection]}>
        <Text style={styles.sectionTitle}>Beneficios de reservar</Text>
        
        {[{
          icon: 'time-outline',
          text: 'Garantiza tu horario preferido',
        },{
          icon: 'pricetag-outline',
          text: 'Acceso a promociones exclusivas',
        },{
          icon: 'people-outline',
          text: 'Posibilidad de jugar con amigos',
        }].map(({icon, text}, i) => (
          <View style={styles.benefitItem} key={i}>
            <Ionicons name={icon} size={24} color="#4F46E5" />
            <Text style={styles.benefitText}>{text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderReserva = ({ item }) => (
    <View style={styles.reservaItem}>
      <Text>{item.nombre}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <FlatList
        data={{}} // Tus reservas aquí (por ahora vacío)
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        
        // Header fijo con bienvenida y logout + todo el contenido (botones, instrucciones...)
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={styles.welcomeText}>Bienvenido,</Text>
                <Text style={styles.username}>{usuario || 'Invitado'}</Text>
                
                <TouchableOpacity
                  onPress={() => {
                    logout();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Inicio' }],
                    });
                  }}
                  style={[
                    styles.logoutButton,
                    isHoveredLogout && styles.logoutButtonHovered
                  ]}
                  activeOpacity={0.8}
                  onMouseEnter={() => Platform.OS === 'web' && setIsHoveredLogout(true)}
                  onMouseLeave={() => Platform.OS === 'web' && setIsHoveredLogout(false)}
                >
                  <Ionicons name="exit-outline" size={24} color="#fff" />
                  <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Content />
          </>
        }

        renderItem={renderReserva}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? { height: '100vh' } : {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  headerContent: {
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  welcomeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    transition: 'background-color 0.3s ease',
  },
  logoutButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 20,
    paddingHorizontal: 10,
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 15,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  buttonHovered: {
    transform: [{ translateY: -2 }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  reserveButton: {
    backgroundColor: '#4F46E5',
  },
  adminButton: {
    backgroundColor: '#10B981',
  },
  buttonIcon: {
    marginRight: 15,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    marginTop: 10,
  },
  benefitsSection: {
    backgroundColor: 'rgba(249, 250, 251, 0.95)',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 25,
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepNumberContainer: {
    backgroundColor: '#E0E7FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepNumber: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#4B5563',
    marginLeft: 15,
    fontWeight: '500',
  },
  reservaItem: {
    padding: 20,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 10,
  }
});