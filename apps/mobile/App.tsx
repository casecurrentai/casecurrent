import React, { useEffect, useState, useCallback } from "react";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeAuth, getAuthToken, clearAuthToken } from "./src/services/api";
import { connectRealtime, disconnectRealtime } from "./src/services/realtime";
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

  useEffect(() => {
    async function init() {
      const token = await initializeAuth();
      setIsAuthenticated(!!token);
      setIsLoading(false);
      if (token) {
        connectRealtime();
      }
    }
    init();

    return () => {
      disconnectRealtime();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    disconnectRealtime();
    await clearAuthToken();
    setIsAuthenticated(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    connectRealtime();
  }, []);

  function MainTabs() {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#6366f1",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: {
            backgroundColor: "#1f2937",
            borderTopColor: "#374151",
          },
        }}
      >
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{ tabBarLabel: "Inbox" }}
        />
        <Tab.Screen
          name="Leads"
          component={LeadsScreen}
          options={{ tabBarLabel: "Leads" }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ tabBarLabel: "Analytics" }}
        />
        <Tab.Screen name="Settings" options={{ tabBarLabel: "Settings" }}>
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
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#1f2937" },
            headerTintColor: "#fff",
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
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
