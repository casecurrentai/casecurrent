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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api"; 
import type { Lead, ThreadItem, LeadStatus } from "../types";

type TelephonyStatus = {
  provider: "twilio" | "plivo";
  voiceEnabled: boolean;
  smsEnabled: boolean;
};

type ActiveCall = {
  callId: string;
  provider: string;
  dialTo: string;
  startedAt: number;
};

const STATUS_OPTIONS: LeadStatus[] = ['new', 'engaged', 'qualified', 'retained', 'closed'];

export default function LeadDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { leadId } = route.params || {};

  // Data State
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<ThreadItem[]>([]);

  // Telephony State
  const [telephonyStatus, setTelephonyStatus] = useState<TelephonyStatus | null>(null);
  const appState = useRef(AppState.currentState);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [checkingCallStatus, setCheckingCallStatus] = useState(false);

  // SMS State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

  // Status Update State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Initial Data Load
  useEffect(() => {
    loadData();
  }, [leadId]);

  async function loadData() {
    try {
      if (!leadId) return;
      
      const [leadData, telStatus, threadData] = await Promise.all([
        api.leads.get(leadId),
        api.telephony?.status().catch(() => null),
        api.leads.getThread(leadId).catch(() => ({ items: [] }))
      ]);

      setLead(leadData);
      setTelephonyStatus(telStatus);
      setThread(threadData?.items || []);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }

  // AppState Listener for call tracking
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        activeCall
      ) {
        resolveCallBeforePrompt();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [activeCall]);

  async function resolveCallBeforePrompt() {
    if (!activeCall) return;
    setCheckingCallStatus(true);
    try {
      const callData = await api.calls.get(activeCall.callId).catch(() => null);
      setShowOutcomeModal(true);
    } catch (error) {
      setShowOutcomeModal(true);
    } finally {
      setActiveCall(null);
      setCheckingCallStatus(false);
    }
  }

  // Handle Call
  async function handleCall() {
    if (!lead) return;
    try {
      const response = await api.calls.start(lead.id);
      const { dialTo, provider, callId } = response;

      const url = `tel:${dialTo}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        setActiveCall({
          callId: callId || "temp-id",
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

  // Handle SMS Send
  async function handleSendSms() {
    if (!lead || !smsBody.trim()) return;
    
    // Check DNC
    if (lead.dnc) {
      Alert.alert("Cannot Send", "This lead is on the Do Not Contact list.");
      return;
    }

    setSendingSms(true);
    try {
      const result = await api.messaging.sendSms(lead.id, smsBody.trim());
      
      // Optimistic update - add to thread immediately
      const newMessage: ThreadItem = {
        id: result.messageId || `temp-${Date.now()}`,
        type: 'sms',
        timestamp: new Date().toISOString(),
        summary: smsBody.trim(),
        payload: { direction: 'outbound', status: 'sent' }
      };
      setThread(prev => [newMessage, ...prev]);
      
      setSmsBody("");
      setShowSmsModal(false);
      Alert.alert("Success", "Message sent");
    } catch (error: any) {
      const message = error?.message || "Failed to send message";
      Alert.alert("Error", message);
    } finally {
      setSendingSms(false);
    }
  }

  // Handle Status Update
  async function handleStatusUpdate(newStatus: LeadStatus) {
    if (!lead) return;
    setUpdatingStatus(true);
    try {
      await api.leads.updateStatus(lead.id, newStatus);
      setLead(prev => prev ? { ...prev, status: newStatus } : null);
      setShowStatusModal(false);
      Alert.alert("Success", `Status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Submit Call Outcome
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
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to save call log");
    } finally {
      setSavingOutcome(false);
    }
  }

  // Format timestamp
  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#57A6D5" />
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
        
        {/* Header with Name and Status */}
        <View style={styles.header}>
          <Text style={styles.leadName}>{lead.contact?.name || "Unknown"}</Text>
          <TouchableOpacity 
            style={styles.statusBadge} 
            onPress={() => setShowStatusModal(true)}
          >
            <Text style={styles.statusText}>{lead.status?.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* DNC Warning */}
        {lead.dnc && (
          <View style={styles.dncBanner}>
            <Ionicons name="warning" size={16} color="#DC2626" />
            <Text style={styles.dncText}>Do Not Contact</Text>
          </View>
        )}

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.callButton]} 
            onPress={handleCall}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Call Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.smsButton, lead.dnc && styles.disabledButton]} 
            onPress={() => !lead.dnc && setShowSmsModal(true)}
            disabled={lead.dnc}
          >
            <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Text</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Info Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="call-outline" size={18} color="#6B7280" />
            <Text style={styles.cardLabel}>Phone</Text>
            <Text style={styles.cardValue}>{lead.contact?.primaryPhone || "No phone"}</Text>
          </View>
          {lead.contact?.primaryEmail && (
            <View style={styles.cardRow}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <Text style={styles.cardLabel}>Email</Text>
              <Text style={styles.cardValue}>{lead.contact.primaryEmail}</Text>
            </View>
          )}
          {lead.qualification?.score !== undefined && (
            <View style={styles.cardRow}>
              <Ionicons name="star-outline" size={18} color="#6B7280" />
              <Text style={styles.cardLabel}>Score</Text>
              <Text style={[styles.cardValue, styles.scoreBadge]}>
                {lead.qualification.score}
              </Text>
            </View>
          )}
        </View>

        {/* Activity Thread */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {thread.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet</Text>
        ) : (
          thread.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.threadItem}>
              <View style={styles.threadIcon}>
                <Ionicons 
                  name={item.type === 'call' ? 'call' : item.type === 'sms' ? 'chatbubble' : 'ellipse'} 
                  size={16} 
                  color="#57A6D5" 
                />
              </View>
              <View style={styles.threadContent}>
                <Text style={styles.threadType}>
                  {item.type.toUpperCase()}
                </Text>
                {item.summary && (
                  <Text style={styles.threadBody} numberOfLines={2}>{item.summary}</Text>
                )}
                <Text style={styles.threadTime}>{formatTime(item.timestamp)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* SMS Composer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSmsModal}
        onRequestClose={() => setShowSmsModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.smsModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Message</Text>
              <TouchableOpacity onPress={() => setShowSmsModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.smsRecipient}>
              To: {lead.contact?.name || 'Unknown'} ({lead.contact?.primaryPhone})
            </Text>
            
            <TextInput
              style={styles.smsInput}
              placeholder="Type your message..."
              value={smsBody}
              onChangeText={setSmsBody}
              multiline
              maxLength={1600}
              autoFocus
            />
            
            <View style={styles.smsFooter}>
              <Text style={styles.charCount}>{smsBody.length}/1600</Text>
              <TouchableOpacity 
                style={[styles.sendButton, !smsBody.trim() && styles.disabledButton]}
                onPress={handleSendSms}
                disabled={!smsBody.trim() || sendingSms}
              >
                {sendingSms ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showStatusModal}
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  lead.status === status && styles.statusOptionActive
                ]}
                onPress={() => handleStatusUpdate(status)}
                disabled={updatingStatus}
              >
                <Text style={[
                  styles.statusOptionText,
                  lead.status === status && styles.statusOptionTextActive
                ]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                {lead.status === status && (
                  <Ionicons name="checkmark" size={20} color="#57A6D5" />
                )}
              </TouchableOpacity>
            ))}
            {updatingStatus && (
              <ActivityIndicator style={{ marginTop: 10 }} color="#57A6D5" />
            )}
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Call Outcome Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOutcomeModal || checkingCallStatus}
        onRequestClose={() => { if (!checkingCallStatus) setShowOutcomeModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.outcomeModalContent}>
            {checkingCallStatus ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color="#57A6D5" />
                <Text style={{ marginTop: 10, color: '#6B7280' }}>Checking call status...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>How did the call go?</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add call notes (optional)..."
                  value={callNotes}
                  onChangeText={setCallNotes}
                  multiline
                />
                <View style={styles.outcomeGrid}>
                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => handleSubmitOutcome('connected')}
                    disabled={savingOutcome}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.outcomeText}>Connected</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => handleSubmitOutcome('voicemail')}
                    disabled={savingOutcome}
                  >
                    <Ionicons name="recording" size={20} color="#FFFFFF" />
                    <Text style={styles.outcomeText}>Voicemail</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleSubmitOutcome('no-answer')}
                    disabled={savingOutcome}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.outcomeText}>No Answer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.outcomeBtn, { backgroundColor: '#6B7280' }]}
                    onPress={() => setShowOutcomeModal(false)}
                    disabled={savingOutcome}
                  >
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    <Text style={styles.outcomeText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                {savingOutcome && <ActivityIndicator style={{ marginTop: 10 }} color="#57A6D5" />}
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
  content: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 16, color: "#374151" },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  leadName: { fontSize: 24, fontWeight: "bold", color: "#111827", flex: 1 },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#E5E7EB', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16,
    gap: 4
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  dncBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FEE2E2', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 12,
    gap: 8
  },
  dncText: { color: '#DC2626', fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 14, 
    borderRadius: 12,
    gap: 8
  },
  callButton: { backgroundColor: '#10B981' },
  smsButton: { backgroundColor: '#57A6D5' },
  disabledButton: { backgroundColor: '#9CA3AF', opacity: 0.7 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  cardLabel: { color: '#6B7280', fontSize: 14, width: 60 },
  cardValue: { color: '#111827', fontSize: 14, flex: 1 },
  scoreBadge: { fontWeight: 'bold', color: '#57A6D5' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 14, fontStyle: 'italic' },

  threadItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, marginBottom: 8 },
  threadIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  threadContent: { flex: 1 },
  threadType: { fontSize: 12, fontWeight: '600', color: '#374151', textTransform: 'uppercase' },
  threadBody: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  threadTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  
  smsModalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 280 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  smsRecipient: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  smsInput: { 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 12, 
    padding: 14, 
    minHeight: 100, 
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 12
  },
  smsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { color: '#9CA3AF', fontSize: 12 },
  sendButton: { 
    flexDirection: 'row', 
    backgroundColor: '#57A6D5', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 8,
    alignItems: 'center',
    gap: 6
  },
  sendButtonText: { color: '#FFFFFF', fontWeight: '600' },

  statusModalContent: { 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 20,
    paddingBottom: 40
  },
  statusOption: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 16, 
    paddingHorizontal: 12,
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6'
  },
  statusOptionActive: { backgroundColor: '#EFF6FF' },
  statusOptionText: { fontSize: 16, color: '#374151' },
  statusOptionTextActive: { color: '#57A6D5', fontWeight: '600' },
  cancelButton: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  cancelButtonText: { color: '#6B7280', fontSize: 16 },

  outcomeModalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  notesInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 20, minHeight: 80, textAlignVertical: 'top' },
  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  outcomeBtn: { width: '48%', flexDirection: 'row', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  outcomeText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 }
});
