import { BadGatewayException, BadRequestException } from '@nestjs/common'
import { CurrencyService, normalizeCurrency } from './currency.service'

describe('CurrencyService', () => {
    const originalFetch = global.fetch
    afterEach(() => {
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    it('normalizes and validates supported currencies', () => {
        expect(normalizeCurrency(' pln ')).toBe('PLN')
        expect(() => normalizeCurrency('JPY')).toThrow(BadRequestException)
    })

    it('returns an identity quote without a provider call', async () => {
        global.fetch = jest.fn() as never
        await expect(
            new CurrencyService().getHistoricalQuote(
                'EUR',
                'EUR',
                new Date('2026-03-22T18:00:00Z'),
            ),
        ).resolves.toEqual({
            rate: 1,
            rateDate: new Date('2026-03-22T00:00:00Z'),
            source: 'ecb-frankfurter',
        })
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('uses the provider date and caches immutable historical quotes', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ date: '2026-03-20', rates: { PLN: 4.25 } }),
        }) as never
        const service = new CurrencyService()
        const first = await service.getHistoricalQuote(
            'EUR',
            'PLN',
            new Date('2026-03-22T00:00:00Z'),
        )
        const second = await service.getHistoricalQuote(
            'EUR',
            'PLN',
            new Date('2026-03-22T12:00:00Z'),
        )
        expect(first).toEqual({
            rate: 4.25,
            rateDate: new Date('2026-03-20T00:00:00Z'),
            source: 'ecb-frankfurter',
        })
        expect(second).toEqual(first)
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('fails closed when the provider is unavailable', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never
        await expect(
            new CurrencyService().getHistoricalQuote('EUR', 'PLN', new Date('2026-03-20')),
        ).rejects.toBeInstanceOf(BadGatewayException)
    })
})
