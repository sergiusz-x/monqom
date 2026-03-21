import { AllExceptionsFilter } from './http-exception.filter'
import { ArgumentsHost, HttpException, HttpStatus, BadRequestException } from '@nestjs/common'
import { logger } from '../utils/logger'

jest.mock('../utils/logger', () => ({
    logger: {
        error: jest.fn(),
    },
}))

describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter
    let mockResponse: any
    let mockRequest: any
    let mockArgumentsHost: Partial<ArgumentsHost>

    beforeEach(() => {
        filter = new AllExceptionsFilter()

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }

        mockRequest = {
            method: 'GET',
            originalUrl: '/test',
            id: 'test-req-id',
        }

        mockArgumentsHost = {
            switchToHttp: jest.fn().mockReturnValue({
                getResponse: () => mockResponse,
                getRequest: () => mockRequest,
            }),
        }

        ;(logger.error as jest.Mock).mockClear()
        process.env.NODE_ENV = 'development'
    })

    it('should be defined', () => {
        expect(filter).toBeDefined()
    })

    it('should handle HttpException (404)', () => {
        const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND)

        filter.catch(exception, mockArgumentsHost as ArgumentsHost)

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'Not Found',
                error: 'HttpException',
            }),
        )
        expect(logger.error).toHaveBeenCalled()
    })

    it('should handle BadRequestException with validation format', () => {
        const exceptionResponse = {
            message: ['a should not be empty'],
            error: 'Bad Request',
            statusCode: 400,
        }
        const exception = new BadRequestException(exceptionResponse)

        filter.catch(exception, mockArgumentsHost as ArgumentsHost)

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: HttpStatus.BAD_REQUEST,
                message: ['a should not be empty'],
                error: 'Bad Request',
            }),
        )
    })

    it('should handle generic errors as 500 Internal Server Error', () => {
        const exception = new Error('Some unexpected error')

        filter.catch(exception, mockArgumentsHost as ArgumentsHost)

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Internal server error',
                error: 'Internal Server Error',
            }),
        )
        expect(logger.error).toHaveBeenCalledWith('Some unexpected error', expect.any(Object))
    })

    it('should include stack trace in development mode', () => {
        process.env.NODE_ENV = 'development'
        const exception = new Error('Test Error')

        filter.catch(exception, mockArgumentsHost as ArgumentsHost)

        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                stack: expect.any(String),
            }),
        )
    })

    it('should not include stack trace in production mode', () => {
        process.env.NODE_ENV = 'production'
        const exception = new Error('Test Error')

        filter.catch(exception, mockArgumentsHost as ArgumentsHost)

        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.not.objectContaining({
                stack: expect.any(String),
            }),
        )
    })
})
