// components/EditQuestionModal.js
import React from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function EditQuestionModal({
  visible,
  value,            // { id, text, type, is_required, is_composite, options:[], sub_questions:[] }
  setValue,         // setter to update fields locally
  onCancel,
  onSave,           // calls PUT /questions/:id/full
  themeColor = '#4f46e5',
}) {
  const addOption = () =>
    setValue(m => ({ ...m, options: [...(m.options || []), { id: null, option_text: '', is_other: false }] }));

  const updateOption = (idx, field, v) =>
    setValue(m => {
      const copy = [...(m.options || [])];
      copy[idx] = { ...copy[idx], [field]: v };
      return { ...m, options: copy };
    });

  const removeOption = (idx) =>
    setValue(m => {
      const copy = [...(m.options || [])];
      copy.splice(idx, 1);
      return { ...m, options: copy };
    });

  const addSubQ = () =>
    setValue(m => ({ ...m, sub_questions: [...(m.sub_questions || []), { id: null, label: '', type: 'input' }] }));

  const updateSubQ = (idx, field, v) =>
    setValue(m => {
      const copy = [...(m.sub_questions || [])];
      copy[idx] = { ...copy[idx], [field]: v };
      return { ...m, sub_questions: copy };
    });

  const removeSubQ = (idx) =>
    setValue(m => {
      const copy = [...(m.sub_questions || [])];
      copy.splice(idx, 1);
      return { ...m, sub_questions: copy };
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Edit Question</Text>

          <TextInput
            style={styles.input}
            placeholder="Question text"
            value={value.text}
            onChangeText={(t) => setValue(m => ({ ...m, text: t }))}
          />

          {/* Type */}
          <View style={styles.typeRow}>
            {['input', 'yes_no', 'checkbox', 'audio', 'video'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, value.type === t && { backgroundColor: themeColor }]}
                onPress={() => setValue(m => ({ ...m, type: t }))}
              >
                <Text style={{ color: value.type === t ? '#fff' : '#000' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Toggles */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => setValue(m => ({ ...m, is_required: !m.is_required }))}
              style={styles.rowToggle}
            >
              <MaterialIcons name={value.is_required ? 'check-box' : 'check-box-outline-blank'} size={22} />
              <Text>Required</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setValue(m => ({ ...m, is_composite: !m.is_composite }))}
              style={styles.rowToggle}
            >
              <MaterialIcons name={value.is_composite ? 'check-box' : 'check-box-outline-blank'} size={22} />
              <Text>Composite</Text>
            </TouchableOpacity>
          </View>

          {/* Options */}
          {value.type === 'checkbox' && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionTitle}>Options</Text>
              <TouchableOpacity onPress={addOption} style={[styles.addBtn, { backgroundColor: themeColor }]}>
                <Text style={{ color: '#fff' }}>Add Option</Text>
              </TouchableOpacity>
              <ScrollView style={{ maxHeight: 200 }}>
                {(value.options || []).map((o, idx) => (
                  <View key={o.id ?? `new-${idx}`} style={{ marginBottom: 10 }}>
                    <TextInput
                      style={styles.input}
                      placeholder={`Option #${idx + 1}`}
                      value={o.option_text}
                      onChangeText={(t) => updateOption(idx, 'option_text', t)}
                    />
                    <TouchableOpacity
                      onPress={() => updateOption(idx, 'is_other', !o.is_other)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      <MaterialIcons name={o.is_other ? 'check-box' : 'check-box-outline-blank'} size={22} />
                      <Text>Mark as “Other”</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeOption(idx)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                      <MaterialIcons name="delete" size={18} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Sub-questions */}
          {value.is_composite && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionTitle}>Sub-questions</Text>
              <TouchableOpacity onPress={addSubQ} style={[styles.addBtn, { backgroundColor: themeColor }]}>
                <Text style={{ color: '#fff' }}>Add Sub-question</Text>
              </TouchableOpacity>
              <ScrollView style={{ maxHeight: 200 }}>
                {(value.sub_questions || []).map((s, idx) => (
                  <View key={s.id ?? `sub-new-${idx}`} style={{ marginBottom: 10 }}>
                    <TextInput
                      style={styles.input}
                      placeholder={`Label #${idx + 1}`}
                      value={s.label}
                      onChangeText={(t) => updateSubQ(idx, 'label', t)}
                    />
                    <View style={styles.typeRow}>
                      {['input', 'yes_no', 'checkbox'].map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeButton, s.type === t && { backgroundColor: themeColor }]}
                          onPress={() => updateSubQ(idx, 'type', t)}
                        >
                          <Text style={{ color: s.type === t ? '#fff' : '#000' }}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => removeSubQ(idx)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                      <MaterialIcons name="delete" size={18} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.btn}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={[styles.btn, { backgroundColor: themeColor }]}>
              <Text style={{ color: '#fff' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  box: { width: '90%', maxWidth: 560, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 10, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  typeButton: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#eee', borderRadius: 6 },
  rowToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtn: { padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  btn: { padding: 10, borderRadius: 8, backgroundColor: '#eee' },
});
