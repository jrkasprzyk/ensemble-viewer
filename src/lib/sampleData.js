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
