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
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import type { AnalyticsSummary } from "../types";

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        {icon && (
          <View style={styles.metricIconContainer}>
            <Ionicons name={icon} size={16} color={colors.primary} />
          </View>
        )}
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
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
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
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
            activeOpacity={0.7}
            testID="button-range-7d"
          >
            <Text style={[styles.rangeText, range === "7d" && styles.rangeTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeButton, range === "30d" && styles.rangeButtonActive]}
            onPress={() => setRange("30d")}
            activeOpacity={0.7}
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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {summary ? (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                title="Captured Leads"
                value={summary.capturedLeads}
                subtitle="Total new leads"
                icon="person-add-outline"
              />
              <MetricCard
                title="Missed Recovery"
                value={summary.missedCallRecovery}
                subtitle="From missed calls"
                icon="call-outline"
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Qualified Rate"
                value={`${summary.qualifiedRate}%`}
                subtitle={`${summary.qualifiedCount} qualified`}
                icon="checkmark-circle-outline"
              />
              <MetricCard
                title="Consult Booked"
                value={`${summary.consultBookedRate}%`}
                subtitle={`${summary.consultBookedCount} booked`}
                icon="calendar-outline"
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Median Response"
                value={`${summary.medianResponseMinutes}m`}
                subtitle="Time to first contact"
                icon="time-outline"
              />
              <MetricCard
                title="P90 Response"
                value={`${summary.p90ResponseMinutes}m`}
                subtitle="90th percentile"
                icon="speedometer-outline"
              />
            </View>

            {summary.afterHoursConversionRate !== null && (
              <View style={styles.metricsRow}>
                <MetricCard
                  title="After-Hours Conversion"
                  value={`${summary.afterHoursConversionRate}%`}
                  subtitle="Leads outside business hours"
                  icon="moon-outline"
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No data available</Text>
            <Text style={styles.emptyText}>Analytics will appear once leads come in</Text>
          </View>
        )}
      </ScrollView>
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
    marginBottom: 12,
  },
  rangePicker: {
    flexDirection: "row",
    gap: 8,
  },
  rangeButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rangeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  rangeTextActive: {
    color: colors.background,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 8,
  },
  metricSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
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
