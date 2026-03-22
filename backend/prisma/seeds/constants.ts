export const DEFAULT_WORKSPACE_ID = '5470e9c5-e03f-4e59-9750-f4600d5dd6bc'
export const DEFAULT_WORKSPACE_NAME = process.env.SEED_WORKSPACE_NAME ?? 'Monqom Seed Workspace'

export const DEFAULT_CATEGORIES = [
    {
        id: '2cf17de5-c6f7-45db-9aaf-b8f216504c8f',
        name: 'Housing',
        icon: 'home',
        children: [
            {
                id: '53733700-6f45-4bc7-baf9-851c13239508',
                name: 'Rent',
            },
            {
                id: 'c8d84cc0-fb5f-499f-8b87-866ebf1f9e3e',
                name: 'Utilities',
            },
        ],
    },
    {
        id: 'c6ee7e59-2f17-4473-8cf4-7b4a4bd4af4a',
        name: 'Food',
        icon: 'utensils',
        children: [
            {
                id: '3fc9da03-a558-4a89-8f76-15f56d7e9dfc',
                name: 'Groceries',
            },
            {
                id: '857a5c9b-1b93-44b2-ad0d-bf4cf2a404e0',
                name: 'Dining Out',
            },
        ],
    },
    {
        id: '8bd50d4d-c4d9-4874-a1cd-caa3be699ccf',
        name: 'Transport',
        icon: 'car',
        children: [
            {
                id: 'f0de7fd3-6b4f-4af7-8f87-f7fe05bbfdae',
                name: 'Fuel',
            },
            {
                id: '44d81e03-2a4d-47d4-81b6-4f09eeb9f0fc',
                name: 'Public Transit',
            },
        ],
    },
] as const

export const DEFAULT_PAYMENT_SOURCES = [
    {
        id: '03f8f03d-f958-4f37-af3d-1cb4775397be',
        name: 'Cash',
        type: 'cash',
    },
    {
        id: 'cb8dcf7d-c9be-4b4e-8a0e-58858c1b0e8f',
        name: 'Debit Card',
        type: 'debit_card',
    },
    {
        id: 'e7d0d5b8-5f3b-42ce-9e3c-77eca950b6fb',
        name: 'Credit Card',
        type: 'credit_card',
    },
    {
        id: '5a8484b6-f8a4-4240-b9db-9498f9ac292c',
        name: 'Bank Transfer',
        type: 'bank',
    },
    {
        id: 'f35921db-601a-4a1e-a052-89c54112f6ba',
        name: 'Other',
        type: 'other',
    },
] as const
