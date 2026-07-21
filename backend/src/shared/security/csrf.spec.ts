import type { NextFunction, Request, Response } from 'express'
import { CSRF_INVALID_CODE, csrfProtectionMiddleware, getOrCreateCsrfToken } from './csrf'

describe('CSRF protection', () => {
    function createResponse(): Response {
        const response = {
            status: jest.fn(),
            json: jest.fn(),
        }
        response.status.mockReturnValue(response)
        return response as never as Response
    }

    it('creates one unpredictable token per session', () => {
        const request = { session: {} } as never as Request

        const firstToken = getOrCreateCsrfToken(request)
        const secondToken = getOrCreateCsrfToken(request)

        expect(firstToken).toBe(secondToken)
        expect(firstToken.length).toBeGreaterThanOrEqual(40)
    })

    it('allows safe methods without a token', () => {
        const request = { method: 'GET', session: {} } as never as Request
        const response = createResponse()
        const next = jest.fn() as NextFunction

        csrfProtectionMiddleware(request, response, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(response.status).not.toHaveBeenCalled()
    })

    it('allows a mutation only when the header matches the session token', () => {
        const request = {
            method: 'POST',
            session: { csrfToken: 'valid-token' },
            get: jest.fn().mockReturnValue('valid-token'),
        } as never as Request
        const response = createResponse()
        const next = jest.fn() as NextFunction

        csrfProtectionMiddleware(request, response, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(response.status).not.toHaveBeenCalled()
    })

    it.each([undefined, 'wrong-token'])(
        'rejects a mutation with an absent or invalid token',
        (requestToken) => {
            const request = {
                method: 'DELETE',
                session: { csrfToken: 'valid-token' },
                get: jest.fn().mockReturnValue(requestToken),
            } as never as Request
            const response = createResponse()
            const next = jest.fn() as NextFunction

            csrfProtectionMiddleware(request, response, next)

            expect(next).not.toHaveBeenCalled()
            expect(response.status).toHaveBeenCalledWith(403)
            expect(response.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: CSRF_INVALID_CODE }),
            )
        },
    )
})
