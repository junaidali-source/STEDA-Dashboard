// Builds the ?district=&school=&gender=&q= query string every pilot panel
// forwards to its API route, from the page's current URL search params.
export function filterQueryString(sp: URLSearchParams): string {
  const params = new URLSearchParams()
  for (const key of ['district', 'school', 'gender', 'q']) {
    const v = sp.get(key)
    if (v) params.set(key, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
