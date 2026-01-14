import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

interface DividerProps {
  spacing?: number;
}

export function Divider({ spacing = 0 }: DividerProps) {
  return (
    <View 
      style={[
        styles.divider, 
        spacing > 0 && { marginVertical: spacing }
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
