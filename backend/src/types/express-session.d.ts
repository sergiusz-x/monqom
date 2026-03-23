import 'express-session'

declare module 'express-session' {
    interface SessionData {
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
