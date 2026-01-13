import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, setOrgContext } from "../services/api";

interface Firm {
  id: string;
  name: string;
}

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [showFirmPicker, setShowFirmPicker] = useState(false);
  const [isLoadingFirms, setIsLoadingFirms] = useState(false);
  const [loginStep, setLoginStep] = useState<"credentials" | "firm">("credentials");

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.auth.login(email.trim(), password);
      
      if (result.organizations && result.organizations.length > 1) {
        setFirms(result.organizations);
        setLoginStep("firm");
      } else if (result.organizations && result.organizations.length === 1) {
        await setOrgContext(result.organizations[0].id);
        onLoginSuccess();
      } else {
        onLoginSuccess();
      }
    } catch (error) {
      Alert.alert("Login Failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFirmSelect(firm: Firm) {
    setSelectedFirm(firm);
    setShowFirmPicker(false);
    try {
      await setOrgContext(firm.id);
      onLoginSuccess();
    } catch (error) {
      Alert.alert("Error", "Failed to select firm");
    }
  }

  if (loginStep === "firm") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Select Your Firm</Text>
          <Text style={styles.subtitle}>You have access to multiple firms</Text>

          <FlatList
            data={firms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.firmRow}
                onPress={() => handleFirmSelect(item)}
                testID={`firm-select-${item.id}`}
              >
                <Text style={styles.firmName}>{item.name}</Text>
                <Text style={styles.firmArrow}>→</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.firmList}
          />

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setLoginStep("credentials")}
            testID="button-back"
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>CaseCurrent</Text>
        <Text style={styles.subtitle}>Law Firm Operations</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="input-password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            testID="button-login"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#374151",
  },
  button: {
    backgroundColor: "#57A6D5",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  firmList: {
    marginTop: 24,
  },
  firmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  firmName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  firmArrow: {
    color: "#57A6D5",
    fontSize: 18,
  },
  backButton: {
    marginTop: 24,
    padding: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#9ca3af",
    fontSize: 14,
  },
});
