import { useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AuthPage } from '@/components/auth/AuthPage'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Loader2 } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Toaster } from 'sonner'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <>
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route
            path="/login"
            element={!session ? <AuthPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={
              session ? (
                <AdminLayout>
                  <Dashboard />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App
