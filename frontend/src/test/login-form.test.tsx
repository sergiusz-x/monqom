import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'

function renderWithRouter(element: React.ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>)
}

describe('LoginPage form validation', () => {
  it('shows required errors when submitting empty form', async () => {
    renderWithRouter(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('accepts valid credentials without validation errors', async () => {
    renderWithRouter(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
    })
  })
})

describe('RegisterPage form validation', () => {
  it('shows required errors when submitting empty form', async () => {
    renderWithRouter(<RegisterPage />)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows error when passwords do not match', async () => {
    renderWithRouter(<RegisterPage />)
    await userEvent.type(screen.getByLabelText(/^email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'secret123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    renderWithRouter(<RegisterPage />)
    await userEvent.type(screen.getByLabelText(/^password$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/minimum 8 characters/i)).toBeInTheDocument()
    })
  })
})
