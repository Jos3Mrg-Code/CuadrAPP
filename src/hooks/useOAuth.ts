import { Platform } from 'react-native'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

const isWeb = Platform.OS === 'web'

export function useOAuth() {
  const signInWithGoogle = async () => {
    if (isWeb) {
      // En web: redirect completo, Supabase maneja el callback
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } else {
      // En nativo: popup con deep link
      const redirectTo = AuthSession.makeRedirectUri()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No se obtuvo URL de autenticación')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url)
        if (sessionError) throw sessionError
      }
    }
  }

  const signInWithApple = async () => {
    if (Platform.OS === 'ios') {
      const { default: AppleAuthentication } = await import('expo-apple-authentication')
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      })
      if (error) throw error
    } else if (isWeb) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } else {
      const redirectTo = AuthSession.makeRedirectUri()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No se obtuvo URL de autenticación')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url)
        if (sessionError) throw sessionError
      }
    }
  }

  return { signInWithGoogle, signInWithApple }
}
