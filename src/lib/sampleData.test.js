// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRemoteFile } from './sampleData.js'

describe('fetchRemoteFile', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wraps the response as a File named from the URL path, ignoring query/hash', async () => {
    fetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['a,b\n1,2'], { type: 'text/csv' }),
    })

    const file = await fetchRemoteFile('https://cdn.example.com/runs/data.rdf?token=abc#frag')

    expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/runs/data.rdf?token=abc#frag')
    // The name must keep the real extension — it drives CSV/XLSX/RDF routing.
    expect(file.name).toBe('data.rdf')
    expect(await file.text()).toBe('a,b\n1,2')
  })

  it('throws with the HTTP status on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 })

    await expect(fetchRemoteFile('https://cdn.example.com/missing.csv')).rejects.toThrow(
      'HTTP 404'
    )
  })

  it('translates a network/CORS failure into an actionable message', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchRemoteFile('https://cdn.example.com/data.csv')).rejects.toThrow(
      /cross-origin \(CORS\)/
    )
  })
})
