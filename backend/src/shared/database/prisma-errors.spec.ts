import { isPrismaUniqueConstraintError } from './prisma-errors'

describe('isPrismaUniqueConstraintError', () => {
    it.each([
        [{ code: 'P2002' }, true],
        [{ code: 'P2003' }, false],
        [{ code: 2002 }, false],
        [null, false],
        ['P2002', false],
    ])('classifies %p as %s', (error, expected) => {
        expect(isPrismaUniqueConstraintError(error)).toBe(expected)
    })
})
