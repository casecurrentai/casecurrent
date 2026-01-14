import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../services/api";
import { disconnectRealtime } from "../services/realtime";

interface SettingsScreenProps {
  onLogout: () => void;
  userRole?: string;
}

interface SettingRowProps {
  label: string;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  subtitle?: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface OnCallUser {
  userId: string | null;
  name: string | null;
  email: string | null;
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

export default function SettingsScreen({ onLogout, userRole = "staff" }: SettingsScreenProps) {
  const [hotLeadsNotif, setHotLeadsNotif] = useState(true);
  const [inboundSmsNotif, setInboundSmsNotif] = useState(true);
  const [slaBreachNotif, setSlaBreachNotif] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // On-call state
  const [onCallUser, setOnCallUser] = useState<OnCallUser | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [isLoadingOnCall, setIsLoadingOnCall] = useState(true);
  const [isSavingOnCall, setIsSavingOnCall] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "owner";

  useEffect(() => {
    loadOnCallData();
  }, []);

  async function loadOnCallData() {
    setIsLoadingOnCall(true);
    try {
      const [onCall, users] = await Promise.all([
        api.oncall.get(),
        isAdmin ? api.org.getUsers() : Promise.resolve([]),
      ]);
      setOnCallUser(onCall);
      setOrgUsers(users);
    } catch (error) {
      console.error("Failed to load on-call data:", error);
    } finally {
      setIsLoadingOnCall(false);
    }
  }

  async function handleSetOnCall(userId: string | null) {
    setIsSavingOnCall(true);
    setShowUserPicker(false);
    try {
      const result = await api.oncall.set(userId);
      setOnCallUser(result);
    } catch (error) {
      Alert.alert("Error", "Failed to update on-call user");
      console.error("Failed to set on-call:", error);
    } finally {
      setIsSavingOnCall(false);
    }
  }

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

  function renderUserPickerModal() {
    return (
      <Modal
        visible={showUserPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select On-Call User</Text>
              <TouchableOpacity
                onPress={() => setShowUserPicker(false)}
                testID="button-close-picker"
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={[{ id: null, name: "None (Notify all admins)", email: "", role: "" }, ...orgUsers]}
              keyExtractor={(item) => item.id || "none"}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userItem,
                    onCallUser?.userId === item.id && styles.userItemSelected,
                  ]}
                  onPress={() => handleSetOnCall(item.id)}
                  testID={`button-select-user-${item.id || "none"}`}
                >
                  <View>
                    <Text style={styles.userName}>{item.name}</Text>
                    {item.email ? (
                      <Text style={styles.userEmail}>{item.email}</Text>
                    ) : null}
                  </View>
                  {onCallUser?.userId === item.id && (
                    <Text style={styles.checkmark}>Selected</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* On-Call Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>On-Call Routing</Text>
          <Text style={styles.sectionDescription}>
            Incoming calls will be routed to the on-call user
          </Text>

          {isLoadingOnCall ? (
            <ActivityIndicator size="small" color="#1764FE" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.onCallContainer}>
              <View style={styles.onCallInfo}>
                <Text style={styles.onCallLabel}>Current On-Call</Text>
                <Text style={styles.onCallValue}>
                  {onCallUser?.name || "Not set (all admins notified)"}
                </Text>
                {onCallUser?.email && (
                  <Text style={styles.onCallEmail}>{onCallUser.email}</Text>
                )}
              </View>

              {isAdmin && (
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setShowUserPicker(true)}
                  disabled={isSavingOnCall}
                  testID="button-change-oncall"
                >
                  {isSavingOnCall ? (
                    <ActivityIndicator size="small" color="#1764FE" />
                  ) : (
                    <Text style={styles.changeButtonText}>Change</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

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

      {renderUserPickerModal()}
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#64748B",
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
  // On-Call Styles
  onCallContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  onCallInfo: {
    flex: 1,
  },
  onCallLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  onCallValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  onCallEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  changeButton: {
    backgroundColor: "#1764FE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  changeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
  },
  modalClose: {
    fontSize: 16,
    color: "#1764FE",
    fontWeight: "500",
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  userItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0F172A",
  },
  userEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  checkmark: {
    color: "#1764FE",
    fontWeight: "600",
    fontSize: 14,
  },
});
