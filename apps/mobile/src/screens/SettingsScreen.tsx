import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../services/api";
import { disconnectRealtime } from "../services/realtime";

interface SettingsScreenProps {
  onLogout: () => void;
}

interface SettingRowProps {
  label: string;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  subtitle?: string;
}

function SettingRow({ label, value, onToggle, subtitle }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {onToggle !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: "#374151", true: "#6366f1" }}
          thumbColor="#fff"
        />
      )}
    </View>
  );
}

export default function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const [hotLeadsNotif, setHotLeadsNotif] = useState(true);
  const [inboundSmsNotif, setInboundSmsNotif] = useState(true);
  const [slaBreachNotif, setSlaBreachNotif] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            disconnectRealtime();
            await api.auth.logout();
          } catch (error) {
          } finally {
            setIsLoggingOut(false);
            onLogout();
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SettingRow
            label="Hot Leads"
            subtitle="Notify when high-score lead captured"
            value={hotLeadsNotif}
            onToggle={setHotLeadsNotif}
          />
          <SettingRow
            label="Inbound SMS"
            subtitle="Notify on new messages"
            value={inboundSmsNotif}
            onToggle={setInboundSmsNotif}
          />
          <SettingRow
            label="SLA Breaches"
            subtitle="Alert when lead uncontacted too long"
            value={slaBreachNotif}
            onToggle={setSlaBreachNotif}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firm Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timezone</Text>
            <Text style={styles.infoValue}>America/New_York</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
            testID="button-logout"
          >
            <Text style={styles.logoutText}>
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>CaseCurrent v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  sectionTitle: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  settingSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: "#9ca3af",
  },
  infoValue: {
    fontSize: 16,
    color: "#fff",
  },
  logoutButton: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#fca5a5",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 12,
  },
});
