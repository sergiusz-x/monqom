declare module 'connect-pg-simple' {
    import session from 'express-session'

    interface ConnectPgSimpleOptions {
        conString?: string
        createTableIfMissing?: boolean
        tableName?: string
        ttl?: number
    }

    type ConnectPgSimpleFactory = (
        sessionModule: typeof session,
    ) => new (options?: ConnectPgSimpleOptions) => session.Store

    const connectPgSimple: ConnectPgSimpleFactory

    export default connectPgSimple
}
