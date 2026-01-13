import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../services/api";
import { addRealtimeListener } from "../services/realtime";
import type { Lead, RealtimeEvent } from "../types";
import type { RootStackParamList } from "../../App";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "new": return "#ef4444";
    case "engaged": return "#f59e0b";
    case "intake_started": return "#3b82f6";
    case "intake_complete": return "#10b981";
    case "qualified": return "#22c55e";
    default: return "#6b7280";
  }
}

function LeadRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const isHot = (lead.score || 0) >= 70;
  const isOverdue = lead.status === "new" && lead.lastActivityAt && 
    (Date.now() - new Date(lead.lastActivityAt).getTime()) > 15 * 60 * 1000;

  return (
    <TouchableOpacity
      style={[styles.leadRow, isOverdue && styles.overdueRow]}
      onPress={onPress}
      testID={`lead-row-${lead.id}`}
    >
      <View style={styles.leadInfo}>
        <View style={styles.leadHeader}>
          <Text style={styles.leadName}>{lead.contact?.name || "Unknown"}</Text>
          {isHot && <Text style={styles.hotBadge}>HOT</Text>}
          {lead.dnc && <Text style={styles.dncBadge}>DNC</Text>}
        </View>
        <Text style={styles.leadPhone}>{lead.contact?.primaryPhone || "No phone"}</Text>
        <View style={styles.leadMeta}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) }]}>
            <Text style={styles.statusText}>{lead.status.toUpperCase()}</Text>
          </View>
          {lead.practiceArea && (
            <Text style={styles.practiceArea}>{lead.practiceArea.name}</Text>
          )}
        </View>
        {lead.summary && (
          <Text style={styles.leadSummary} numberOfLines={1}>{lead.summary}</Text>
        )}
      </View>
      <View style={styles.leadRight}>
        <Text style={styles.leadAge}>{formatTimeAgo(lead.createdAt)}</Text>
        {lead.score !== undefined && lead.score > 0 && (
          <Text style={styles.leadScore}>{lead.score}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function InboxScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLeads = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const allLeads = await api.leads.list();
      const prioritizedLeads = allLeads
        .filter(l => ["new", "engaged", "intake_started"].includes(l.status))
        .sort((a, b) => {
          const aHot = (a.score || 0) >= 70 ? 1 : 0;
          const bHot = (b.score || 0) >= 70 ? 1 : 0;
          if (aHot !== bHot) return bHot - aHot;
          const aNew = a.status === "new" ? 1 : 0;
          const bNew = b.status === "new" ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      setLeads(prioritizedLeads);
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const unsubscribe = addRealtimeListener((event: RealtimeEvent) => {
      if (event.type === "lead.created" || event.type === "lead.updated" || event.type === "sms.received") {
        fetchLeads();
      }
    });
    return unsubscribe;
  }, [fetchLeads]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1764FE" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <Text style={styles.headerSubtitle}>{leads.length} leads need attention</Text>
      </View>

      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LeadRow
            lead={item}
            onPress={() => navigation.navigate("LeadDetail", { leadId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchLeads(true)}
            tintColor="#1764FE"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No leads need attention</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
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
  headerSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
  },
  listContent: {
    padding: 12,
  },
  leadRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  overdueRow: {
    borderColor: "#EF4444",
    borderWidth: 2,
  },
  leadInfo: {
    flex: 1,
  },
  leadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  hotBadge: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dncBadge: {
    backgroundColor: "#6B7280",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leadPhone: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
  },
  leadMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  practiceArea: {
    color: "#475569",
    fontSize: 12,
  },
  leadSummary: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  leadRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  leadAge: {
    color: "#94A3B8",
    fontSize: 12,
  },
  leadScore: {
    color: "#1764FE",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 16,
  },
});
