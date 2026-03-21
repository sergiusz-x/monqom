import { requestLoggerMiddleware } from './requestLogger'
import { Request, Response } from 'express'
import { logger } from '../utils/logger'

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
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

    it('should attach finish event and log on completion', () => {
        requestLoggerMiddleware(mockRequest as Request, mockResponse as Response, nextFunction)
        
        expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function))
        expect(nextFunction).toHaveBeenCalled()
        
        finishCallback()
        
        expect(logger.info).toHaveBeenCalledWith(
            'HTTP GET /api/v1/test',
            expect.objectContaining({
                request_id: 'req-123',
                context: expect.objectContaining({
                    method: 'GET',
                    path: '/api/v1/test',
                    status_code: 200,
                    duration_ms: expect.any(Number),
                })
            })
        )
    })
})
