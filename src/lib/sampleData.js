// Small, representative sample CSV for demo purposes.
// Export helpers that return a `File` so the app can parse it like a
// user-provided file. Also try fetching a hosted copy first.

const sampleCsv = `year,RCP85_CanESM5_run1,RCP85_CanESM5_run2,RCP45_MIROC6_run1,RCP45_MIROC6_run2
2010,100,102,98,97
2011,101,103,99,98
2012,102,105,97,96
2013,104,107,100,99
2014,105,108,101,100
2015,106,110,102,101
2016,107,111,103,103
2017,108,112,104,104
2018,109,113,105,105
2019,110,114,106,106
2020,111,115,107,107
`

export function getSampleFile() {
  return new File([sampleCsv], 'ensemble-sample.csv', { type: 'text/csv' })
}

export async function fetchHostedSample(path = '/sample-data/ensemble.csv') {
  // Try to fetch a hosted copy (works when the app is deployed and the
  // `public/` folder is served at the site root). Throws on failure.
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return new File([text], path.split('/').pop() || 'ensemble-sample.csv', { type: 'text/csv' })
}

export async function fetchExamples() {
  const res = await fetch('/examples.json')
  if (!res.ok) throw new Error(`Failed to load examples manifest (HTTP ${res.status})`)
  const payload = await res.json()
  if (!Array.isArray(payload)) throw new Error('Invalid examples manifest format')
  return payload
}

export async function fetchExampleFile(entry) {
  return fetchFileAsUpload(entry)
}

export async function fetchExampleSidecar(sidecar) {
  return fetchFileAsUpload(sidecar)
}

export async function fetchClassificationBundle(paths) {
  return Promise.all(paths.map((path) => fetchFileAsUpload(path)))
}

// Fetch an arbitrary web URL (e.g. a CDN-hosted CSV/XLSX/RDF) and wrap it as
// a File so it flows through the same parse pipeline as a local upload.
// Cross-origin fetches require the remote server to send CORS headers; when
// they're missing the browser surfaces an opaque TypeError, so translate it
// into something actionable.
export async function fetchRemoteFile(url) {
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error(
      `Could not reach ${url} — check the URL, or the server may not allow cross-origin (CORS) requests.`
    )
  }
  if (!res.ok) throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`)
  const blob = await res.blob()
  return new File([blob], getFileName(url), { type: blob.type || 'text/csv' })
}

async function fetchFileAsUpload(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to fetch ${path} (HTTP ${res.status})`)
  const blob = await res.blob()
  return new File([blob], getFileName(path), { type: blob.type || 'text/csv' })
}

function getFileName(path) {
  // Strip query string / hash first so CDN URLs like .../data.rdf?token=…
  // keep their real extension (extension drives CSV vs XLSX vs RDF routing).
  const pathname = path.split(/[?#]/)[0]
  return pathname.split('/').pop() || 'example.csv'
}
