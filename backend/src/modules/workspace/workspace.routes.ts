export const WORKSPACE_BASE_ROUTE = 'workspaces'

export const WORKSPACE_ROUTE_PARAMS = {
    workspaceId: 'workspaceId',
} as const

export const WORKSPACE_SCOPED_BASE_ROUTE = `${WORKSPACE_BASE_ROUTE}/:${WORKSPACE_ROUTE_PARAMS.workspaceId}`
