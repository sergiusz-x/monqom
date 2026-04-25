import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from '@/pages/DashboardPage'
import TransactionsPage from '@/pages/TransactionsPage'
import BudgetsPage from '@/pages/BudgetsPage'
import SettingsPage from '@/pages/SettingsPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('page routing', () => {
  it('renders DashboardPage at /', () => {
    renderAt('/', <DashboardPage />)
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders TransactionsPage at /transactions', () => {
    renderAt('/transactions', <TransactionsPage />)
    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument()
  })

  it('renders BudgetsPage at /budgets', () => {
    renderAt('/budgets', <BudgetsPage />)
    expect(screen.getByRole('heading', { name: /budgets/i })).toBeInTheDocument()
  })

  it('renders SettingsPage at /settings', () => {
    renderAt('/settings', <SettingsPage />)
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders LoginPage at /login', () => {
    renderAt('/login', <LoginPage />)
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders RegisterPage at /register', () => {
    renderAt('/register', <RegisterPage />)
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
  })
})
