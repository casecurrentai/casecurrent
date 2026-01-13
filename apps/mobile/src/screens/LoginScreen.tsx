import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, setOrgContext } from "../services/api";
import { colors } from "../theme/colors";

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
              <Pressable
                style={({ pressed }) => [
                  styles.firmRow,
                  pressed && styles.firmRowPressed,
                ]}
                onPress={() => handleFirmSelect(item)}
                testID={`firm-select-${item.id}`}
              >
                <Text style={styles.firmName}>{item.name}</Text>
                <Text style={styles.firmArrow}>→</Text>
              </Pressable>
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
        <Image
          source={require("../../assets/brand/casecurrent-mark-whitebg.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>CaseCurrent</Text>
        <Text style={styles.subtitle}>Law Firm Operations</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="input-password"
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            testID="button-login"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  firmRowPressed: {
    backgroundColor: colors.border,
  },
  firmName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  firmArrow: {
    color: colors.primary,
    fontSize: 18,
  },
  backButton: {
    marginTop: 24,
    padding: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
