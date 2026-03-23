declare namespace Express {
    interface Request {
        workspace?: {
            workspaceId: string
            role: string
        }
    }
}
