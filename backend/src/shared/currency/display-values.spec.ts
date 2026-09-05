import { basisPointsToDisplayPercentage, centsToDisplayAmount } from './display-values'

describe('financial display values', () => {
    it.each([
        [0, 0],
        [1, 0.01],
        [12345, 123.45],
        [-12345, -123.45],
    ])('converts %d cents to %d', (cents, expected) => {
        expect(centsToDisplayAmount(cents)).toBe(expected)
    })

    it.each([
        [0, 0],
        [100, 1],
        [125, 1.25],
        [-125, -1.25],
        [10, 0.1],
    ])('converts %d basis points to %d percent', (basisPoints, expected) => {
        expect(basisPointsToDisplayPercentage(basisPoints)).toBe(expected)
    })
})
