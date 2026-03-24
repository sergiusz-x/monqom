import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CategoriesRepository } from './categories.repository'
import { CategoriesService } from './categories.service'

describe('CategoriesService', () => {
    let service: CategoriesService
    let categoriesRepository: jest.Mocked<
        Pick<CategoriesRepository, 'findCategoryById' | 'listCategoriesByWorkspace'>
    >

    beforeEach(() => {
        categoriesRepository = {
            findCategoryById: jest.fn(),
            listCategoriesByWorkspace: jest.fn(),
        }

        service = new CategoriesService(categoriesRepository as unknown as CategoriesRepository)
    })

    it('lists non-archived categories as a two-level hierarchy sorted by sort order', async () => {
        categoriesRepository.listCategoriesByWorkspace.mockResolvedValue([
            {
                id: 'child-restaurants',
                parentId: 'parent-food',
                name: 'Restaurants',
                icon: '🍝',
                sortOrder: 2,
                deletedAt: null,
            },
            {
                id: 'parent-transport',
                parentId: null,
                name: 'Transport',
                icon: '🚗',
                sortOrder: 2,
                deletedAt: null,
            },
            {
                id: 'parent-food',
                parentId: null,
                name: 'Food',
                icon: '🍽️',
                sortOrder: 1,
                deletedAt: null,
            },
            {
                id: 'child-groceries',
                parentId: 'parent-food',
                name: 'Groceries',
                icon: '🛒',
                sortOrder: 1,
                deletedAt: null,
            },
        ] as never)

        await expect(service.listCategories({}, ' workspace-1 ')).resolves.toEqual([
            {
                id: 'parent-food',
                name: 'Food',
                icon: '🍽️',
                parent_id: null,
                sort_order: 1,
                children: [
                    {
                        id: 'child-groceries',
                        name: 'Groceries',
                        icon: '🛒',
                        parent_id: 'parent-food',
                        sort_order: 1,
                        children: [],
                    },
                    {
                        id: 'child-restaurants',
                        name: 'Restaurants',
                        icon: '🍝',
                        parent_id: 'parent-food',
                        sort_order: 2,
                        children: [],
                    },
                ],
            },
            {
                id: 'parent-transport',
                name: 'Transport',
                icon: '🚗',
                parent_id: null,
                sort_order: 2,
                children: [],
            },
        ])

        expect(categoriesRepository.listCategoriesByWorkspace).toHaveBeenCalledWith(
            'workspace-1',
            false,
        )
    })

    it('includes archived categories when include_archived=true', async () => {
        categoriesRepository.listCategoriesByWorkspace.mockResolvedValue([])

        await service.listCategories({ include_archived: 'true' }, 'workspace-1')

        expect(categoriesRepository.listCategoriesByWorkspace).toHaveBeenCalledWith(
            'workspace-1',
            true,
        )
    })

    it('rejects invalid include_archived values', async () => {
        await expect(
            service.listCategories({ include_archived: 'sometimes' }, 'workspace-1'),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(categoriesRepository.listCategoriesByWorkspace).not.toHaveBeenCalled()
    })

    it('returns a parent category with its nested children', async () => {
        categoriesRepository.findCategoryById.mockResolvedValue({
            id: 'parent-food',
            parentId: null,
            name: 'Food',
            icon: '🍽️',
            sortOrder: 1,
            deletedAt: null,
        } as never)
        categoriesRepository.listCategoriesByWorkspace.mockResolvedValue([
            {
                id: 'parent-food',
                parentId: null,
                name: 'Food',
                icon: '🍽️',
                sortOrder: 1,
                deletedAt: null,
            },
            {
                id: 'child-groceries',
                parentId: 'parent-food',
                name: 'Groceries',
                icon: '🛒',
                sortOrder: 1,
                deletedAt: null,
            },
        ] as never)

        await expect(
            service.getCategoryById(' parent-food ', {}, ' workspace-1 '),
        ).resolves.toEqual({
            id: 'parent-food',
            name: 'Food',
            icon: '🍽️',
            parent_id: null,
            sort_order: 1,
            children: [
                {
                    id: 'child-groceries',
                    name: 'Groceries',
                    icon: '🛒',
                    parent_id: 'parent-food',
                    sort_order: 1,
                    children: [],
                },
            ],
        })
    })

    it('returns a child category without nested descendants', async () => {
        categoriesRepository.findCategoryById.mockResolvedValue({
            id: 'child-groceries',
            parentId: 'parent-food',
            name: 'Groceries',
            icon: '🛒',
            sortOrder: 1,
            deletedAt: null,
        } as never)

        await expect(
            service.getCategoryById('child-groceries', {}, 'workspace-1'),
        ).resolves.toEqual({
            id: 'child-groceries',
            name: 'Groceries',
            icon: '🛒',
            parent_id: 'parent-food',
            sort_order: 1,
            children: [],
        })

        expect(categoriesRepository.listCategoriesByWorkspace).not.toHaveBeenCalled()
    })

    it('throws not found when the category is missing', async () => {
        categoriesRepository.findCategoryById.mockResolvedValue(null)

        await expect(service.getCategoryById('missing', {}, 'workspace-1')).rejects.toBeInstanceOf(
            NotFoundException,
        )
    })
})
