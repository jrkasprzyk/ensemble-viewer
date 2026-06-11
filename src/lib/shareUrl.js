// Shareable-link support: the app mirrors the currently loaded web-hosted
// dataset into a `?url=` query param so the address bar can be copied and
// opened elsewhere. Local files and bundled examples clear the param —
// a link to them would not resolve on another machine.

export function getSharedDatasetUrl(search = window.location.search) {
  return new URLSearchParams(search).get('url') || ''
}

export function isShareableSource(source) {
  return /^https?:\/\//i.test(source || '')
}

// Rewrite the address bar (no navigation, no history entry) to reflect the
// current dataset source. Other query params and the hash are preserved.
export function syncSharedDatasetUrl(source) {
  const params = new URLSearchParams(window.location.search)
  if (isShareableSource(source)) {
    params.set('url', source)
  } else {
    params.delete('url')
  }
  const query = params.toString()
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  window.history.replaceState(null, '', next)
}
