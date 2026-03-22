import { requestLoggerMiddleware } from './requestLogger'
import { Request, Response } from 'express'
import { logger } from '../utils/logger'

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}))

describe('requestLoggerMiddleware', () => {
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let nextFunction: jest.Mock
    let finishCallback: () => void

    beforeEach(() => {
        mockRequest = {
            method: 'GET',
            originalUrl: '/api/v1/test',
            id: 'req-123',
        }

        mockResponse = {
            statusCode: 200,
            on: jest.fn((event, callback) => {
                if (event === 'finish') {
                    finishCallback = callback
                }
                return mockResponse as Response
            }),
        }
        nextFunction = jest.fn()
        jest.clearAllMocks()
    })

    it('should log successful requests as info', () => {
        requestLoggerMiddleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function))
        expect(nextFunction).toHaveBeenCalled()

        finishCallback()

        expect(logger.info).toHaveBeenCalledWith(
            expect.stringMatching(/^GET \/api\/v1\/test 200 \d+ms$/),
            expect.objectContaining({
                context_name: 'HTTP',
                request_id: 'req-123',
            }),
        )
    })

    it('should log client errors as warnings', () => {
        mockResponse.statusCode = 409

        requestLoggerMiddleware(mockRequest as Request, mockResponse as Response, nextFunction)
        finishCallback()

        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/^GET \/api\/v1\/test 409 \d+ms$/),
            expect.objectContaining({
                context_name: 'HTTP',
                request_id: 'req-123',
            }),
        )
    })
})
