import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  testID?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: colors.primaryLight, text: colors.primary },
  success: { bg: "#DCFCE7", text: "#15803D" },
  warning: { bg: "#FEF3C7", text: "#B45309" },
  error: { bg: "#FEE2E2", text: "#DC2626" },
  muted: { bg: colors.surface, text: colors.textSecondary },
};

export function Badge({ children, variant = "primary", testID }: BadgeProps) {
  const style = variantStyles[variant];
  
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]} testID={testID}>
      <Text style={[styles.text, { color: style.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
