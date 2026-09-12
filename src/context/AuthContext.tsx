import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppUser, UserRole } from '@/types'

interface AuthContextType {
  session: Session | null
  user: User | null
  appUser: AppUser | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
  isAssistant: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchAppUser(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchAppUser(session.user.id)
      else { setAppUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAppUser(userId: string) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single()
      setAppUser(data)
    } catch {
      setAppUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAppUser(null)
  }

  const role = appUser?.role ?? null
  const isAdmin = role === 'administrateur'
  const isAssistant = role === 'assistant' || role === 'administrateur'

  return (
    <AuthContext.Provider value={{ session, user, appUser, role, loading, signIn, signOut, isAdmin, isAssistant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
