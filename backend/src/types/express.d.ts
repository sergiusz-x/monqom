declare namespace Express {
    interface Request {
        workspace?: {
            workspaceId: string
            role: string
        }
        machine?: import('../modules/integrations/integration-credential.service').MachinePrincipal
    }
}
