// Students with a notes page. The key is the page's address, so 'oliver-otto'
// is lukemarkham.com/oliver-otto. `doc` is the Google Doc's sharing link (or
// just its ID); the Doc must be shared as "anyone with the link can view".
// Until a Doc is set, the page says the notes are on their way.
//
// This file is only read by the server, never sent to the browser, so it
// doesn't reveal who has a page.

export const STUDENTS = {
  'oliver-otto': {
    name: 'Oliver Otto',
    doc: '',
  },
}
