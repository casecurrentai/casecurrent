import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  AppState,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../services/api"; 
import type { Lead } from "../types";

type TelephonyStatus = {
  provider: "twilio" | "plivo";
  voiceEnabled: boolean;
  smsEnabled: boolean;
};

type ActiveCall = {
  callId: string;      // Internal DB ID
  provider: string;
  dialTo: string;
  startedAt: number;
};

export default function LeadDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { leadId } = route.params || {};

  // Data State
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  // Telephony "Sanity Check" State
  const [telephonyStatus, setTelephonyStatus] = useState<TelephonyStatus | null>(null);

  // Call Lifecycle State
  const appState = useRef(AppState.currentState);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  
  // Modal Form State
  const [callNotes, setCallNotes] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [checkingCallStatus, setCheckingCallStatus] = useState(false);

  // 1. Initial Data Load & Provider Sanity Check
  useEffect(() => {
    loadData();
  }, [leadId]);

  async function loadData() {
    try {
      if (!leadId) return;
      
      // Parallel fetch: Get Lead AND Provider Status
      const [leadData, telStatus] = await Promise.all([
        api.leads.get(leadId),
        // Wrap in try/catch in case endpoint doesn't exist yet
        api.telephony?.status().catch(() => null) 
      ]);

      setLead(leadData);
      setTelephonyStatus(telStatus);
      
      if (telStatus) {
        console.log("Telephony Provider:", telStatus.provider);
      }
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }

  // 2. AppState Listener: Poll status on return
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        activeCall // Only check if we actually started a call
      ) {
        resolveCallBeforePrompt();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [activeCall]);

  // 3. Poll Logic: Did the call actually finish?
  async function resolveCallBeforePrompt() {
    if (!activeCall) return;
    setCheckingCallStatus(true);

    try {
      // Poll your backend for the specific call status
      // If endpoint doesn't exist yet, we fall back to showing modal immediately
      const callData = await api.calls.get(activeCall.callId).catch(() => null);

      if (!callData) {
        // Fallback: Backend didn't return data, show modal to be safe
        setShowOutcomeModal(true);
      } else {
        // Only show modal if call is terminal
        const terminalStatuses = ["completed", "failed", "busy", "no-answer", "canceled"];
        if (terminalStatuses.includes(callData.status)) {
          setShowOutcomeModal(true);
        } else {
          // Call is likely still "ringing" or "in-progress"
          // In a real app, you might show a "Call in Progress" banner here
          // For now, we will still show the modal but user can cancel out
          setShowOutcomeModal(true);
        }
      }
    } catch (error) {
      // Safety net
      setShowOutcomeModal(true);
    } finally {
      setActiveCall(null); // Clear the active call flag
      setCheckingCallStatus(false);
    }
  }

  // 4. Handle Call Start
  async function handleCall() {
    if (!lead) return;

    try {
      // Start call on backend
      // We expect response: { dialTo, provider, callId }
      const response = await api.calls.start(lead.id);
      
      const { dialTo, provider, callId } = response;

      // SANITY CHECK: Warn if provider mismatch during migration
      if (telephonyStatus?.provider && provider !== telephonyStatus.provider) {
        Alert.alert("Warning", `Provider Mismatch: Expected ${telephonyStatus.provider}, got ${provider}`);
      }

      const url = `tel:${dialTo}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        // Track this specific call attempt
        setActiveCall({
          callId: callId || "temp-id", // Fallback if backend not updated yet
          provider: provider || "unknown",
          dialTo,
          startedAt: Date.now()
        });
        
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to open phone dialer");
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to start call");
      setActiveCall(null);
    }
  }

  // 5. Submit Manual Outcome
  async function handleSubmitOutcome(outcome: string) {
    setSavingOutcome(true);
    try {
      await api.calls.logOutcome({
        leadId: lead?.id,
        outcome, 
        notes: callNotes
      });
      
      Alert.alert("Success", "Call logged successfully");
      setShowOutcomeModal(false);
      setCallNotes("");
      loadData(); // Refresh lead status
    } catch (error) {
      Alert.alert("Error", "Failed to save call log");
    } finally {
      setSavingOutcome(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Lead not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Provider Sanity Banner (Visible only during migration dev) */}
        {telephonyStatus && (
          <View style={styles.debugBanner}>
            <Text style={styles.debugText}>
              System: {telephonyStatus.provider.toUpperCase()} | Voice: {telephonyStatus.voiceEnabled ? 'ON' : 'OFF'}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.leadName}>{lead.contact?.name || "Unknown"}</Text>
          <Text style={styles.leadStatus}>{lead.status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{lead.contact?.primaryPhone || "No phone"}</Text>
        </View>

        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Text style={styles.callButtonText}>📞 Call Lead</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- CALL OUTCOME MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOutcomeModal || checkingCallStatus}
        onRequestClose={() => { if (!checkingCallStatus) setShowOutcomeModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {checkingCallStatus ? (
              <View style={{padding: 20, alignItems: 'center'}}>
                <ActivityIndicator color="#4F46E5" />
                <Text style={{marginTop: 10, color: '#6B7280'}}>Checking call status...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>How did the call go?</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Add call notes (optional)..."
                  value={callNotes}
                  onChangeText={setCallNotes}
                  multiline
                />
                <View style={styles.buttonGrid}>
                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => handleSubmitOutcome('connected')}
                    disabled={savingOutcome}
                  >
                    <Text style={styles.outcomeText}>Connected</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => handleSubmitOutcome('voicemail')}
                    disabled={savingOutcome}
                  >
                    <Text style={styles.outcomeText}>Voicemail</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleSubmitOutcome('no-answer')}
                    disabled={savingOutcome}
                  >
                    <Text style={styles.outcomeText}>No Answer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#6B7280' }]}
                    onPress={() => setShowOutcomeModal(false)}
                    disabled={savingOutcome}
                  >
                    <Text style={styles.outcomeText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                {savingOutcome && <ActivityIndicator style={{marginTop: 10}} color="#4F46E5"/>}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 16, color: "#374151" },
  
  debugBanner: { backgroundColor: '#FEF3C7', padding: 8, borderRadius: 6, marginBottom: 12, alignItems: 'center' },
  debugText: { fontSize: 12, color: '#D97706', fontWeight: 'bold' },

  header: { marginBottom: 20 },
  leadName: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  leadStatus: { fontSize: 14, color: "#6B7280", marginTop: 4, textTransform: 'uppercase' },
  
  card: { backgroundColor: "white", padding: 16, borderRadius: 12, marginBottom: 20 },
  label: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  value: { fontSize: 16, color: "#1F2937" },

  callButton: { backgroundColor: "#57A6D5", padding: 16, borderRadius: 12, alignItems: "center" },
  callButtonText: { color: "white", fontSize: 18, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center", color: "#111827" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 12, marginBottom: 20, minHeight: 80, textAlignVertical: 'top' },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  outcomeBtn: { width: '48%', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  outcomeText: { color: "white", fontWeight: "600", fontSize: 14 }
});
