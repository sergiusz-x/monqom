import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, PiggyBank, Settings, Plus, Sun, Moon, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  onAddTransaction: () => void
}

export default function Sidebar({ onAddTransaction }: SidebarProps) {
  const { user, logout } = useAuth()
  const { isDark, toggle } = useDarkMode()

  return (
    <aside className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar" aria-label="Main navigation">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">Monqom</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
              )
            }
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-3">
        <Button variant="default" className="w-full gap-2" onClick={onAddTransaction}>
          <Plus size={16} aria-hidden="true" />
          Add Transaction
        </Button>

        <div className="border-t border-border pt-3">
          {user && (
            <div className="px-1 mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { logout().catch(() => {}) }}
              className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut size={16} aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
