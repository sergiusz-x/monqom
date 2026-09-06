import 'reflect-metadata'
import { GoalsController } from './goals.controller'
import { WORKSPACE_ROLE_KEY } from '../../shared/guards/workspace-role.guard'

describe('GoalsController authorization policy', () => {
    const mutations = [
        'create',
        'update',
        'archive',
        'restore',
        'delete',
        'createOperation',
        'updateOperation',
        'deleteOperation',
    ] as const

    it.each(mutations)('requires an admin-or-owner role for %s', (method) => {
        expect(Reflect.getMetadata(WORKSPACE_ROLE_KEY, GoalsController.prototype[method])).toBe(
            'admin',
        )
    })

    it.each(['list', 'get'] as const)('keeps %s available to workspace members', (method) => {
        expect(Reflect.getMetadata(WORKSPACE_ROLE_KEY, GoalsController.prototype[method])).toBeUndefined()
    })
})
