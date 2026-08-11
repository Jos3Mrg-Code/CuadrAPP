import { Platform } from 'react-native'

// expo-notifications doesn't work on web
const isNative = Platform.OS !== 'web'

export async function requestPermissions(): Promise<boolean> {
  if (!isNative) return false
  const { default: Notifications } = await import('expo-notifications')
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!isNative) return 'denied'
  const { default: Notifications } = await import('expo-notifications')
  const { status } = await Notifications.getPermissionsAsync()
  return status as any
}

export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  if (!isNative) return
  const { default: Notifications } = await import('expo-notifications')

  await Notifications.cancelAllScheduledNotificationsAsync()

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 CuadrAPP',
      body: 'Revisa tus finanzas del día',
      sound: true,
    },
    trigger: {
      type: 'calendar' as any,
      hour,
      minute,
      repeats: true,
    },
  })
}

export async function cancelAllScheduled(): Promise<void> {
  if (!isNative) return
  const { default: Notifications } = await import('expo-notifications')
  await Notifications.cancelAllScheduledNotificationsAsync()
}

export async function sendLocalNow(title: string, body: string): Promise<void> {
  if (!isNative) return
  const { default: Notifications } = await import('expo-notifications')
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  })
}
