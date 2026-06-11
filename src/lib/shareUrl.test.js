// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getSharedDatasetUrl, isShareableSource, syncSharedDatasetUrl } from './shareUrl.js'

describe('getSharedDatasetUrl', () => {
  it('returns the url param when present', () => {
    expect(getSharedDatasetUrl('?url=https%3A%2F%2Fcdn.example%2Fres.rdf')).toBe(
      'https://cdn.example/res.rdf'
    )
  })

  it('returns an empty string when absent', () => {
    expect(getSharedDatasetUrl('')).toBe('')
    expect(getSharedDatasetUrl('?other=1')).toBe('')
  })
})

describe('isShareableSource', () => {
  it('accepts http(s) URLs only', () => {
    expect(isShareableSource('https://cdn.example/data.csv')).toBe(true)
    expect(isShareableSource('http://cdn.example/data.csv')).toBe(true)
    expect(isShareableSource('/crmms-esp/res.rdf')).toBe(false)
    expect(isShareableSource('local.csv')).toBe(false)
    expect(isShareableSource('')).toBe(false)
    expect(isShareableSource(null)).toBe(false)
  })
})

describe('syncSharedDatasetUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('writes the url param for a web source, preserving other params', () => {
    window.history.replaceState(null, '', '/?theme=dark')

    syncSharedDatasetUrl('https://cdn.example/res.rdf')

    const params = new URLSearchParams(window.location.search)
    expect(params.get('url')).toBe('https://cdn.example/res.rdf')
    expect(params.get('theme')).toBe('dark')
  })

  it('clears the url param when a local file replaces a web dataset', () => {
    window.history.replaceState(null, '', '/?url=https%3A%2F%2Fcdn.example%2Fold.csv')

    syncSharedDatasetUrl('local.csv')

    expect(window.location.search).toBe('')
  })

  it('clears the url param for bundled example paths', () => {
    window.history.replaceState(null, '', '/?url=https%3A%2F%2Fcdn.example%2Fold.csv')

    syncSharedDatasetUrl('/crmms-esp/res.rdf')

    expect(window.location.search).toBe('')
  })
})
