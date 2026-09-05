import { destroySession } from './session-lifecycle'

describe('destroySession', () => {
    it('resolves after the session store confirms destruction', async () => {
        const destroy = jest.fn((callback: (error?: Error) => void) => callback())

        await expect(destroySession({ session: { destroy } } as never)).resolves.toBeUndefined()
        expect(destroy).toHaveBeenCalledTimes(1)
    })

    it('preserves session-store failures', async () => {
        const error = new Error('session store unavailable')
        const destroy = jest.fn((callback: (error?: Error) => void) => callback(error))

        await expect(destroySession({ session: { destroy } } as never)).rejects.toThrow(error)
    })
})
