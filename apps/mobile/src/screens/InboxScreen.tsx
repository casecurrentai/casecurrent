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
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../services/api";
import { addRealtimeListener } from "../services/realtime";
import { colors } from "../theme/colors";
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
    case "new": return colors.statusNew;
    case "engaged": return colors.statusEngaged;
    case "intake_started": return colors.statusIntake;
    case "intake_complete": return colors.success;
    case "qualified": return colors.statusQualified;
    default: return colors.statusDefault;
  }
}

function LeadRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const isHot = (lead.score || 0) >= 70;
  const isOverdue = lead.status === "new" && lead.lastActivityAt && 
    (Date.now() - new Date(lead.lastActivityAt).getTime()) > 15 * 60 * 1000;

  return (
    <TouchableOpacity
      style={[styles.leadRow, isOverdue ? styles.overdueRow : undefined]}
      onPress={onPress}
      activeOpacity={0.7}
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
            <Text style={styles.statusText}>{lead.status.replace(/_/g, " ").toUpperCase()}</Text>
          </View>
          {lead.practiceArea && (
            <View style={styles.practiceAreaBadge}>
              <Text style={styles.practiceAreaText}>{lead.practiceArea.name}</Text>
            </View>
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
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
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
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
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
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  leadRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overdueRow: {
    borderColor: colors.error,
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
    color: colors.textPrimary,
  },
  hotBadge: {
    backgroundColor: colors.error,
    color: colors.background,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  dncBadge: {
    backgroundColor: colors.statusDefault,
    color: colors.background,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  leadPhone: {
    fontSize: 14,
    color: colors.textSecondary,
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
    color: colors.background,
    fontSize: 10,
    fontWeight: "bold",
  },
  practiceAreaBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  practiceAreaText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "500",
  },
  leadSummary: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  leadRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  leadAge: {
    color: colors.textMuted,
    fontSize: 12,
  },
  leadScore: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
});
