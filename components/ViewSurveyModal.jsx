// components/ViewSurveyModal.js
import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export default function ViewSurveyModal({ visible, full, loading, onClose }) {
  const theme = useTheme();
  const COLORS = {
    primary: theme?.colors?.primary || '#10b981',
    bg: 'rgba(0,0,0,0.35)',
    card: '#ffffff',
    border: '#e5e7eb',
    text: theme?.colors?.text || '#111827',
    subtle: '#6b7280',
    chipBg: '#eef2ff',
  };

  const createdAt =
    full?.created_at ? new Date(full.created_at).toLocaleString() : '—';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >


      <TouchableWithoutFeedback onPress={() => { /* tap outside does not close to avoid accidental dismiss */ }}>
      

        <View style={[styles.overlay, { backgroundColor: COLORS.bg }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: COLORS.text }]}>Survey Details</Text>
                  {full?.title ? (
                    <Text style={[styles.subtitle, { color: COLORS.subtle }]} numberOfLines={2}>
                      {full.title}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <Feather name="x" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Content */}
            </View>
              <ScrollView style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border,    borderTopLeftRadius: 0,
    borderTopRightRadius: 0, }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {loading || !full ? (
                  <View style={styles.center}>
                    <ActivityIndicator />
                  </View>
                ) : (
                  <>
                    {/* Meta row */}
                    <View style={styles.metaRow}>
                      <View style={[styles.metaPill, { backgroundColor: COLORS.chipBg }]}>
                        <MaterialIcons name="schedule" size={14} color={COLORS.subtle} />
                        <Text style={[styles.metaText, { color: COLORS.subtle }]}>
                          {createdAt}
                        </Text>
                      </View>
                      {full?.status ? (
                        <View style={[styles.metaPill, { backgroundColor: '#e8fff4' }]}>
                          <Feather name="check-circle" size={14} color="#065f46" />
                          <Text style={[styles.metaText, { color: '#065f46' }]}>
                            {String(full.status)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {full?.description ? (
                      <Text style={[styles.desc, { color: COLORS.subtle }]}>{full.description}</Text>
                    ) : null}

                    {/* Headings + Questions */}
                    {(full?.headings || []).map((h) => (
                      <View key={String(h.id)} style={[styles.headingCard, { borderColor: COLORS.border }]}>
                        <View style={styles.headingHeader}>
                          <Text style={[styles.headingTitle, { color: COLORS.text }]}>
                            {h.title || 'Untitled Section'}
                          </Text>
                        </View>

                        {(h?.questions || []).map((q) => {
                          const isComposite = !!q?.is_composite;
                          const isRequired = !!q?.is_required;
                          const type = q?.type || 'input';

                          return (
                            <View key={String(q.id)} style={styles.qRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.qText, { color: COLORS.text }]}>
                                  {q?.text || 'Untitled question'}
                                </Text>

                                <View style={styles.pillsRow}>
                                  <View style={[styles.pill, { backgroundColor: COLORS.chipBg }]}>
                                    <Text style={[styles.pillText, { color: COLORS.text }]}>{type}</Text>
                                  </View>
                                  {isComposite && (
                                    <View style={[styles.pill, { backgroundColor: '#fef3c7' }]}>
                                      <Text style={[styles.pillText, { color: '#92400e' }]}>composite</Text>
                                    </View>
                                  )}
                                  {isRequired && (
                                    <View style={[styles.pill, { backgroundColor: '#e8fff4' }]}>
                                      <Text style={[styles.pillText, { color: '#065f46' }]}>required</Text>
                                    </View>
                                  )}
                                </View>

                                {/* Options */}
                                {type === 'checkbox' && Array.isArray(q?.options) && q.options.length > 0 ? (
                                  <View style={{ marginTop: 6 }}>
                                    {q.options.map((o) => (
                                      <View key={String(o.id) + o.option_text} style={styles.bulletRow}>
                                        <View style={styles.bulletDot} />
                                        <Text style={[styles.bulletText, { color: COLORS.text }]}>
                                          {o.option_text}
                                          {o.is_other ? ' (Other)' : ''}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}

                                {/* Sub-questions */}
                                {isComposite && Array.isArray(q?.sub_questions) && q.sub_questions.length > 0 ? (
                                  <View style={{ marginTop: 6 }}>
                                    {q.sub_questions.map((s) => (
                                      <View key={String(s.id) + s.label} style={styles.bulletRow}>
                                        <View style={[styles.bulletDot, { backgroundColor: '#6b7280' }]} />
                                        <Text style={[styles.bulletText, { color: COLORS.text }]}>
                                          {s.label} ({s.type})
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ))}

                    {/* Footer button */}
                    <View style={styles.footerActions}>
                      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.9}>
                        <Text style={{ fontWeight: '800', color: COLORS.text }}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
          </KeyboardAvoidingView>
        </View>
    
      </TouchableWithoutFeedback>

    </Modal>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    padding: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },

  center: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaText: { fontSize: 12, fontWeight: '700' },

  desc: { fontSize: 14, marginBottom: 8 },

  headingCard: {
    borderWidth: 1,
    borderRadius: RADIUS,
    padding: 12,
    marginTop: 10,
  },
  headingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  headingTitle: { fontSize: 16, fontWeight: '800' },

  qRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  qText: { fontSize: 15, fontWeight: '700' },

  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800' },

  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  bulletText: { fontSize: 13 },

  footerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  closeBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
});
