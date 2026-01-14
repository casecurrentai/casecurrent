import React, { useEffect, useState, useCallback, useRef } from "react";
import { NavigationContainer, LinkingOptions, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { initializeAuth, getAuthToken, clearAuthToken } from "./src/services/api";
import { connectRealtime, disconnectRealtime } from "./src/services/realtime";
import {
  registerForPushNotifications,
  registerDeviceWithServer,
  addNotificationResponseListener,
  type NotificationData,
} from "./src/services/pushNotifications";
import LoginScreen from "./src/screens/LoginScreen";
import InboxScreen from "./src/screens/InboxScreen";
import LeadsScreen from "./src/screens/LeadsScreen";
import LeadDetailScreen from "./src/screens/LeadDetailScreen";
import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  LeadDetail: { leadId: string };
};

export type MainTabParamList = {
  Inbox: undefined;
  Leads: undefined;
  Analytics: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["casecurrent://", "https://casecurrent.co"],
  config: {
    screens: {
      Main: {
        screens: {
          Inbox: "inbox",
          Leads: "leads",
          Analytics: "analytics",
          Settings: "settings",
        },
      },
      LeadDetail: "lead/:leadId",
    },
  },
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  const getDeviceId = useCallback(async (): Promise<string> => {
    if (Platform.OS === 'android') {
      return Application.getAndroidId() || 'android-unknown';
    }
    const iosId = await Application.getIosIdForVendorAsync();
    return iosId || 'ios-unknown';
  }, []);

  const setupPushNotifications = useCallback(async () => {
    const token = await registerForPushNotifications();
    if (token) {
      const deviceId = await getDeviceId();
      await registerDeviceWithServer(deviceId);
    }
  }, [getDeviceId]);

  useEffect(() => {
    async function init() {
      const token = await initializeAuth();
      setIsAuthenticated(!!token);
      setIsLoading(false);
      if (token) {
        connectRealtime();
        setupPushNotifications();
      }
    }
    init();

    return () => {
      disconnectRealtime();
    };
  }, [setupPushNotifications]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((data: NotificationData) => {
      if (data.leadId && navigationRef.current) {
        navigationRef.current.navigate('LeadDetail', { leadId: data.leadId });
      }
    });

    return () => subscription.remove();
  }, []);

  const handleLogout = useCallback(async () => {
    disconnectRealtime();
    await clearAuthToken();
    setIsAuthenticated(false);
  }, []);

  const handleLoginSuccess = useCallback(async () => {
    setIsAuthenticated(true);
    connectRealtime();
    await setupPushNotifications();
  }, [setupPushNotifications]);

  function MainTabs() {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#57A6D5",
          tabBarInactiveTintColor: "#475569",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E5E7EB",
          },
        }}
      >
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{
            tabBarLabel: "Inbox",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="mail" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Leads"
          component={LeadsScreen}
          options={{
            tabBarLabel: "Leads",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{
            tabBarLabel: "Analytics",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          options={{
            tabBarLabel: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        >
          {(props) => <SettingsScreen {...props} onLogout={handleLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  if (isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0F172A",
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen
              name="Login"
              options={{ headerShown: false }}
            >
              {(props) => (
                <LoginScreen
                  {...props}
                  onLoginSuccess={handleLoginSuccess}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="LeadDetail"
                component={LeadDetailScreen}
                options={{ title: "Lead Details" }}
              />
            </>
          )}
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
