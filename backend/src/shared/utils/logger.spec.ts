import { logger } from './logger'

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
})
