import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import type { User, AuthContextValue } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { useDarkMode } from '@/hooks/useDarkMode'

const testUser: User = {
  id: '1',
  email: 'alice@example.com',
  name: 'Alice Smith',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function makeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: testUser,
    isLoading: false,
    login: vi.fn() as unknown as AuthContextValue['login'],
    logout: vi.fn().mockResolvedValue(undefined),
    setUser: vi.fn(),
    ...overrides,
  }
}

function LocationDisplay() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

function renderWithAuthAndRouter(element: React.ReactNode, authValue = makeAuthValue()) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route element={element}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

// ─── useDarkMode ─────────────────────────────────────────────────────────────

describe('useDarkMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light mode when localStorage is empty', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('reads initial state from localStorage', () => {
    localStorage.setItem('monqom-dark-mode', 'true')
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggle adds dark class and persists to localStorage', () => {
    const { result } = renderHook(() => useDarkMode())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('monqom-dark-mode')).toBe('true')
  })

  it('toggle removes dark class on second call', () => {
    localStorage.setItem('monqom-dark-mode', 'true')
    const { result } = renderHook(() => useDarkMode())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('monqom-dark-mode')).toBe('false')
  })

  it('falls back to prefers-color-scheme: dark when localStorage is empty', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    vi.unstubAllGlobals()
  })
})

// ─── Sidebar ──────────────────────────────────────────────────────────────────

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  function renderSidebar(authValue = makeAuthValue()) {
    const onAddTransaction = vi.fn()
    const utils = render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={authValue}>
          <Sidebar onAddTransaction={onAddTransaction} />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    return { ...utils, onAddTransaction }
  }

  it('renders brand name', () => {
    renderSidebar()
    expect(screen.getByText('Monqom')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /budgets/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('displays user name and email', () => {
    renderSidebar()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders Add Transaction button and calls handler', async () => {
    const { onAddTransaction } = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    expect(onAddTransaction).toHaveBeenCalledTimes(1)
  })

  it('renders logout button and calls logout', async () => {
    const logoutMock = vi.fn().mockResolvedValue(undefined)
    renderSidebar(makeAuthValue({ logout: logoutMock }))
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('renders dark mode toggle button', () => {
    renderSidebar()
    expect(
      screen.getByRole('button', { name: /switch to dark mode/i }),
    ).toBeInTheDocument()
  })

  it('dark mode toggle switches label after click', async () => {
    renderSidebar()
    const btn = screen.getByRole('button', { name: /switch to dark mode/i })
    await userEvent.click(btn)
    expect(
      screen.getByRole('button', { name: /switch to light mode/i }),
    ).toBeInTheDocument()
  })

  it('does not render user info when user is null', () => {
    renderSidebar(makeAuthValue({ user: null }))
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument()
  })
})

// ─── BottomNav ────────────────────────────────────────────────────────────────

describe('BottomNav', () => {
  function renderBottomNav() {
    const onAddTransaction = vi.fn()
    const utils = render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav onAddTransaction={onAddTransaction} />
      </MemoryRouter>,
    )
    return { ...utils, onAddTransaction }
  }

  it('renders all navigation links', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /budgets/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders Add Transaction button', () => {
    renderBottomNav()
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument()
  })

  it('calls onAddTransaction when + button is clicked', async () => {
    const { onAddTransaction } = renderBottomNav()
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    expect(onAddTransaction).toHaveBeenCalledTimes(1)
  })
})

// ─── AppLayout ────────────────────────────────────────────────────────────────

describe('AppLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders without crashing and shows outlet content', () => {
    renderWithAuthAndRouter(<AppLayout />)
    const main = screen.getByRole('main')
    expect(within(main).getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders sidebar landmark', () => {
    renderWithAuthAndRouter(<AppLayout />)
    expect(screen.getByRole('complementary', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('renders mobile navigation landmark', () => {
    renderWithAuthAndRouter(<AppLayout />)
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument()
  })

  it('renders main content area', () => {
    renderWithAuthAndRouter(<AppLayout />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('Add Transaction button navigates to /transactions', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={makeAuthValue()}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<LocationDisplay />} />
              <Route path="/transactions" element={<LocationDisplay />} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('location')[0]).toHaveTextContent('/')

    await userEvent.click(screen.getAllByRole('button', { name: /add transaction/i })[0])

    expect(screen.getAllByTestId('location')[0]).toHaveTextContent('/transactions')
  })
})
