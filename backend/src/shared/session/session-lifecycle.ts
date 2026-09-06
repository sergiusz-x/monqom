import type { Request } from 'express'

export function destroySession(request: Pick<Request, 'session'>): Promise<void> {
    return new Promise((resolve, reject) => {
        request.session.destroy((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}
