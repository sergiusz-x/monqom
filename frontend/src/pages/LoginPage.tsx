import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface LoginFormValues {
  email: string
  password: string
}

interface TwoFactorFormValues {
  code: string
}

export default function LoginPage() {
  const { login, setUser } = useAuth()
  const navigate = useNavigate()
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [serverError, setServerError] = useState('')

  const loginForm = useForm<LoginFormValues>()
  const twoFactorForm = useForm<TwoFactorFormValues>()

  async function onLoginSubmit(data: LoginFormValues) {
    setServerError('')
    try {
      const result = await login(data.email, data.password)
      if (result.type === 'two_factor_required') {
        setTwoFactorRequired(true)
      } else {
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setServerError(msg)
    }
  }

  async function onTwoFactorSubmit(data: TwoFactorFormValues) {
    setServerError('')
    try {
      const res = await api.post<{
        id: string
        email: string
        name: string
        emailVerified: boolean
        createdAt: string
        updatedAt: string
      }>('/auth/2fa/verify', { token: data.code })
      setUser(res.data)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err))
    }
  }

  if (twoFactorRequired) {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = twoFactorForm
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
            <p className="text-sm text-muted-foreground">Enter the code from your authenticator app.</p>
          </div>
          <form onSubmit={handleSubmit(onTwoFactorSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="code" className="text-sm font-medium">Authentication code</label>
              <input
                id="code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="000000"
                {...register('code', { required: 'Code is required' })}
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            {serverError && <p className="text-xs text-destructive">{serverError}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = loginForm
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to access your workspace.</p>
        </div>
        <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = (err.response as { data: unknown }).data
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message: unknown }).message
      return Array.isArray(msg) ? msg.join(', ') : String(msg)
    }
  }
  return 'Something went wrong. Please try again.'
}
