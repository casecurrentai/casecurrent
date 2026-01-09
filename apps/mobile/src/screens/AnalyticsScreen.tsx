import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../services/api";
import type { AnalyticsSummary } from "../types";

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [range, setRange] = useState<"7d" | "30d">("7d");

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const data = await api.analytics.getSummary(range);
      setSummary(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

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
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.rangePicker}>
          <TouchableOpacity
            style={[styles.rangeButton, range === "7d" && styles.rangeButtonActive]}
            onPress={() => setRange("7d")}
            testID="button-range-7d"
          >
            <Text style={[styles.rangeText, range === "7d" && styles.rangeTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeButton, range === "30d" && styles.rangeButtonActive]}
            onPress={() => setRange("30d")}
            testID="button-range-30d"
          >
            <Text style={[styles.rangeText, range === "30d" && styles.rangeTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor="#6366f1"
          />
        }
      >
        {summary && (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                title="Captured Leads"
                value={summary.capturedLeads}
                subtitle="Total new leads"
              />
              <MetricCard
                title="Missed Call Recovery"
                value={summary.missedCallRecovery}
                subtitle="From missed calls"
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Qualified Rate"
                value={`${summary.qualifiedRate}%`}
                subtitle={`${summary.qualifiedCount} qualified`}
              />
              <MetricCard
                title="Consult Booked"
                value={`${summary.consultBookedRate}%`}
                subtitle={`${summary.consultBookedCount} booked`}
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Median Response"
                value={`${summary.medianResponseMinutes}m`}
                subtitle="Time to first contact"
              />
              <MetricCard
                title="P90 Response"
                value={`${summary.p90ResponseMinutes}m`}
                subtitle="90th percentile"
              />
            </View>

            {summary.afterHoursConversionRate !== null && (
              <View style={styles.metricsRow}>
                <MetricCard
                  title="After-Hours Conversion"
                  value={`${summary.afterHoursConversionRate}%`}
                  subtitle="Leads outside business hours"
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  rangePicker: {
    flexDirection: "row",
    gap: 8,
  },
  rangeButton: {
    backgroundColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rangeButtonActive: {
    backgroundColor: "#6366f1",
  },
  rangeText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  rangeTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  metricTitle: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
});
