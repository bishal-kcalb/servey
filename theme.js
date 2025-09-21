// theme.js
import React, { createContext, useContext } from 'react';
import { View, StyleSheet } from 'react-native';

const ThemeContext = createContext();

const theme = {
  colors: {
    primary: '#10b981',
    secondary: '#3b3bea',
    background: '#f6f6f6',
    inputBackground: '#f2f5f7',
    primaryButtonColor: '#3b3bea',
    secondaryButtonColor: '#10b981',
    text: '#09083b',
    inputBackground: '#f2f5f7',
    border: '#f2f5f7',
    buttonText: '#FFFFFF',
  },
};

export const ThemeProvider = ({ children }) => {
    const themeWithStyles = {
    ...theme,
    styles, // ✅ include styles here
  }; 
  return (
    <ThemeContext.Provider value={themeWithStyles}>
      <View style={styles.appContainer}>{children}</View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    padding: 20,
    borderRadius: 10,
    // backgroundColor: '#f2f5f7'
    shadowColor: '#000', // shadow on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignSelf: 'center',
    textAlign: 'center'
  },
  inputWrapper:{
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f2f5f7',
  }
});

export const useTheme = () => useContext(ThemeContext);
