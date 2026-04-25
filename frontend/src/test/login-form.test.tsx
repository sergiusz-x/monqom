import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import { AuthContext } from '@/contexts/AuthContext'
import type { User } from '@/contexts/AuthContext'

const mockLogin = vi.fn()
const mockSetUser = vi.fn()

const defaultAuthValue = {
  user: null as User | null,
  isLoading: false,
  login: mockLogin,
  logout: vi.fn(),
  setUser: mockSetUser,
}

function renderWithAuth(element: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={defaultAuthValue}>
        {element}
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLogin.mockResolvedValue({ type: 'authenticated', user: { id: '1', email: 'u@e.com', name: 'U', emailVerified: true, createdAt: '', updatedAt: '' } })
})

describe('LoginPage form validation', () => {
  it('shows required errors when submitting empty form', async () => {
    renderWithAuth(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('accepts valid credentials without validation errors', async () => {
    renderWithAuth(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
    })
  })

  it('shows server error on login failure', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: 'Invalid email or password' } },
    })
    renderWithAuth(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })
})

describe('RegisterPage form validation', () => {
  it('shows required errors when submitting empty form', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows error when passwords do not match', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/^email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'secret123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/^password$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/minimum 8 characters/i)).toBeInTheDocument()
    })
  })
})
