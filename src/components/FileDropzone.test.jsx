// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import FileDropzone from './FileDropzone.jsx'

// Mock the data layer so fetchExamples() resolves deterministically with no
// real network call. The component imports all three named exports.
vi.mock('../lib/sampleData.js', () => ({
  fetchExamples: vi.fn(),
  fetchExampleFile: vi.fn(),
  fetchExampleSidecar: vi.fn(),
  fetchClassificationBundle: vi.fn(),
  fetchRemoteFile: vi.fn(),
}))

import { fetchExamples, fetchExampleFile, fetchRemoteFile } from '../lib/sampleData.js'

const SAMPLE_EXAMPLES = [
  { id: 'demo-a', label: 'Demo A', description: 'first', entry: '/a.csv', sidecar: null },
  { id: 'demo-b', label: 'Demo B', description: 'second', entry: '/b.csv', sidecar: null },
]

describe('FileDropzone — examples manifest loading', () => {
  beforeEach(() => {
    fetchExamples.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  // Regression: ISSUE-001 — examples dropdown stuck on "Loading examples…"
  // Found by /qa on 2026-05-21
  // Report: .gstack/qa-reports/qa-report-localhost-2026-05-21.md
  //
  // The bug: the `mountedRef` effect set mountedRef.current = false on unmount
  // but never restored it to true on mount. React 18 StrictMode mounts →
  // unmounts → remounts every component, leaving mountedRef.current permanently
  // false. The fetchExamples() success/finally callbacks are all guarded by
  // `if (mountedRef.current)`, so setExamples / setLoadingExamples(false) never
  // ran and the dropdown stayed disabled showing "Loading examples…".
  //
  // This test MUST render under <StrictMode> — without the mount/unmount/remount
  // cycle the bug does not reproduce.
  it('populates and enables the dropdown after fetch resolves (under StrictMode)', async () => {
    fetchExamples.mockResolvedValue(SAMPLE_EXAMPLES)

    render(
      <StrictMode>
        <FileDropzone onFile={() => {}} onSidecar={() => {}} hasData={false} />
      </StrictMode>
    )

    const select = screen.getByLabelText('Examples')
    // While the manifest is in flight the control is disabled.
    expect(select.disabled).toBe(true)

    // Once the manifest resolves the dropdown must enable and list every example.
    // On the buggy code this never happens and waitFor times out.
    await waitFor(() => expect(select.disabled).toBe(false))
    expect(screen.getByRole('option', { name: 'Demo A' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Demo B' })).toBeTruthy()
    // The "Loading examples…" placeholder is replaced by the idle "Examples…" text.
    expect(screen.queryByRole('option', { name: 'Loading examples…' })).toBeNull()
  })

  // Companion edge case: a failed manifest fetch must still terminate the
  // loading state (the `finally` block), not leave the dropdown stuck.
  it('stops the loading state when the manifest fetch fails (under StrictMode)', async () => {
    fetchExamples.mockRejectedValue(new Error('HTTP 500'))
    // The component logs the failure via console.error — silence it for clean output.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <StrictMode>
        <FileDropzone onFile={() => {}} onSidecar={() => {}} hasData={false} />
      </StrictMode>
    )

    // Loading must end even on failure: the placeholder stops saying "Loading…".
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Loading examples…' })).toBeNull()
    )
    expect(screen.getByRole('option', { name: 'Examples…' })).toBeTruthy()

    errSpy.mockRestore()
  })

  it('clears the data file input value so local files can be reloaded after selecting an example', async () => {
    fetchExamples.mockResolvedValue(SAMPLE_EXAMPLES)
    const exampleFile = new File(['example'], 'example.csv', { type: 'text/csv' })
    fetchExampleFile.mockResolvedValue(exampleFile)
    const onFile = vi.fn().mockResolvedValue(undefined)

    const { container } = render(
      <StrictMode>
        <FileDropzone onFile={onFile} onSidecar={() => {}} hasData={false} />
      </StrictMode>
    )

    await waitFor(() => expect(screen.getByLabelText('Examples').disabled).toBe(false))

    const fileInput = container.querySelector('input[type="file"][accept=".csv,.tsv,.xlsx,.xls,.rdf"]')
    expect(fileInput).toBeTruthy()
    const firstLocalFile = new File(['first'], 'local.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [firstLocalFile] } })
    expect(onFile).toHaveBeenCalledWith(firstLocalFile)
    expect(fileInput.value).toBe('')

    fireEvent.change(screen.getByLabelText('Examples'), { target: { value: 'demo-a' } })
    await waitFor(() => expect(fetchExampleFile).toHaveBeenCalledWith('/a.csv'))
    expect(onFile).toHaveBeenCalledWith(exampleFile, { sourcePath: '/a.csv' })

    const secondLocalFile = new File(['second'], 'local.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [secondLocalFile] } })
    expect(onFile).toHaveBeenCalledWith(secondLocalFile)
    expect(fileInput.value).toBe('')
  })

  it('passes multiple RDF files together when all selected files are .rdf', async () => {
    fetchExamples.mockResolvedValue(SAMPLE_EXAMPLES)
    const onFile = vi.fn()
    const onRdf = vi.fn()
    const { container } = render(
      <StrictMode>
        <FileDropzone onFile={onFile} onRdf={onRdf} onSidecar={() => {}} hasData={false} />
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByLabelText('Examples').disabled).toBe(false))

    const fileInput = container.querySelector('input[type="file"][accept=".csv,.tsv,.xlsx,.xls,.rdf"]')
    const inputRdf = new File(['input'], 'streamflow.rdf', { type: 'application/xml' })
    const outputRdf = new File(['output'], 'res.rdf', { type: 'application/xml' })
    fireEvent.change(fileInput, { target: { files: [inputRdf, outputRdf] } })

    expect(onRdf).toHaveBeenCalledWith([inputRdf, outputRdf])
    expect(onFile).not.toHaveBeenCalled()
    expect(fileInput.value).toBe('')
  })

  it('lists loaded RDF files with working remove buttons', async () => {
    fetchExamples.mockResolvedValue(SAMPLE_EXAMPLES)
    const onRemoveRdfFile = vi.fn()
    render(
      <StrictMode>
        <FileDropzone
          onFile={() => {}}
          onSidecar={() => {}}
          hasData={false}
          rdfFileNames={['streamflow.rdf', 'res.rdf']}
          onRemoveRdfFile={onRemoveRdfFile}
        />
      </StrictMode>
    )

    expect(screen.getByText('streamflow.rdf')).toBeTruthy()
    expect(screen.getByText('res.rdf')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Remove res.rdf'))
    expect(onRemoveRdfFile).toHaveBeenCalledWith('res.rdf')
  })
})

describe('FileDropzone — loading from a web URL', () => {
  beforeEach(() => {
    fetchExamples.mockReset()
    fetchExamples.mockResolvedValue([])
    fetchRemoteFile.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  function submitUrl(value) {
    const input = screen.getByLabelText('Data file URL')
    fireEvent.change(input, { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Load URL' }))
  }

  it('fetches a CSV URL and routes it through onFile with the URL as sourcePath', async () => {
    const remoteFile = new File(['csv'], 'data.csv', { type: 'text/csv' })
    fetchRemoteFile.mockResolvedValue(remoteFile)
    const onFile = vi.fn().mockResolvedValue(undefined)
    const onRdf = vi.fn()

    render(
      <StrictMode>
        <FileDropzone onFile={onFile} onRdf={onRdf} hasData={false} />
      </StrictMode>
    )

    submitUrl('https://cdn.example.com/data.csv')

    await waitFor(() =>
      expect(fetchRemoteFile).toHaveBeenCalledWith('https://cdn.example.com/data.csv')
    )
    await waitFor(() =>
      expect(onFile).toHaveBeenCalledWith(remoteFile, {
        sourcePath: 'https://cdn.example.com/data.csv',
      })
    )
    expect(onRdf).not.toHaveBeenCalled()
    // The input clears on success so a follow-up URL can be pasted.
    await waitFor(() => expect(screen.getByLabelText('Data file URL').value).toBe(''))
  })

  it('routes a fetched .rdf URL through onRdf with the URL as sourcePath', async () => {
    const remoteFile = new File(['rdf'], 'res.rdf', { type: 'text/plain' })
    fetchRemoteFile.mockResolvedValue(remoteFile)
    const onFile = vi.fn()
    const onRdf = vi.fn().mockResolvedValue(undefined)

    render(
      <StrictMode>
        <FileDropzone onFile={onFile} onRdf={onRdf} hasData={false} />
      </StrictMode>
    )

    submitUrl('https://cdn.example.com/res.rdf?token=abc')

    await waitFor(() =>
      expect(onRdf).toHaveBeenCalledWith(remoteFile, {
        sourcePath: 'https://cdn.example.com/res.rdf?token=abc',
      })
    )
    expect(onFile).not.toHaveBeenCalled()
  })

  it('shows the fetch error and keeps the typed URL so it can be corrected', async () => {
    fetchRemoteFile.mockRejectedValue(new Error('Failed to fetch https://x (HTTP 404)'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <StrictMode>
        <FileDropzone onFile={vi.fn()} onRdf={vi.fn()} hasData={false} />
      </StrictMode>
    )

    submitUrl('https://x')

    await waitFor(() =>
      expect(screen.getByText('Failed to fetch https://x (HTTP 404)')).toBeTruthy()
    )
    expect(screen.getByLabelText('Data file URL').value).toBe('https://x')

    errSpy.mockRestore()
  })
})
