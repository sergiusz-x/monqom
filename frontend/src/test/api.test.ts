import { describe, it, expect } from 'vitest'
import api from '@/lib/api'

describe('api client', () => {
  it('has the correct baseURL', () => {
    expect(api.defaults.baseURL).toBe('/api/v1')
  })

  it('sends credentials with every request', () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  it('defaults to JSON content type', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})
