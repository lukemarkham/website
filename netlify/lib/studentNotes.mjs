// Student pages: each student's lesson notes live in a Google Doc that Luke
// edits in Google Docs, and their page on the site shows it in the site's own
// styling. The Doc is fetched fresh on every visit, so an edit shows up on the
// next load with nothing to deploy.
//
// A Doc's HTML export is mostly styling: classes carry fonts, sizes and
// colours, and bold or italic text is a <span> whose class says so. Only the
// structure is kept: headings, paragraphs, lists, tables, links and images,
// with bold, italic and underline recovered from the classes. Everything else
// is dropped, and output is built tag by tag from an allowlist rather than
// passed through, so nothing in a Doc can put script or markup on the page.

import { parse, NodeType } from 'node-html-parser'
import { STUDENTS } from './students.mjs'

// Pages are unlisted, not private: a student's page is reached only through
// its link. The roster stays on the server, so the site's code never lists
// who has a page.
export function findStudent(slug) {
  return typeof slug === 'string' && Object.hasOwn(STUDENTS, slug) ? STUDENTS[slug] : null
}

// Accepts a Doc's full sharing link or just its ID.
export function docIdFrom(doc) {
  const match = /\/document\/d\/([\w-]{20,})/.exec(doc) ?? /^([\w-]{20,})$/.exec(doc)
  return match ? match[1] : null
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Class name -> { bold, italic, underline, strike } from the export's <style>.
function readClassStyles(root) {
  const styles = new Map()
  const css = root.querySelectorAll('style').map((node) => node.text).join('\n')
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const flags = {
      bold: /font-weight:\s*(700|800|900|bold)/.test(body),
      italic: /font-style:\s*italic/.test(body),
      underline: /text-decoration:[^;]*underline/.test(body),
      strike: /text-decoration:[^;]*line-through/.test(body),
    }
    if (!Object.values(flags).some(Boolean)) continue
    for (const selector of selectors.split(',')) {
      const match = /^\s*\.([\w-]+)\s*$/.exec(selector)
      if (match) styles.set(match[1], { ...styles.get(match[1]), ...Object.fromEntries(Object.entries(flags).filter(([, on]) => on)) })
    }
  }
  return styles
}

function styleOf(node, classStyles) {
  const flags = {}
  for (const name of (node.getAttribute?.('class') ?? '').split(/\s+/)) {
    Object.assign(flags, classStyles.get(name))
  }
  return flags
}

// Google wraps every link in a redirect through google.com/url?q=...
function realHref(href) {
  try {
    const url = new URL(href)
    if (url.hostname === 'www.google.com' && url.pathname === '/url' && url.searchParams.get('q')) {
      return realHref(url.searchParams.get('q'))
    }
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function isAllowedImage(src) {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && url.hostname.endsWith('.googleusercontent.com')
  } catch {
    return false
  }
}

const BLOCKS = { p: 'p', li: 'li', td: 'td', th: 'th', tr: 'tr' }
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// Inline content: text, emphasis, links, images and line breaks.
function renderInline(node, classStyles) {
  if (node.nodeType === NodeType.TEXT_NODE) return escapeHtml(node.text.replace(/\u00a0/g, ' '))
  if (node.nodeType !== NodeType.ELEMENT_NODE) return ''

  const tag = node.rawTagName?.toLowerCase()
  if (tag === 'br') return '<br>'
  if (tag === 'img') {
    const src = node.getAttribute('src')
    if (!src || !isAllowedImage(src)) return ''
    const alt = node.getAttribute('alt') ?? ''
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`
  }

  let inner = node.childNodes.map((child) => renderInline(child, classStyles)).join('')
  if (!inner) return ''

  if (tag === 'a') {
    const href = realHref(node.getAttribute('href') ?? '')
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner
  }

  const flags = styleOf(node, classStyles)
  if (flags.strike) inner = `<s>${inner}</s>`
  if (flags.underline && tag !== 'a') inner = `<u>${inner}</u>`
  if (flags.italic) inner = `<em>${inner}</em>`
  if (flags.bold) inner = `<strong>${inner}</strong>`
  return inner
}

// Google writes nested lists as flat siblings whose class ends in the nesting
// level (lst-kix_abc-0, lst-kix_abc-1); the level becomes an indent.
function listLevel(node) {
  const match = /lst-kix_[\w]+-(\d+)/.exec(node.getAttribute('class') ?? '')
  return match ? Math.min(Number(match[1]), 6) : 0
}

// The page's own title is the <h1>, so a Doc's largest heading becomes an
// <h2> and the rest follow from there, whichever heading styles it uses.
function renderBlock(node, classStyles, headingShift) {
  if (node.nodeType !== NodeType.ELEMENT_NODE) return ''
  const tag = node.rawTagName?.toLowerCase()
  const classes = node.getAttribute('class') ?? ''

  if (tag === 'hr') return '<hr>'
  if (tag === 'ul' || tag === 'ol') {
    const items = node.childNodes.map((child) => renderBlock(child, classStyles, headingShift)).join('')
    if (!items) return ''
    const level = listLevel(node)
    return `<${tag}${level ? ` class="level-${level}"` : ''}>${items}</${tag}>`
  }
  if (tag === 'table') {
    const rows = node.querySelectorAll('tr').map((row) => renderBlock(row, classStyles, headingShift)).join('')
    return rows ? `<div class="notes-table"><table>${rows}</table></div>` : ''
  }
  if (tag === 'tr') {
    const cells = node.childNodes.map((child) => renderBlock(child, classStyles, headingShift)).join('')
    return `<tr>${cells}</tr>`
  }
  if (tag === 'td' || tag === 'th') {
    // Cells hold paragraphs of their own; keep their breaks, drop the <p>s.
    const paragraphs = node.childNodes
      .map((child) => (child.rawTagName?.toLowerCase() === 'p' ? renderInline(child, classStyles) : renderBlock(child, classStyles, headingShift) || renderInline(child, classStyles)))
      .filter(Boolean)
    return `<${tag}>${paragraphs.join('<br>')}</${tag}>`
  }

  if (HEADINGS.includes(tag)) {
    const inner = node.childNodes.map((child) => renderInline(child, classStyles)).join('').trim()
    if (!inner) return ''
    const level = Math.min(6, Number(tag[1]) + headingShift)
    return `<h${level}>${inner}</h${level}>`
  }

  if (BLOCKS[tag]) {
    const inner = node.childNodes.map((child) => renderInline(child, classStyles)).join('').trim()
    if (!inner) return ''
    if (tag === 'p' && /\btitle\b/.test(classes)) return `<h2>${inner}</h2>`
    if (tag === 'p' && /\bsubtitle\b/.test(classes)) return `<p class="subtitle">${inner}</p>`
    return `<${BLOCKS[tag]}>${inner}</${BLOCKS[tag]}>`
  }

  // Anything else (a wrapping div, say) is looked through.
  return node.childNodes.map((child) => renderBlock(child, classStyles, headingShift)).join('')
}

export function docHtmlToNotes(exportHtml) {
  const root = parse(exportHtml, { comment: false, blockTextElements: { style: true, script: false } })
  const classStyles = readClassStyles(root)
  const body = root.querySelector('body') ?? root
  const levels = HEADINGS.filter((tag) => body.querySelector(tag)).map((tag) => Number(tag[1]))
  const headingShift = levels.length > 0 ? 2 - Math.min(...levels) : 0
  return body.childNodes.map((node) => renderBlock(node, classStyles, headingShift)).join('\n')
}

// fetchImpl is passed in so dev and tests can swap it.
export async function handleStudentNotesRequest({ slug }, fetchImpl = fetch) {
  const student = findStudent(slug)
  if (!student) return { statusCode: 404, payload: { error: 'No such page' } }

  const docId = docIdFrom(student.doc ?? '')
  if (!docId) return { statusCode: 200, payload: { name: student.name, html: null } }

  let response
  try {
    response = await fetchImpl(`https://docs.google.com/document/d/${docId}/export?format=html`, { redirect: 'follow' })
  } catch {
    return { statusCode: 502, payload: { error: "Couldn't reach Google Docs" } }
  }

  // A Doc that isn't shared as "anyone with the link" answers with a sign-in
  // page rather than the export.
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/html') || response.url.includes('accounts.google.com')) {
    return { statusCode: 502, payload: { error: "The notes Doc isn't shared as \"anyone with the link can view\"" } }
  }

  return { statusCode: 200, payload: { name: student.name, html: docHtmlToNotes(await response.text()) } }
}
