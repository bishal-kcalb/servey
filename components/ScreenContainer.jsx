// components/ScreenContainer.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export default function ScreenContainer({ children, style }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
});
