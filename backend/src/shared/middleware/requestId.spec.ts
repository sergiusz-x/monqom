import { requestIdMiddleware } from './requestId'
import { Request, Response } from 'express'
import crypto from 'crypto'

describe('requestIdMiddleware', () => {
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let nextFunction: jest.Mock

    beforeEach(() => {
        mockRequest = {
            headers: {},
        }
        mockResponse = {
            setHeader: jest.fn(),
        }
        nextFunction = jest.fn()
    })

    it('should assign a new UUID if x-request-id is not provided', () => {
        requestIdMiddleware(mockRequest as Request, mockResponse as Response, nextFunction)
        expect(mockRequest.id).toBeDefined()
        expect(typeof mockRequest.id).toBe('string')
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', mockRequest.id)
        expect(nextFunction).toHaveBeenCalled()
    })

    it('should reuse existing x-request-id from headers if provided', () => {
        mockRequest.headers = { 'x-request-id': 'custom-id-123' }
        requestIdMiddleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockRequest.id).toBe('custom-id-123')
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', 'custom-id-123')
        expect(nextFunction).toHaveBeenCalled()
    })
})
