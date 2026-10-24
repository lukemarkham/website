// The bio page: Luke edits his bio in a Google Doc, and /bio shows it in the
// site's styling, read the same way as a student's notes (studentNotes.mjs).
// The Doc must be shared as "anyone with the link can view".

import { docHtmlToNotes } from './studentNotes.mjs'

const BIO_DOC_ID = '1z6XSWghbqVKXeDqFB3L3kkX2tBuK4qsoDTwsW3QUT08'

// fetchImpl is passed in so dev and tests can swap it.
export async function handleBioRequest(fetchImpl = fetch) {
  let response
  try {
    response = await fetchImpl(`https://docs.google.com/document/d/${BIO_DOC_ID}/export?format=html`, { redirect: 'follow' })
  } catch {
    return { statusCode: 502, payload: { error: "Couldn't reach Google Docs" } }
  }

  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/html') || response.url.includes('accounts.google.com')) {
    return { statusCode: 502, payload: { error: "The bio Doc isn't shared as \"anyone with the link can view\"" } }
  }

  return { statusCode: 200, payload: { html: docHtmlToNotes(await response.text()) } }
}
