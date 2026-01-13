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
          trackColor={{ false: "#E5E7EB", true: "#1764FE" }}
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
    backgroundColor: "#FFFFFF",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F172A",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 12,
    color: "#475569",
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
    color: "#0F172A",
    fontWeight: "500",
  },
  settingSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: "#475569",
  },
  infoValue: {
    fontSize: 16,
    color: "#0F172A",
  },
  logoutButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#94A3B8",
    fontSize: 12,
  },
});
