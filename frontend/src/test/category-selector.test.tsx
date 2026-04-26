import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategorySelector } from '@/components/CategorySelector'
import type { Category } from '@/types/category'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    interceptors: { response: { use: vi.fn(), eject: vi.fn() } },
  },
}))

import api from '@/lib/api'
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> }

const mockCategories: Category[] = [
  {
    id: 'food',
    name: 'Food',
    icon: null,
    parent_id: null,
    sort_order: 1,
    children: [
      { id: 'groceries', name: 'Groceries', icon: null, parent_id: 'food', sort_order: 1, children: [] },
      { id: 'restaurants', name: 'Restaurants', icon: null, parent_id: 'food', sort_order: 2, children: [] },
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: null,
    parent_id: null,
    sort_order: 2,
    children: [
      { id: 'fuel', name: 'Fuel', icon: null, parent_id: 'transport', sort_order: 1, children: [] },
    ],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.get.mockResolvedValue({ data: mockCategories })
})

function renderSelector(value: string | null = null, onChange = vi.fn()) {
  return { onChange, ...render(<CategorySelector workspaceId="ws-1" value={value} onChange={onChange} />) }
}

// ─── Initial state ──────────────────────────────────────────────────────────

describe('CategorySelector initial state', () => {
  it('shows placeholder when no value is selected', () => {
    renderSelector()
    expect(screen.getByRole('combobox')).toHaveTextContent('Select category')
  })

  it('accepts a custom placeholder', () => {
    render(<CategorySelector workspaceId="ws-1" value={null} onChange={vi.fn()} placeholder="Choose…" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Choose…')
  })

  it('shows full path for a selected child category', async () => {
    renderSelector('groceries')
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Food → Groceries')
    })
  })

  it('shows name for a selected parent category', async () => {
    renderSelector('food')
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Food')
    })
  })
})

// ─── Open / close ────────────────────────────────────────────────────────────

describe('CategorySelector open/close', () => {
  it('opens dropdown when trigger is clicked', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes dropdown when trigger is clicked again', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on Escape key', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not open when disabled', async () => {
    render(<CategorySelector workspaceId="ws-1" value={null} onChange={vi.fn()} disabled />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

// ─── Category display ────────────────────────────────────────────────────────

describe('CategorySelector category display', () => {
  it('renders all categories grouped by parent', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Restaurants' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Transport' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Fuel' })).toBeInTheDocument()
    })
  })

  it('marks selected option with aria-selected', async () => {
    renderSelector('groceries')
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Groceries' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('option', { name: 'Food' })).toHaveAttribute('aria-selected', 'false')
    })
  })
})

// ─── Search / filter ─────────────────────────────────────────────────────────

describe('CategorySelector search', () => {
  it('shows search input when dropdown is open', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByLabelText('Search categories')).toBeInTheDocument()
  })

  it('filters categories by child name', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Search categories'), 'grocer')

    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Restaurants' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Transport' })).not.toBeInTheDocument()
  })

  it('shows parent and all children when parent name matches', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Search categories'), 'food')

    expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Restaurants' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Transport' })).not.toBeInTheDocument()
  })

  it('shows "No categories found" when no match', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Search categories'), 'zzz')

    expect(screen.getByText('No categories found')).toBeInTheDocument()
  })

  it('resets search when dropdown closes', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText('Search categories'), 'food')
    await userEvent.keyboard('{Escape}')

    // Reopen
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())
    expect(screen.getByLabelText('Search categories')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Transport' })).toBeInTheDocument()
  })
})

// ─── Selection ────────────────────────────────────────────────────────────────

describe('CategorySelector selection', () => {
  it('calls onChange with id when a child category is clicked', async () => {
    const { onChange } = renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('option', { name: 'Groceries' }))

    expect(onChange).toHaveBeenCalledWith('groceries')
  })

  it('calls onChange with id when a parent category is clicked', async () => {
    const { onChange } = renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('option', { name: 'Food' }))

    expect(onChange).toHaveBeenCalledWith('food')
  })

  it('closes dropdown after selection', async () => {
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('option', { name: 'Groceries' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

// ─── Keyboard navigation ─────────────────────────────────────────────────────

describe('CategorySelector keyboard navigation', () => {
  it('selects the focused item on Enter after ArrowDown', async () => {
    const onChange = vi.fn()
    render(<CategorySelector workspaceId="ws-1" value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument())

    // Focus the search input, navigate down to the first item (Food) and select
    await userEvent.click(screen.getByLabelText('Search categories'))
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('food')
  })

  it('navigates to second item with two ArrowDown presses', async () => {
    const onChange = vi.fn()
    render(<CategorySelector workspaceId="ws-1" value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText('Search categories'))
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')

    // Second item after Food is Groceries
    expect(onChange).toHaveBeenCalledWith('groceries')
  })

  it('opens dropdown with ArrowDown key on trigger', async () => {
    renderSelector()
    screen.getByRole('combobox').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})

// ─── Loading / error states ───────────────────────────────────────────────────

describe('CategorySelector loading and error', () => {
  it('shows loading state while fetching', async () => {
    mockApi.get.mockReturnValue(new Promise(() => {}))
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('Loading categories…')).toBeInTheDocument()
  })

  it('shows error message when API request fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'))
    renderSelector()
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => {
      expect(screen.getByText('Failed to load categories')).toBeInTheDocument()
    })
  })
})
