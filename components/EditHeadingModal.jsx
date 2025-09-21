// components/EditHeadingModal.js
import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function EditHeadingModal({
  visible,
  title,
  onChangeTitle,
  onCancel,
  onSave,
  themeColor = '#4f46e5',
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Edit Heading</Text>
          <TextInput
            style={styles.input}
            placeholder="Heading title"
            value={title}
            onChangeText={onChangeTitle}
          />
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 6 },
  btn: { padding: 10, borderRadius: 8, backgroundColor: '#eee' },
});
