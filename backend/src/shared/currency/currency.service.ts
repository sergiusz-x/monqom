import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common'

export const SUPPORTED_CURRENCIES = [
    'PLN',
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'CZK',
    'SEK',
    'NOK',
    'DKK',
    'HUF',
    'RON',
] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export interface FxQuote {
    rate: number
    rateDate: Date
    source: 'ecb-frankfurter'
}

@Injectable()
export class CurrencyService {
    private readonly cache = new Map<string, Promise<FxQuote>>()

    async getHistoricalQuote(from: string, to: string, requestedDate: Date): Promise<FxQuote> {
        const base = normalizeCurrency(from)
        const quote = normalizeCurrency(to)
        assertValidDate(requestedDate)

        if (base === quote) {
            return { rate: 1, rateDate: startOfUtcDay(requestedDate), source: 'ecb-frankfurter' }
        }

        const effectiveDate = requestedDate > new Date() ? new Date() : requestedDate
        const date = effectiveDate.toISOString().slice(0, 10)
        const cacheKey = `${date}:${base}:${quote}`
        const cached = this.cache.get(cacheKey)
        if (cached) return cached

        const pending = this.fetchQuote(base, quote, date).catch((error) => {
            this.cache.delete(cacheKey)
            throw error
        })
        this.cache.set(cacheKey, pending)
        return pending
    }

    private async fetchQuote(
        base: SupportedCurrency,
        quote: SupportedCurrency,
        date: string,
    ): Promise<FxQuote> {
        let response: Response
        try {
            response = await fetch(`https://api.frankfurter.app/${date}?from=${base}&to=${quote}`, {
                signal: AbortSignal.timeout(5000),
                headers: { Accept: 'application/json' },
            })
        } catch {
            throw new BadGatewayException('FX rate provider is unavailable')
        }

        if (!response.ok) throw new BadGatewayException('FX rate provider is unavailable')
        const payload = (await response.json()) as { date?: string; rates?: Record<string, number> }
        const rate = payload.rates?.[quote]
        if (!payload.date || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
            throw new BadGatewayException('No FX rate is available for this date')
        }

        return {
            rate,
            rateDate: new Date(`${payload.date}T00:00:00.000Z`),
            source: 'ecb-frankfurter',
        }
    }
}

export function normalizeCurrency(value: unknown): SupportedCurrency {
    if (typeof value !== 'string') throw new BadRequestException('Currency is required')
    const currency = value.trim().toUpperCase()
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
        throw new BadRequestException(`Unsupported currency: ${currency}`)
    }
    return currency as SupportedCurrency
}

function assertValidDate(value: Date): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new BadRequestException('FX rate date is invalid')
    }
}

function startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
