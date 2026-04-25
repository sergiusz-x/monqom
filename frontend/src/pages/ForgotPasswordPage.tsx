import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

interface ForgotPasswordFormValues {
  email: string
}

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormValues>()

  async function onSubmit(data: ForgotPasswordFormValues) {
    setServerError('')
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSubmitted(true)
    } catch (err: unknown) {
      // Backend intentionally returns success for unknown emails to prevent enumeration.
      // If an unexpected error occurs, show a generic message.
      const status =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'status' in err.response
          ? (err.response as { status: number }).status
          : 0
      if (status >= 500) {
        setServerError('Something went wrong. Please try again.')
      } else {
        setSubmitted(true)
      }
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 p-8 border border-border rounded-lg shadow-sm bg-card text-center">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If an account with that email exists, we've sent a password reset link.
          </p>
          <Link to="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
