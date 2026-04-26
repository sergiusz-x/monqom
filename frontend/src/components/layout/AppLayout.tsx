import { useNavigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const navigate = useNavigate()

  function handleAddTransaction() {
    navigate('/transactions')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:flex">
        <Sidebar onAddTransaction={handleAddTransaction} />
      </div>
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <BottomNav onAddTransaction={handleAddTransaction} />
    </div>
  )
}
