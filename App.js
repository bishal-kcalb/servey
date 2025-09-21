// App.js
import React, { useEffect, useState, useCallback } from 'react';
import { startOfflineSync, stopOfflineSync, runSync } from './services/offlineQueue'; 

import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  useFocusEffect,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import VerifyResetScreen from './screens/VerifyResetScreen';

// Surveyor-facing
import SurveyorDashboard from './screens/SurveyorDashboard';
import SurveyListScreen from './screens/SurveyListScreen';
import CompletedSurveys from './screens/CompletedSurveys';
import SubmissionDetails from './screens/SubmissionDetails';
import SurveyFormScreen from './screens/SurveyFormScreen';
import SurveyResponsesList from './screens/SurveyResponsesList';
import ProfileScreen from './screens/ProfileScreen.jsx';

// Admin-facing
import AdminDashboard from './screens/AdminDashboard';
import ManageSurveyors from './screens/ManageSurveyors';
import ManageSurveys from './screens/ManageSurveys';
import SurveyReportGenerator from './screens/SurveyReportGenerator';
import AdminCompletedSurveys from './screens/AdminCompletedSurveys';

import { ThemeProvider, useTheme } from './theme';
import { AuthService } from './services/authService.js';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ----------------------------- Surveyor stacks ----------------------------- */
function SurveyorHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SurveyorHome" component={SurveyorDashboard} />
    </Stack.Navigator>
  );
}

function SurveyorSurveysStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SurveysList" component={SurveyListScreen} />
      <Stack.Screen name="SurveyFormInner" component={SurveyFormScreen} />
    </Stack.Navigator>
  );
}

function SurveyorResponsesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompletedList" component={CompletedSurveys} />
      <Stack.Screen name="ResponsesBySurvey" component={SurveyResponsesList} />
      <Stack.Screen name="SubmissionDetailsInner" component={SubmissionDetails} />
    </Stack.Navigator>
  );
}

function SurveyorProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SurveyorProfile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

/* ------------------------------- Admin stacks ------------------------------ */
function AdminHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminDashboard} />
    </Stack.Navigator>
  );
}

function AdminSurveysStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminManageSurveys" component={ManageSurveys} />
      <Stack.Screen name="SubmissionDetailsAdmin" component={SubmissionDetails} />
    </Stack.Navigator>
  );
}

function AdminReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminReports" component={SurveyReportGenerator} />
    </Stack.Navigator>
  );
}

function AdminSurveyorsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminManageSurveyors" component={ManageSurveyors} />
    </Stack.Navigator>
  );
}

/** NEW: Admin Responses stack (Completed list -> responses -> submission details) */
function AdminResponsesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminCompletedList" component={AdminCompletedSurveys} />
      <Stack.Screen name="ResponsesBySurveyAdmin" component={SurveyResponsesList} />
      <Stack.Screen name="SubmissionDetailsAdmin" component={SubmissionDetails} />
    </Stack.Navigator>
  );
}

/* ----------------------------- Role-aware Tabs ----------------------------- */
function Tabs({ role: roleFromParent }) {
  const theme = useTheme();

  // refresh role when tabs gain focus (prevent stale role)
  const [role, setRole] = useState(roleFromParent ?? 'surveyor');
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const { user } = await AuthService.loadSession();
          if (alive) setRole(user?.role || roleFromParent || 'surveyor');
        } catch {
          if (alive) setRole(roleFromParent || 'surveyor');
        }
      })();
      return () => { alive = false; };
    }, [roleFromParent])
  );

  const isAdmin = String(role || '').toLowerCase() === 'admin';

  return (
    <Tab.Navigator
      key={`tabs-${isAdmin ? 'admin' : 'surveyor'}`}
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,              // << hide tab headers
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          height: 64,
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: '#fff',
          paddingVertical: 6,
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#111',
      }}
    >
      {isAdmin ? (
        <>
          <Tab.Screen
            name="HomeTab"
            component={AdminHomeStack}
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="dashboard" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="SurveysTab"
            component={AdminSurveysStack}
            options={{
              title: 'Surveys',
              tabBarIcon: ({ color, size }) => (
                <Feather name="edit" color={color} size={size} />
              ),
            }}
          />
          {/* NEW: Admin Responses tab */}
          <Tab.Screen
            name="ResponsesTab"
            component={AdminResponsesStack}
            options={{
              title: 'Responses',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="ReportsTab"
            component={AdminReportsStack}
            options={{
              tabBarButton: () => null,          // don't render a button
              tabBarItemStyle: { display: 'none' } // remove item from layout (no space)
            }}
          />
          <Tab.Screen
            name="SurveyorsTab"
            component={AdminSurveyorsStack}
            options={{
              title: 'Surveyors',
              tabBarIcon: ({ color, size }) => (
                <Feather name="users" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={SurveyorProfileStack}
            options={{
              title: 'Profile',
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" color={color} size={size} />
              ),
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="HomeTab"
            component={SurveyorHomeStack}
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="assignment" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="SurveysTab"
            component={SurveyorSurveysStack}
            options={{
              title: 'Surveys',
              tabBarIcon: ({ color, size }) => (
                <Feather name="play" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="ResponsesTab"
            component={SurveyorResponsesStack}
            options={{
              title: 'Responses',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={SurveyorProfileStack}
            options={{
              title: 'Profile',
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" color={color} size={size} />
              ),
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
}

/* ------------------------- Bridges (keep old routes) ------------------------ */
function BridgeToSurveys({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'SurveysTab',
      params: { screen: 'SurveysList', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}
function BridgeToSurveyForm({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'SurveysTab',
      params: { screen: 'SurveyFormInner', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}
function BridgeToCompleted({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'ResponsesTab',
      params: { screen: 'CompletedList', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}
function BridgeToResponsesList({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'ResponsesTab',
      params: { screen: 'ResponsesBySurvey', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}
function BridgeToSubmissionDetails({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'ResponsesTab',
      params: { screen: 'SubmissionDetailsInner', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}
function BridgeToProfile({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'ProfileTab',
      params: { screen: 'SurveyorProfile', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}

/** NEW: Bridge to Admin Completed list (optional deep-link helper) */
function BridgeToAdminCompleted({ navigation, route }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'ResponsesTab',
      params: { screen: 'AdminCompletedList', params: route?.params },
    });
  }, [navigation, route]);
  return null;
}

/* ----------------------------- Root App Router ----------------------------- */
function AppInner() {
  const theme = useTheme();
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const { user } = await AuthService.loadSession(); // { token, user }
      setRole(user?.role || 'surveyor'); // "admin" or "surveyor"
    } catch {
      setRole('surveyor');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (checking) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.background
      }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <RootStack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}  // << hide ALL headers in RootStack
    >
      {/* Public */}
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Register" component={RegisterScreen} />
      <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <RootStack.Screen name="VerifyReset" component={VerifyResetScreen} />

      {/* Main = Tabs shell (bottom bar) */}
      <RootStack.Screen name="Main">
        {() => <Tabs role={role} />}
      </RootStack.Screen>

      {/* Bridges to preserve tab bar */}
      <RootStack.Screen name="Surveys" component={BridgeToSurveys} />
      <RootStack.Screen name="SurveyForm" component={BridgeToSurveyForm} />
      <RootStack.Screen name="CompletedSurveys" component={BridgeToCompleted} />
      <RootStack.Screen name="SurveyResponsesList" component={BridgeToResponsesList} />
      <RootStack.Screen name="SubmissionDetails" component={BridgeToSubmissionDetails} />
      <RootStack.Screen name="Profile" component={BridgeToProfile} />

      {/* NEW: Optional deep-link bridge to admin completed list */}
      <RootStack.Screen name="AdminCompletedSurveys" component={BridgeToAdminCompleted} />
    </RootStack.Navigator>
  );
}

/* --------------------------------- Export --------------------------------- */
export default function App() {

  useEffect(() => {
    startOfflineSync(); // begin listening; will run when connectivity returns
  }, []);

  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppInner />
      </NavigationContainer>
    </ThemeProvider>
  );
}
