import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { showAlert } from '../../lib/alert'
import { Link, router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      showAlert('Error', 'Completa todos los campos')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      showAlert('Error', error.message)
    } else {
      showAlert('Éxito', 'Revisa tu correo para confirmar tu cuenta')
      router.replace('/(auth)/login')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Empieza a controlar tus finanzas</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#64748B"
          value={fullName}
          onChangeText={setFullName}
        />
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

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creando cuenta...' : 'Registrarse'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
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
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 40 },
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
