import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuditService } from '../../shared/audit/audit.service'
import { PrismaService } from '../../shared/database/prisma.service'
import { CategoriesService } from './categories.service'

describe('CategoriesService', () => {
    let service: CategoriesService
    let prisma: { category: Record<string, jest.Mock>; $transaction: jest.Mock }
    let audit: { record: jest.Mock }

    beforeEach(() => {
        prisma = {
            category: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
                aggregate: jest.fn(),
            },
            $transaction: jest.fn(),
        }
        audit = { record: jest.fn() }
        service = new CategoriesService(
            prisma as unknown as PrismaService,
            audit as unknown as AuditService,
        )
    })

    it('returns workspace categories as a sorted two-level hierarchy', async () => {
        prisma.category.findMany.mockResolvedValue([
            {
                id: 'child',
                parentId: 'food',
                name: 'Groceries',
                systemKey: 'categories.groceries',
                icon: '🛒',
                sortOrder: 1,
                deletedAt: null,
            },
            {
                id: 'transport',
                parentId: null,
                name: 'Transport',
                systemKey: 'categories.transport',
                icon: '🚗',
                sortOrder: 2,
                deletedAt: null,
            },
            {
                id: 'food',
                parentId: null,
                name: 'Food',
                systemKey: 'categories.food',
                icon: '🍽️',
                sortOrder: 1,
                deletedAt: null,
            },
        ])

        await expect(service.listCategories({}, ' workspace-1 ')).resolves.toEqual([
            {
                id: 'food',
                name: 'Food',
                system_key: 'categories.food',
                icon: '🍽️',
                parent_id: null,
                sort_order: 1,
                is_archived: false,
                archived_at: null,
                children: [
                    {
                        id: 'child',
                        name: 'Groceries',
                        system_key: 'categories.groceries',
                        icon: '🛒',
                        parent_id: 'food',
                        sort_order: 1,
                        is_archived: false,
                        archived_at: null,
                        children: [],
                    },
                ],
            },
            {
                id: 'transport',
                name: 'Transport',
                system_key: 'categories.transport',
                icon: '🚗',
                parent_id: null,
                sort_order: 2,
                is_archived: false,
                archived_at: null,
                children: [],
            },
        ])
        expect(prisma.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { workspaceId: 'workspace-1', deletedAt: null } }),
        )
    })

    it('does not return a category outside the current workspace', async () => {
        prisma.category.findFirst.mockResolvedValue(null)
        await expect(service.getCategoryById('missing', {}, 'workspace-1')).rejects.toBeInstanceOf(
            NotFoundException,
        )
    })

    it('rejects a blank category name before writing to the database', async () => {
        await expect(
            service.createCategory({ name: '   ' }, 'workspace-1', 'user-1'),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(prisma.category.create).not.toHaveBeenCalled()
    })
})
