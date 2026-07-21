import 'express-session'

declare module 'express-session' {
    interface SessionData {
        csrfToken?: string
        auth?: {
            userId: string
            sessionVersion: number
        }
        twoFactorChallenge?: {
            userId: string
            sessionVersion: number
        }
    }
}
