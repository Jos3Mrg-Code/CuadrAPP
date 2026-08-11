import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { showAlert } from '../../lib/alert'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useOAuth } from '../../hooks/useOAuth'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const { signInWithGoogle } = useOAuth()

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Completa todos los campos')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) showAlert('Error', error.message)
    setLoading(false)
  }

  const handleGoogle = async () => {
    setOauthLoading('google')
    try {
      await signInWithGoogle()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>CUADRAPP</Text>
        <Text style={styles.subtitle}>Gestiona tus finanzas personales</Text>

        {/* Social login */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleGoogle}
          disabled={oauthLoading !== null}
        >
          <Text style={styles.socialIcon}>G</Text>
          <Text style={styles.socialText}>
            {oauthLoading === 'google' ? 'Conectando...' : 'Continuar con Google'}
          </Text>
        </TouchableOpacity>

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o con correo</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / password */}
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Ingresando...' : 'Iniciar sesión'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 32 },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  socialIcon: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  socialText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#334155' },
  dividerText: { color: '#64748B', fontSize: 13 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#6366F1', textAlign: 'center', fontSize: 14 },
})
