import { json, type NextFunction, type Request, type Response } from 'express'

const MACHINE_PATH =
    /^\/api\/v1\/workspaces\/[^/]+\/external-(?:transactions(?:\/[^/]+)?|categories|payment-sources)\/?$/
const parseJson = json({ limit: '64kb' })
const bodyErrors = new WeakMap<Request, 400 | 413 | 415>()

export function externalBodyError(request: Request) {
    return bodyErrors.get(request)
}

/** Register before Nest's default body parser. Parser errors never echo submitted content. */
export function externalApiBodyMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
): void {
    if (!MACHINE_PATH.test(request.path)) {
        next()
        return
    }
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Pragma', 'no-cache')
    if (['POST', 'PUT'].includes(request.method) && !request.is('application/json')) {
        bodyErrors.set(request, 415)
        next()
        return
    }
    parseJson(request, response, (error?: unknown) => {
        if (!error) {
            next()
            return
        }
        const tooLarge =
            typeof error === 'object' &&
            error !== null &&
            'type' in error &&
            error.type === 'entity.too.large'
        // Defer the bounded failure until after authentication and the shared request budget.
        // The consumed stream is not reparsed by Nest; no submitted content is retained here.
        bodyErrors.set(request, tooLarge ? 413 : 400)
        next()
    })
}
