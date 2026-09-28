import { handleStudentNotesRequest } from '../lib/studentNotes.mjs'

// Serves a student's notes, fetched from their Google Doc on every request so
// an edit shows up on the next page load.
export default async (request) => {
  const slug = new URL(request.url).searchParams.get('slug')
  const { statusCode, payload } = await handleStudentNotesRequest({ slug })

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
