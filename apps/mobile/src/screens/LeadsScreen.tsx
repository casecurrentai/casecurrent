import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../services/api";
import type { Lead } from "../types";
import type { RootStackParamList } from "../../App";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const statusFilters = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "engaged", label: "Engaged" },
  { value: "intake_started", label: "Intake" },
  { value: "qualified", label: "Qualified" },
  { value: "consult_set", label: "Consult Set" },
];

export default function LeadsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchLeads = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const params: { q?: string; status?: string } = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (statusFilter) params.status = statusFilter;
      const result = await api.leads.list(params);
      setLeads(result);
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchLeads();
    }, [fetchLeads])
  );

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.contact?.name?.toLowerCase().includes(query) ||
      lead.contact?.primaryPhone?.includes(query)
    );
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leads</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="input-search"
        />
        <View style={styles.filterRow}>
          {statusFilters.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                statusFilter === filter.value && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
              testID={`filter-${filter.value || "all"}`}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === filter.value && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.leadRow}
            onPress={() => navigation.navigate("LeadDetail", { leadId: item.id })}
            testID={`lead-row-${item.id}`}
          >
            <View style={styles.leadInfo}>
              <Text style={styles.leadName}>{item.contact?.name || "Unknown"}</Text>
              <Text style={styles.leadPhone}>{item.contact?.primaryPhone || "No phone"}</Text>
            </View>
            <View style={styles.leadMeta}>
              <Text style={styles.statusText}>{item.status}</Text>
              {item.score !== undefined && item.score > 0 && (
                <Text style={styles.scoreText}>{item.score}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchLeads(true)}
            tintColor="#6366f1"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        }
      />
    </SafeAreaView>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    backgroundColor: "#374151",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterButtonActive: {
    backgroundColor: "#6366f1",
  },
  filterText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#fff",
  },
  listContent: {
    padding: 12,
  },
  leadRow: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  leadPhone: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  leadMeta: {
    alignItems: "flex-end",
  },
  statusText: {
    color: "#6b7280",
    fontSize: 12,
    textTransform: "uppercase",
  },
  scoreText: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
  },
});
