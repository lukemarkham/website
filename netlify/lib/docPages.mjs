// Pages whose text is a Google Doc Luke edits, like /bio, /credits and /book-list: the
// page shows the Doc in the site's styling, read the same way as a student's
// notes (studentNotes.mjs). Each Doc must be shared as "anyone with the link
// can view".

import { docHtmlToNotes } from './studentNotes.mjs'

export const DOC_PAGES = {
  bio: '1z6XSWghbqVKXeDqFB3L3kkX2tBuK4qsoDTwsW3QUT08',
  credits: '1V4R2RtxjdLbeYigNEFRnPV07tkpC6JKzVPhRDTQjb-k',
  'book-list': '1H3cNiBORV5BIpg72iRmt2i5n-2yWpkC6M-XichjRmD0',
}

// fetchImpl is passed in so dev and tests can swap it.
export async function handleDocPageRequest({ page }, fetchImpl = fetch) {
  const docId = typeof page === 'string' && Object.hasOwn(DOC_PAGES, page) ? DOC_PAGES[page] : null
  if (!docId) return { statusCode: 404, payload: { error: 'No such page' } }

  let response
  try {
    response = await fetchImpl(`https://docs.google.com/document/d/${docId}/export?format=html`, { redirect: 'follow' })
  } catch {
    return { statusCode: 502, payload: { error: "Couldn't reach Google Docs" } }
  }

  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/html') || response.url.includes('accounts.google.com')) {
    return { statusCode: 502, payload: { error: `The ${page} Doc isn't shared as "anyone with the link can view"` } }
  }

  return { statusCode: 200, payload: { html: docHtmlToNotes(await response.text()) } }
}
