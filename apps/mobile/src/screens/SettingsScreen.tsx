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
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { disconnectRealtime } from "../services/realtime";
import { colors } from "../theme/colors";

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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.background}
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
                  activeOpacity={0.7}
                  testID={`button-select-user-${item.id || "none"}`}
                >
                  <View>
                    <Text style={styles.userName}>{item.name}</Text>
                    {item.email ? (
                      <Text style={styles.userEmail}>{item.email}</Text>
                    ) : null}
                  </View>
                  {onCallUser?.userId === item.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>On-Call Routing</Text>
          <Text style={styles.sectionDescription}>
            Incoming calls will be routed to the on-call user
          </Text>

          {isLoadingOnCall ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
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
                  activeOpacity={0.7}
                  testID="button-change-oncall"
                >
                  {isSavingOnCall ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.changeButtonText}>Change</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.divider} />

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

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firm Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timezone</Text>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>America/New_York</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
            testID="button-logout"
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
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
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  sectionTitle: {
    fontSize: 12,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: "600",
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
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
    color: colors.textPrimary,
    fontWeight: "500",
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  infoBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  infoBadgeText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 14,
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
    color: colors.textMuted,
    fontSize: 12,
  },
  onCallContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  onCallInfo: {
    flex: 1,
  },
  onCallLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  onCallValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  onCallEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  changeButtonText: {
    color: colors.background,
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
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
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "500",
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  userItemSelected: {
    backgroundColor: colors.primaryTint,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
