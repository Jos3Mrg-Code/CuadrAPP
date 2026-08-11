import { Alert, Platform } from 'react-native'

// Alert.alert es un no-op en react-native-web: en web usamos window.alert
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title)
  } else {
    Alert.alert(title, message)
  }
}
