import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { useUser } from '../contexto/UserContex';
import { Ionicons } from '@expo/vector-icons';

export default function Selector({ navigation }) {
  const { usuario, rol, logout } = useUser();
  const { width, height } = useWindowDimensions();
  
  const [hoverStates, setHoverStates] = useState({
    reserve: false,
    admin: false,
    logout: false,
    myReservations: false
  });

  const [darkMode, setDarkMode] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isMobile = !isWeb || width <= 768;

  // Colores para modo oscuro
  const colors = darkMode ? {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceLight: '#334155',
    primary: '#6366F1',
    primaryLight: '#818CF8',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    border: '#334155',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    card: '#1E293B',
    header: '#1E293B',
  } : {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceLight: '#F1F5F9',
    primary: '#4F46E5',
    primaryLight: '#6366F1',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    card: '#FFFFFF',
    header: '#FFFFFF',
  };

  const handleHover = (key, value) => {
    if (isWeb) {
      setHoverStates(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Inicio' }],
    });
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // ========== UI PARA MÓVIL ==========
  const MobileUI = () => (
    <View style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
      {/* Header Móvil */}
      <View style={[styles.mobileHeader, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={[styles.mobileWelcome, { color: colors.text }]}>Hola, {usuario}</Text>
          <Text style={[styles.mobileSubtitle, { color: colors.textSecondary }]}>Gestión de reservas</Text>
        </View>
        <View style={styles.mobileHeaderRight}>
          <TouchableOpacity 
            style={styles.darkModeToggle}
            onPress={toggleDarkMode}
          >
            <Ionicons 
              name={darkMode ? "sunny" : "moon"} 
              size={22} 
              color={colors.text} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.mobileLogout}
            onPress={handleLogout}
          >
            <Ionicons name="exit-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.mobileScroll} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mobileScrollContent}
      >
        {/* Tarjeta Principal Móvil */}
        <View style={[styles.mobileMainCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Acciones</Text>
          
          {rol === 'admin' && (
            <TouchableOpacity 
              style={[styles.mobileActionBtn, { backgroundColor: colors.success }]}
              onPress={() => navigation.navigate('AdminPanel')}
            >
              <Ionicons name="shield-outline" size={28} color="#fff" />
              <View style={styles.mobileBtnText}>
                <Text style={styles.mobileBtnTitle}>Panel Admin</Text>
                <Text style={styles.mobileBtnSubtitle}>Gestionar sistema</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.mobileActionBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CrearReserva')}
          >
            <Ionicons name="calendar-outline" size={28} color="#fff" />
            <View style={styles.mobileBtnText}>
              <Text style={styles.mobileBtnTitle}>Nueva Reserva</Text>
              <Text style={styles.mobileBtnSubtitle}>Reservar pista</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mobileActionBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('MisReservas')}
          >
            <Ionicons name="list-outline" size={28} color="#fff" />
            <View style={styles.mobileBtnText}>
              <Text style={styles.mobileBtnTitle}>Mis Reservas</Text>
              <Text style={styles.mobileBtnSubtitle}>Ver mis reservas</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Sección Información Móvil */}
        <View style={[styles.mobileInfoSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.mobileSectionTitle, { color: colors.text }]}>Cómo reservar</Text>
          
          {[{
            number: '1', title: 'Nueva Reserva', desc: 'Accede al formulario'
          },{
            number: '2', title: 'Elige horario', desc: 'Selecciona fecha/hora'
          },{
            number: '3', title: 'Selecciona pista', desc: 'Elige disponible'
          },{
            number: '4', title: 'Confirma', desc: '¡Listo!'
          }].map((step) => (
            <View key={step.number} style={styles.mobileStep}>
              <View style={[styles.mobileStepNumber, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.mobileStepNumberText, { color: colors.primary }]}>{step.number}</Text>
              </View>
              <View style={styles.mobileStepContent}>
                <Text style={[styles.mobileStepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.mobileStepDesc, { color: colors.textSecondary }]}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Beneficios Móvil */}
        <View style={[styles.mobileBenefits, { backgroundColor: colors.card }]}>
          <Text style={[styles.mobileSectionTitle, { color: colors.text }]}>Beneficios</Text>
          <View style={styles.mobileBenefitsGrid}>
            <View style={[styles.mobileBenefit, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name="time-outline" size={24} color={colors.primary} />
              <Text style={[styles.mobileBenefitText, { color: colors.text }]}>Horario garantizado</Text>
            </View>
            <View style={[styles.mobileBenefit, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name="pricetag-outline" size={24} color={colors.success} />
              <Text style={[styles.mobileBenefitText, { color: colors.text }]}>Promociones</Text>
            </View>
            <View style={[styles.mobileBenefit, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name="people-outline" size={24} color="#8B5CF6" />
              <Text style={[styles.mobileBenefitText, { color: colors.text }]}>Juega con amigos</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // ========== UI PARA WEB (SIN SIDEBAR) ==========
  const WebUI = () => (
    <SafeAreaView style={[styles.webSafeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.webContainer, { backgroundColor: colors.background }]}>
        {/* Header Web */}
        <View style={[styles.webHeader, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
          <View style={styles.webHeaderContent}>
            <View style={styles.webHeaderLeft}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {usuario?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
              <View>
                <Text style={[styles.webWelcome, { color: colors.text }]}>Hola, {usuario}</Text>
                <Text style={[styles.webRole, { color: colors.textSecondary }]}>{rol === 'admin' ? 'Administrador' : 'Usuario'}</Text>
              </View>
            </View>
            
            <View style={styles.webHeaderRight}>
              {/* Toggle Modo Oscuro */}
              <TouchableOpacity 
                style={[styles.darkModeToggle, styles.webDarkModeToggle]}
                onPress={toggleDarkMode}
                onMouseEnter={() => handleHover('darkMode', true)}
                onMouseLeave={() => handleHover('darkMode', false)}
              >
                <Ionicons 
                  name={darkMode ? "sunny" : "moon"} 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <Text style={[styles.darkModeText, { color: colors.textSecondary }]}>
                  {darkMode ? 'Claro' : 'Oscuro'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.webHeaderButton, { backgroundColor: hoverStates.reserve ? colors.surfaceLight : 'transparent' }]}
                onPress={() => navigation.navigate('CrearReserva')}
                onMouseEnter={() => handleHover('reserve', true)}
                onMouseLeave={() => handleHover('reserve', false)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[styles.webHeaderButtonText, { color: colors.text }]}>Nueva Reserva</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.webHeaderButton, { backgroundColor: hoverStates.myReservations ? colors.surfaceLight : 'transparent' }]}
                onPress={() => navigation.navigate('MisReservas')}
                onMouseEnter={() => handleHover('myReservations', true)}
                onMouseLeave={() => handleHover('myReservations', false)}
              >
                <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.webHeaderButtonText, { color: colors.text }]}>Mis Reservas</Text>
              </TouchableOpacity>

              {rol === 'admin' && (
                <TouchableOpacity 
                  style={[styles.webHeaderButton, { backgroundColor: hoverStates.admin ? colors.surfaceLight : 'transparent' }]}
                  onPress={() => navigation.navigate('AdminPanel')}
                  onMouseEnter={() => handleHover('admin', true)}
                  onMouseLeave={() => handleHover('admin', false)}
                >
                  <Ionicons name="shield-outline" size={20} color={colors.success} />
                  <Text style={[styles.webHeaderButtonText, { color: colors.text }]}>Admin</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.webHeaderButton, styles.logoutButton, { backgroundColor: colors.surfaceLight }]}
                onPress={handleLogout}
                onMouseEnter={() => handleHover('logout', true)}
                onMouseLeave={() => handleHover('logout', false)}
              >
                <Ionicons name="exit-outline" size={20} color={colors.danger} />
                <Text style={[styles.webHeaderButtonText, styles.logoutButtonText, { color: colors.danger }]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Main Content Web */}
        <View style={styles.webContentWrapper}>
          <ScrollView 
            style={styles.webMainScroll}
            contentContainerStyle={styles.webMainScrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.webMain}>
              <View style={styles.webTitleSection}>
                <Text style={[styles.webTitle, { color: colors.text }]}>Panel de Control</Text>
                <Text style={[styles.webSubtitle, { color: colors.textSecondary }]}>Gestiona tus reservas deportivas</Text>
              </View>

              <View style={styles.webGrid}>
                {/* Card Reserva Rápida */}
                <View style={[styles.webCard, styles.quickReserveCard, { 
                  backgroundColor: colors.card,
                  borderTopColor: colors.primary 
                }]}>
                  <Ionicons name="calendar" size={48} color={colors.primary} />
                  <Text style={[styles.webCardTitle, { color: colors.text }]}>Reserva Rápida</Text>
                  <Text style={[styles.webCardDesc, { color: colors.textSecondary }]}>Reserva una pista en pocos clicks</Text>
                  <TouchableOpacity 
                    style={[styles.webPrimaryBtn, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('CrearReserva')}
                    onMouseEnter={() => handleHover('reserve', true)}
                    onMouseLeave={() => handleHover('reserve', false)}
                  >
                    <Text style={styles.webPrimaryBtnText}>Nueva Reserva</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Card Mis Reservas */}
                <View style={[styles.webCard, styles.myReservationsCard, { 
                  backgroundColor: colors.card,
                  borderTopColor: '#8B5CF6'
                }]}>
                  <Ionicons name="list" size={48} color="#8B5CF6" />
                  <Text style={[styles.webCardTitle, { color: colors.text }]}>Mis Reservas</Text>
                  <Text style={[styles.webCardDesc, { color: colors.textSecondary }]}>Gestiona tus reservas activas</Text>
                  <TouchableOpacity 
                    style={[styles.webSecondaryBtn, { borderColor: colors.border }]}
                    onPress={() => navigation.navigate('MisReservas')}
                  >
                    <Text style={[styles.webSecondaryBtnText, { color: colors.textSecondary }]}>Ver Reservas</Text>
                  </TouchableOpacity>
                </View>

                {/* Card Admin */}
                {rol === 'admin' && (
                  <View style={[styles.webCard, styles.adminCard, { 
                    backgroundColor: colors.card,
                    borderTopColor: colors.success
                  }]}>
                    <Ionicons name="shield" size={48} color={colors.success} />
                    <Text style={[styles.webCardTitle, { color: colors.text }]}>Panel Admin</Text>
                    <Text style={[styles.webCardDesc, { color: colors.textSecondary }]}>Gestiona pistas y usuarios</Text>
                    <TouchableOpacity 
                      style={[styles.webSecondaryBtn, { borderColor: colors.border }]}
                      onPress={() => navigation.navigate('AdminPanel')}
                    >
                      <Text style={[styles.webSecondaryBtnText, { color: colors.textSecondary }]}>Acceder</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Sección de Instrucciones Web */}
              <View style={[styles.webInstructions, { backgroundColor: colors.card }]}>
                <Text style={[styles.webSectionTitle, { color: colors.text }]}>Cómo hacer una reserva</Text>
                <View style={styles.webSteps}>
                  {[{
                    icon: 'add-circle-outline',
                    title: 'Paso 1: Nueva Reserva',
                    description: 'Haz clic en "Nueva Reserva" para acceder al formulario de reserva'
                  }, {
                    icon: 'time-outline',
                    title: 'Paso 2: Selecciona Horario',
                    description: 'Elige la fecha y hora que mejor se adapten a tus necesidades'
                  }, {
                    icon: 'location-outline',
                    title: 'Paso 3: Elige Pista',
                    description: 'Selecciona entre las pistas disponibles para tu deporte'
                  }, {
                    icon: 'checkmark-done-outline',
                    title: 'Paso 4: Confirma',
                    description: 'Revisa los detalles y confirma tu reserva. ¡Recibirás un email de confirmación!'
                  }].map((step, index) => (
                    <View key={index} style={[styles.webStep, { backgroundColor: colors.surfaceLight }]}>
                      <View style={[styles.webStepIcon, { backgroundColor: darkMode ? '#3730A3' : '#E0E7FF' }]}>
                        <Ionicons name={step.icon} size={32} color={colors.primary} />
                      </View>
                      <View style={styles.webStepContent}>
                        <Text style={[styles.webStepTitle, { color: colors.text }]}>{step.title}</Text>
                        <Text style={[styles.webStepDescription, { color: colors.textSecondary }]}>{step.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Estadísticas Web */}
              <View style={styles.webStats}>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="time-outline" size={32} color={colors.primary} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>4</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pasos simples</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="pricetag-outline" size={32} color={colors.success} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>24/7</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Disponible</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="people-outline" size={32} color="#8B5CF6" />
                  <Text style={[styles.statNumber, { color: colors.text }]}>100%</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Garantizado</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="star-outline" size={32} color={colors.warning} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>5.0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Calificación</Text>
                </View>
              </View>

              {/* Beneficios Web */}
              <View style={styles.webBenefits}>
                <Text style={[styles.webSectionTitle, { color: colors.text }]}>Beneficios Exclusivos</Text>
                <View style={styles.benefitsGrid}>
                  <View style={[styles.benefitCard, { backgroundColor: colors.card }]}>
                    <Ionicons name="calendar-outline" size={40} color={colors.primary} />
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>Reservas Instantáneas</Text>
                    <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>Reserva en cualquier momento desde tu dispositivo</Text>
                  </View>
                  <View style={[styles.benefitCard, { backgroundColor: colors.card }]}>
                    <Ionicons name="notifications-outline" size={40} color={colors.success} />
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>Recordatorios</Text>
                    <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>Recibe notificaciones antes de tu reserva</Text>
                  </View>
                  <View style={[styles.benefitCard, { backgroundColor: colors.card }]}>
                    <Ionicons name="heart-outline" size={40} color={colors.danger} />
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>Favoritos</Text>
                    <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>Guarda tus pistas y horarios preferidos</Text>
                  </View>
                </View>
              </View>

              {/* Footer Web */}
              <View style={[styles.webFooter, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  ¿Necesitas ayuda? Contacta con soporte@reservas.com
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      {isMobile ? <MobileUI /> : <WebUI />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ========== ESTILOS WEB ==========
  webSafeArea: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  webContentWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 80px)',
        overflow: 'hidden',
      },
    }),
  },
  webMainScroll: {
    flex: 1,
  },
  webMainScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Header Web
  webHeader: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderBottomWidth: 1,
    minHeight: 80,
  },
  webHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  webHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  webWelcome: {
    fontSize: 18,
    fontWeight: '700',
  },
  webRole: {
    fontSize: 14,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    transition: 'background-color 0.2s ease',
  },
  webHeaderButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
  },
  logoutButtonText: {
    color: '#EF4444',
  },

  // Toggle Modo Oscuro
  darkModeToggle: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDarkModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  darkModeText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Contenido principal
  webMain: {
    padding: 40,
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  webTitleSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  webTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  webSubtitle: {
    fontSize: 18,
    textAlign: 'center',
  },

  // Grid y Cards
  webGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 60,
    flexWrap: 'wrap',
  },
  webCard: {
    flex: 1,
    minWidth: 280,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderTopWidth: 4,
  },
  webCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  webCardDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  webPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  webPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  webSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Secciones de contenido
  webInstructions: {
    borderRadius: 20,
    padding: 40,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  webSectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
  },
  webSteps: {
    gap: 24,
  },
  webStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 16,
  },
  webStepIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  webStepContent: {
    flex: 1,
  },
  webStepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  webStepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  webStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  statCard: {
    flex: 1,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  webBenefits: {
    marginBottom: 40,
  },
  benefitsGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  benefitCard: {
    flex: 1,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  webFooter: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // ========== ESTILOS MÓVIL ==========
  mobileContainer: {
    flex: 1,
  },
  mobileHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mobileWelcome: {
    fontSize: 20,
    fontWeight: '700',
  },
  mobileSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  mobileLogout: {
    padding: 8,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  mobileMainCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  mobileCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  mobileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  mobileBtnText: {
    flex: 1,
    marginLeft: 12,
  },
  mobileBtnTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mobileBtnSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 2,
  },
  mobileInfoSection: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
  },
  mobileSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  mobileStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  mobileStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mobileStepNumberText: {
    fontWeight: '700',
    fontSize: 14,
  },
  mobileStepContent: {
    flex: 1,
  },
  mobileStepTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  mobileStepDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  mobileBenefits: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
  },
  mobileBenefitsGrid: {
    gap: 12,
  },
  mobileBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  mobileBenefitText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
});