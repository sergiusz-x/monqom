import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetProgressBar } from '@/components/BudgetProgressBar'
import { BudgetProgressList } from '@/components/BudgetProgressList'
import type { BudgetProgressItem } from '@/types/budget'

vi.mock('@/hooks/useBudgetProgress', () => ({
  useBudgetProgress: vi.fn(),
}))

import { useBudgetProgress } from '@/hooks/useBudgetProgress'
const mockUseBudgetProgress = useBudgetProgress as ReturnType<typeof vi.fn>

function makeItem(overrides: Partial<BudgetProgressItem> = {}): BudgetProgressItem {
  return {
    category_id: 'cat-1',
    category_name: 'Groceries',
    budget_amount: 500,
    limit: 500,
    spent: 250,
    remaining: 250,
    percentage: 50,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── BudgetProgressBar — basic display ───────────────────────────────────────

describe('BudgetProgressBar — basic display', () => {
  it('shows category name', () => {
    render(<BudgetProgressBar item={makeItem({ category_name: 'Groceries' })} />)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('shows percentage for budgeted item', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 50 })} />)
    expect(screen.getByText('50.0%')).toBeInTheDocument()
  })

  it('shows spent and budget amounts', () => {
    render(<BudgetProgressBar item={makeItem({ spent: 250, budget_amount: 500 })} />)
    expect(screen.getByText(/\$250\.00.*\$500\.00/)).toBeInTheDocument()
  })

  it('shows remaining amount when under budget', () => {
    render(<BudgetProgressBar item={makeItem({ remaining: 250 })} />)
    expect(screen.getByText(/Remaining:.*\$250\.00/)).toBeInTheDocument()
  })

  it('renders progressbar with correct aria-valuenow', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 50 })} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('sets aria-label from category name', () => {
    render(<BudgetProgressBar item={makeItem({ category_name: 'Transport' })} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Transport budget progress',
    )
  })
})

// ─── BudgetProgressBar — no budget ───────────────────────────────────────────

describe('BudgetProgressBar — no budget', () => {
  const noBudgetItem = makeItem({
    budget_amount: null,
    limit: null,
    remaining: null,
    percentage: null,
    spent: 120.5,
  })

  it('shows spending amount', () => {
    render(<BudgetProgressBar item={noBudgetItem} />)
    expect(screen.getByText('$120.50')).toBeInTheDocument()
  })

  it('shows "No budget set" label', () => {
    render(<BudgetProgressBar item={noBudgetItem} />)
    expect(screen.getByText('No budget set')).toBeInTheDocument()
  })

  it('does not render a progress bar', () => {
    render(<BudgetProgressBar item={noBudgetItem} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

// ─── BudgetProgressBar — over budget ─────────────────────────────────────────

describe('BudgetProgressBar — over budget', () => {
  const overBudgetItem = makeItem({
    budget_amount: 100,
    spent: 150,
    remaining: -50,
    percentage: 150,
  })

  it('shows overage amount', () => {
    render(<BudgetProgressBar item={overBudgetItem} />)
    expect(screen.getByText(/Over by.*\$50\.00/)).toBeInTheDocument()
  })

  it('does not show remaining text', () => {
    render(<BudgetProgressBar item={overBudgetItem} />)
    expect(screen.queryByText(/^Remaining:/)).not.toBeInTheDocument()
  })

  it('caps progressbar at 100 in aria-valuenow', () => {
    render(<BudgetProgressBar item={overBudgetItem} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('shows percentage over 100', () => {
    render(<BudgetProgressBar item={overBudgetItem} />)
    expect(screen.getByText('150.0%')).toBeInTheDocument()
  })
})

// ─── BudgetProgressBar — color coding ────────────────────────────────────────

describe('BudgetProgressBar — color coding', () => {
  it('uses green bar when percentage < 75', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 50 })} />)
    expect(screen.getByRole('progressbar').className).toContain('bg-green-500')
  })

  it('uses yellow bar at exactly 75%', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 75 })} />)
    expect(screen.getByRole('progressbar').className).toContain('bg-yellow-500')
  })

  it('uses yellow bar between 75% and 89%', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 80 })} />)
    expect(screen.getByRole('progressbar').className).toContain('bg-yellow-500')
  })

  it('uses red bar at exactly 90%', () => {
    render(<BudgetProgressBar item={makeItem({ percentage: 90 })} />)
    expect(screen.getByRole('progressbar').className).toContain('bg-red-500')
  })

  it('uses red bar when over budget', () => {
    render(
      <BudgetProgressBar
        item={makeItem({ percentage: 120, remaining: -20, spent: 120, budget_amount: 100 })}
      />,
    )
    expect(screen.getByRole('progressbar').className).toContain('bg-red-500')
  })
})

// ─── BudgetProgressList — states ─────────────────────────────────────────────

describe('BudgetProgressList — loading', () => {
  it('shows loading status', () => {
    mockUseBudgetProgress.mockReturnValue({ items: [], isLoading: true, error: null })
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading budget progress…')
  })
})

describe('BudgetProgressList — error', () => {
  it('shows error message', () => {
    mockUseBudgetProgress.mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to load budget progress',
    })
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load budget progress')
  })
})

describe('BudgetProgressList — empty', () => {
  it('shows empty state message', () => {
    mockUseBudgetProgress.mockReturnValue({ items: [], isLoading: false, error: null })
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getByText('No budgets or spending this month.')).toBeInTheDocument()
  })
})

describe('BudgetProgressList — items', () => {
  beforeEach(() => {
    mockUseBudgetProgress.mockReturnValue({
      items: [
        makeItem({ category_id: 'c1', category_name: 'Groceries' }),
        makeItem({ category_id: 'c2', category_name: 'Transport' }),
        makeItem({ category_id: 'c3', category_name: 'Entertainment', budget_amount: null, limit: null, remaining: null, percentage: null, spent: 40 }),
      ],
      isLoading: false,
      error: null,
    })
  })

  it('renders all budget items', () => {
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('Entertainment')).toBeInTheDocument()
  })

  it('renders budgeted items with a progress bar', () => {
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
  })

  it('renders no-budget item without a progress bar', () => {
    render(<BudgetProgressList workspaceId="ws-1" month="2026-04" />)
    expect(screen.getByText('No budget set')).toBeInTheDocument()
  })

  it('passes correct workspaceId and month to the hook', () => {
    render(<BudgetProgressList workspaceId="ws-42" month="2026-01" />)
    expect(mockUseBudgetProgress).toHaveBeenCalledWith('ws-42', '2026-01')
  })
})
