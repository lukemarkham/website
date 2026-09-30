// Students with a notes page. The key is the page's address, so 'oliver-otto'
// is lukemarkham.com/oliver-otto. `doc` is the Google Doc's sharing link (or
// just its ID); the Doc must be shared as "anyone with the link can view".
// Until a Doc is set, the page says the notes are on their way. `folder` is
// an optional Google Drive folder of teaching materials, listed at the bottom
// of the page; it needs the same "anyone with the link" sharing.
//
// This file is only read by the server, never sent to the browser, so it
// doesn't reveal who has a page.

export const STUDENTS = {
  'chuck-anello': {
    name: 'Chuck Anello',
    doc: 'https://docs.google.com/document/d/19Q82u8BfgEXt72935dp15XToa4ibK_OnjvZNA5wCBzg/edit?tab=t.0',
    folder: 'https://drive.google.com/drive/folders/1jTfNfwqeYFYATZt3FHmLfNi4emIGfoRd',
  },
  'oliver-otto': {
    name: 'Oliver Otto',
    doc: 'https://docs.google.com/document/d/1Y73iwtkq96EIpXOwqZnZx7U4YhKqOovXz6HbtVIZBoM/edit?tab=t.0',
    folder: 'https://drive.google.com/drive/folders/1iINnajX7LFXrw-qmRtFZrfiy4Ri8AiQr',
  },
}
