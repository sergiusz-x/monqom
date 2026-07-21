import { appLogger, logger } from './logger'

describe('logger', () => {
    it('should be defined', () => {
        expect(logger).toBeDefined()
    })

    it('should have standard log methods', () => {
        expect(typeof logger.info).toBe('function')
        expect(typeof logger.error).toBe('function')
        expect(typeof logger.warn).toBe('function')
        expect(typeof logger.debug).toBe('function')
    })

    it('should expose a Nest-compatible logger adapter', () => {
        expect(typeof appLogger.log).toBe('function')
        expect(typeof appLogger.error).toBe('function')
        expect(typeof appLogger.warn).toBe('function')
    })
})
