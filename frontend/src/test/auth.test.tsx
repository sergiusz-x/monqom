import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, AuthProvider } from '@/contexts/AuthContext'
import type { AuthContextValue, User } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import ResendVerificationPage from '@/pages/ResendVerificationPage'
import ProtectedRoute from '@/components/ProtectedRoute'

// Mock the api module
vi.mock('@/lib/api', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
    defaults: {
      baseURL: '/api/v1',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    },
  }
  return { default: mockApi }
})

import api from '@/lib/api'
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

const testUser: User = {
  id: '1',
  email: 'user@example.com',
  name: 'Test User',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderWithRouter(element: React.ReactNode, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {element}
    </MemoryRouter>,
  )
}

function renderWithAuth(element: React.ReactNode, authOverrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    user: null,
    isLoading: false,
    login: vi.fn() as unknown as AuthContextValue['login'],
    logout: vi.fn() as unknown as AuthContextValue['logout'],
    setUser: vi.fn() as unknown as AuthContextValue['setUser'],
    ...authOverrides,
  }
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        {element}
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── AuthProvider ──────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  it('calls /auth/me on mount and sets user on success', async () => {
    mockApi.get.mockResolvedValueOnce({ data: testUser })

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthContext.Consumer>
            {(ctx) => <span data-testid="name">{ctx?.user?.name ?? 'none'}</span>}
          </AuthContext.Consumer>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Test User')
    })
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
  })

  it('sets user to null when /auth/me returns 401', async () => {
    mockApi.get.mockRejectedValueOnce({ response: { status: 401 } })

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthContext.Consumer>
            {(ctx) => <span data-testid="name">{ctx?.user?.name ?? 'none'}</span>}
          </AuthContext.Consumer>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('none')
    })
  })

  it('transitions isLoading from true to false after mount check', async () => {
    mockApi.get.mockResolvedValueOnce({ data: testUser })

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthContext.Consumer>
            {(ctx) => <span data-testid="loading">{String(ctx?.isLoading)}</span>}
          </AuthContext.Consumer>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })
})

// ─── ProtectedRoute ────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('renders loading state while isLoading is true', () => {
    renderWithAuth(<ProtectedRoute />, { isLoading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('redirects to /login when user is null', () => {
    renderWithAuth(<ProtectedRoute />, { user: null, isLoading: false })
    // ProtectedRoute renders Navigate to /login — loading spinner must not appear
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
})

// ─── LoginPage 2FA flow ────────────────────────────────────────────────────

describe('LoginPage 2FA flow', () => {
  it('shows 2FA form when login returns two_factor_required', async () => {
    const mockLogin = vi.fn().mockResolvedValueOnce({ type: 'two_factor_required' })

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null, isLoading: false, login: mockLogin, logout: vi.fn(), setUser: vi.fn() }}>
          <LoginPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument()
    })
  })

  it('calls /auth/2fa/verify with { token } field (not totp)', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockResolvedValueOnce({ type: 'two_factor_required' })
    const mockSetUser = vi.fn()
    mockApi.post.mockResolvedValueOnce({ data: { id: '1', email: 'u@e.com', name: 'U', emailVerified: true, createdAt: '', updatedAt: '' } })

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null, isLoading: false, login: mockLogin, logout: vi.fn(), setUser: mockSetUser }}>
          <LoginPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for the 2FA form to appear, then clear + type the code
    const codeInput = await screen.findByLabelText(/authentication code/i)
    await user.clear(codeInput)
    await user.type(codeInput, '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/2fa/verify', { token: '123456' })
    })
  })
})

// ─── VerifyEmailPage ───────────────────────────────────────────────────────

describe('VerifyEmailPage', () => {
  it('shows "check your email" when no token in URL', () => {
    renderWithRouter(<VerifyEmailPage />, '/verify-email')
    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
  })

  it('shows success message after successful verification', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Email verified successfully' } })

    render(
      <MemoryRouter initialEntries={['/verify-email?token=abc123']}>
        <VerifyEmailPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /email verified/i })).toBeInTheDocument()
    })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'abc123' })
  })

  it('shows error when token is invalid', async () => {
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: 'Verification token is invalid or expired' } },
    })

    render(
      <MemoryRouter initialEntries={['/verify-email?token=bad']}>
        <VerifyEmailPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /verification failed/i })).toBeInTheDocument()
    })
  })
})

// ─── ForgotPasswordPage ────────────────────────────────────────────────────

describe('ForgotPasswordPage', () => {
  it('shows required error when email is empty', async () => {
    renderWithRouter(<ForgotPasswordPage />)
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows confirmation after successful submission', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Password reset link sent' } })

    renderWithRouter(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'user@example.com' })
  })
})

// ─── ResetPasswordPage ─────────────────────────────────────────────────────

describe('ResetPasswordPage', () => {
  it('shows invalid link when no token in URL', () => {
    renderWithRouter(<ResetPasswordPage />, '/reset-password')
    expect(screen.getByRole('heading', { name: /invalid link/i })).toBeInTheDocument()
  })

  it('shows password mismatch error', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'different123')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows required error for empty new password', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))
    await waitFor(() => {
      expect(screen.getByText(/new password is required/i)).toBeInTheDocument()
    })
  })

  it('shows success state after successful reset', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Password reset successfully' } })

    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'newpassword1')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword1')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset/i })).toBeInTheDocument()
    })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'valid',
      newPassword: 'newpassword1',
    })
  })

  it('shows minimum length error for short password', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))
    await waitFor(() => {
      expect(screen.getByText(/minimum 8 characters/i)).toBeInTheDocument()
    })
  })
})

// ─── ResendVerificationPage ────────────────────────────────────────────────

describe('ResendVerificationPage', () => {
  it('shows required error when email is empty', async () => {
    renderWithRouter(<ResendVerificationPage />)
    await userEvent.click(screen.getByRole('button', { name: /resend link/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows confirmation after successful submission', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Verification email sent' } })

    renderWithRouter(<ResendVerificationPage />)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /resend link/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /email sent/i })).toBeInTheDocument()
    })
  })
})

// ─── unused suppress warning ───────────────────────────────────────────────
void act
