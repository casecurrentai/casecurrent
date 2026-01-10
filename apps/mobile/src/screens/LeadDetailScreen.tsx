import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { api } from "../services/api";
import { addRealtimeListener } from "../services/realtime";
import type { Lead, ThreadItem, RealtimeEvent } from "../types";
import type { RootStackParamList } from "../../App";

type RouteParams = RouteProp<RootStackParamList, "LeadDetail">;

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ThreadItemRow({ item }: { item: ThreadItem }) {
  const isInbound = item.type.includes("received") || item.type.includes("inbound");
  const isCall = item.type.includes("call");
  const isSystem = item.type.includes("system");

  return (
    <View
      style={[
        styles.threadItem,
        isInbound && styles.threadItemInbound,
        isSystem && styles.threadItemSystem,
      ]}
    >
      <Text style={styles.threadType}>
        {isCall ? "CALL" : isSystem ? "SYSTEM" : "SMS"} {item.type.split(".").pop()?.toUpperCase()}
      </Text>
      <Text style={styles.threadSummary}>{item.summary}</Text>
      <Text style={styles.threadTime}>{formatTime(item.timestamp)}</Text>
    </View>
  );
}

export default function LeadDetailScreen() {
  const route = useRoute<RouteParams>();
  const { leadId } = route.params;

  const [lead, setLead] = useState<Lead | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [leadData, threadData] = await Promise.all([
        api.leads.get(leadId),
        api.leads.getThread(leadId),
      ]);
      setLead(leadData);
      setThread(threadData.items);
    } catch (error) {
      console.error("Failed to fetch lead:", error);
      Alert.alert("Error", "Failed to load lead details");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchData();
    const unsubscribe = addRealtimeListener((event: RealtimeEvent) => {
      if (event.leadId === leadId) {
        fetchData();
      }
    });
    return unsubscribe;
  }, [fetchData, leadId]);

  async function handleSendSms() {
    if (!message.trim() || !lead) return;
    if (lead.dnc) {
      Alert.alert("DNC", "This lead is on the Do Not Contact list");
      return;
    }

    setIsSending(true);
    try {
      await api.messaging.sendSms(leadId, message.trim());
      setMessage("");
      fetchData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  }

  async function handleCall() {
    if (!lead) return;
    
    try {
      const { dialTo } = await api.calls.start(leadId);
      
      const cleanNumber = dialTo.replace(/[^0-9+]/g, '');
      
      let url = '';
      if (Platform.OS === 'android') {
        url = `tel:${cleanNumber}`;
      } else {
        url = `telprompt:${cleanNumber}`;
      }

      await Linking.openURL(url);

    } catch (error) {
      console.error("Call failed", error);
      Alert.alert(
        "Call Failed", 
        "Your device could not make this call. Please check your signal or device settings."
      );
    }
  }

  async function handleSendIntakeLink() {
    if (!lead) return;
    try {
      const { intakeLink } = await api.intake.generateLink(leadId);
      await Share.share({ message: intakeLink });
      fetchData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to generate link");
    }
  }

  function getPrimaryAction(): { label: string; action: () => void; disabled?: boolean } | null {
    if (!lead) return null;
    switch (lead.status) {
      case "new":
        return { label: "Contact Now", action: handleCall };
      case "engaged":
        return { label: "Send Intake Link", action: handleSendIntakeLink };
      case "intake_started":
        return { label: "Continue Intake", action: handleSendIntakeLink };
      case "intake_complete":
        return { label: "Run Qualification", action: () => Alert.alert("Coming Soon") };
      case "qualified":
        return { label: "Schedule Consult", action: () => Alert.alert("Coming Soon"), disabled: true };
      default:
        return null;
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Lead not found</Text>
      </SafeAreaView>
    );
  }

  const primaryAction = getPrimaryAction();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.leadName}>{lead.contact?.name || "Unknown"}</Text>
          <Text style={styles.leadPhone}>{lead.contact?.primaryPhone || "No phone"}</Text>
          <View style={styles.badges}>
            <Text style={styles.statusBadge}>{lead.status.toUpperCase()}</Text>
            {lead.dnc && <Text style={styles.dncBadge}>DNC</Text>}
            {lead.score !== undefined && lead.score > 0 && (
              <Text style={styles.scoreBadge}>Score: {lead.score}</Text>
            )}
          </View>
        </View>

        {primaryAction && (
          <TouchableOpacity
            style={[styles.primaryButton, primaryAction.disabled && styles.buttonDisabled]}
            onPress={primaryAction.action}
            disabled={primaryAction.disabled}
            testID="button-primary-action"
          >
            <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCall} testID="button-call">
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, lead.dnc && styles.buttonDisabled]}
          onPress={() => {}}
          disabled={lead.dnc}
          testID="button-text"
        >
          <Text style={styles.actionButtonText}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleSendIntakeLink} testID="button-intake">
          <Text style={styles.actionButtonText}>Intake Link</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={thread}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThreadItemRow item={item} />}
        contentContainerStyle={styles.threadList}
        inverted
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activity yet</Text>
          </View>
        }
      />

      {!lead.dnc && (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={message}
            onChangeText={setMessage}
            multiline
            testID="input-message"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || isSending) && styles.buttonDisabled]}
            onPress={handleSendSms}
            disabled={!message.trim() || isSending}
            testID="button-send"
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {lead.dnc && (
        <View style={styles.dncBanner}>
          <Text style={styles.dncBannerText}>
            This lead is on the Do Not Contact list. Outbound messaging is disabled.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginTop: 48,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerInfo: {
    marginBottom: 12,
  },
  leadName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  leadPhone: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 4,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dncBadge: {
    backgroundColor: "#6b7280",
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scoreBadge: {
    backgroundColor: "#6366f1",
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  threadList: {
    padding: 12,
    flexGrow: 1,
  },
  threadItem: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  threadItemInbound: {
    alignSelf: "flex-start",
    backgroundColor: "#374151",
  },
  threadItemSystem: {
    alignSelf: "center",
    backgroundColor: "#1f2937",
    opacity: 0.8,
  },
  threadType: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "600",
  },
  threadSummary: {
    fontSize: 14,
    color: "#fff",
    marginTop: 4,
  },
  threadTime: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "right",
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
  composer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    gap: 8,
    alignItems: "flex-end",
  },
  composerInput: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#6366f1",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dncBanner: {
    backgroundColor: "#7f1d1d",
    padding: 12,
  },
  dncBannerText: {
    color: "#fca5a5",
    fontSize: 12,
    textAlign: "center",
  },
});
