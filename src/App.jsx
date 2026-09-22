import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { photographyShots } from './data/photography'
import { reviews } from './data/reviews'
import { PROGRESSION_LEVELS, progressions } from './data/progressions'
import { arrangementToMidi, midiFilename } from './lib/midi'
import {
  POINTS_PER_CHORD,
  KEYS,
  chordSymbol,
  gradeAnswer,
  keyForMode,
  midiNoteLabel,
  qualityLabel,
  recogniseChord,
  romanLabel,
  shadeProgression,
} from './lib/harmony'
import { connectMidi, isMidiSupported } from './lib/midiInput'
import { loadVexFlow, renderFillNotation } from './lib/fillNotation'
import {
  BASS_INSTRUMENTS,
  CHORD_INSTRUMENTS,
  PATTERNS,
  buildArrangement,
  createEngine,
  playArrangement,
  playLiveNote,
} from './lib/chordSynth'

const YOUTUBE_PLAYLIST_ID = 'PLb3uq0jpJ8q-KEpFbTwJdOXcoNcaZoneA'
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const SPOTIFY_PLAYLIST_ID = '63XW9ECd3X1hKJIMR0T7fr'
const SOUNDBETTER_MAP_URL = 'https://soundbetter.com/profiles/45761-luke-markham/map'
const REVERB_SHOP_SLUG = import.meta.env.VITE_REVERB_SHOP_SLUG || 'lukes-gear-emporium-220'
const REVERB_SHOP_URL = import.meta.env.VITE_REVERB_SHOP_URL || `https://reverb.com/shop/${REVERB_SHOP_SLUG}`
const REVERB_EMBED_SCRIPT_URL = 'https://d1g5417jjjo7sf.cloudfront.net/assets/embed/reverb.js'
const JQUERY_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js'
const TWITCH_STATUS_ENDPOINT = '/.netlify/functions/twitch-status'
const TWITCH_POLL_INTERVAL_MS = 90_000
const TWITCH_DISMISSED_STREAM_KEY = 'lm-twitch-dismissed-stream'
const METRONOME_TICKS_PER_BEAT = 12
const METRONOME_LOOKAHEAD_MS = 25
const METRONOME_SCHEDULE_AHEAD_SECONDS = 0.12

const METRONOME_SUBDIVISIONS = [
  {
    id: 'beat',
    label: 'Beat',
    description: 'Quarter-note pulse after beat 1',
    defaultProbability: 100,
    ticks: [0],
    frequency: 920,
    volume: 0.26,
  },
  {
    id: 'eighth',
    label: '8th Offbeats',
    description: 'The “and” of each beat',
    defaultProbability: 0,
    ticks: [6],
    frequency: 720,
    volume: 0.18,
  },
  {
    id: 'sixteenth',
    label: '16th Offbeats',
    description: 'The e and a partials',
    defaultProbability: 0,
    ticks: [3, 9],
    frequency: 580,
    volume: 0.14,
  },
  {
    id: 'triplet',
    label: 'Triplet Partials',
    description: 'Middle triplet notes',
    defaultProbability: 0,
    ticks: [4, 8],
    frequency: 660,
    volume: 0.14,
  },
]

const pageShellStyle = {
  width: '100%',
  maxWidth: '1180px',
  margin: '0 auto',
  padding: 'clamp(24px, 4vw, 56px)',
  boxSizing: 'border-box',
  textAlign: 'center',
}

const sectionStyle = {
  marginBottom: '22px',
  padding: 'clamp(24px, 3vw, 38px)',
  border: '1px solid var(--surface-border)',
  borderRadius: '10px',
  background: 'var(--surface)',
  boxShadow: 'var(--surface-shadow)',
  backdropFilter: 'blur(18px)',
}

const titleStyle = {
  fontSize: 'clamp(42px, 8vw, 86px)',
  lineHeight: 0.92,
  letterSpacing: 0,
  margin: '0 0 20px',
}

const introStyle = {
  fontSize: 'clamp(16px, 2.3vw, 20px)',
  lineHeight: 1.75,
  margin: '0 auto 28px',
  maxWidth: '720px',
  color: 'var(--text-soft)',
}

const sectionHeadingStyle = {
  fontSize: 'clamp(26px, 4vw, 40px)',
  letterSpacing: 0,
  margin: '0 0 14px',
}

const mutedTextStyle = {
  color: 'var(--text-muted)',
  lineHeight: 1.75,
  margin: 0,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '20px',
}

const cardStyle = {
  padding: '26px',
  borderRadius: '10px',
  border: '1px solid var(--surface-border)',
  background: 'var(--card-surface)',
  boxShadow: '0 16px 44px rgba(0, 0, 0, 0.26)',
}

const buttonRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const metaStyle = {
  display: 'inline-block',
  marginBottom: '18px',
  padding: '7px 11px',
  borderRadius: '4px',
  border: '1px solid var(--accent-border)',
  background: 'var(--accent-soft)',
  color: 'var(--accent-quiet)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: 0,
}

// localStorage throws in private browsing on some browsers, and a live card is
// never worth taking the page down for.
function readDismissedStreamId() {
  try {
    return window.localStorage.getItem(TWITCH_DISMISSED_STREAM_KEY)
  } catch {
    return null
  }
}

function TwitchLiveCard() {
  const [stream, setStream] = useState(null)
  const [dismissedStreamId, setDismissedStreamId] = useState(readDismissedStreamId)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function checkLiveStatus() {
      try {
        const response = await fetch(TWITCH_STATUS_ENDPOINT, { signal: controller.signal })
        if (!response.ok) {
          setStream(null)
          return
        }

        const data = await response.json()
        setStream(data.live ? data : null)
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        // Offline, blocked, or the endpoint is not deployed yet — stay hidden.
        setStream(null)
      }
    }

    checkLiveStatus()

    // Poll so the card appears mid-visit when the stream starts, and clears
    // itself when it ends.
    const intervalId = setInterval(checkLiveStatus, TWITCH_POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(intervalId)
    }
  }, [])

  const playerSrc = useMemo(() => {
    if (!stream) {
      return ''
    }

    const url = new URL('https://player.twitch.tv/')
    url.searchParams.set('channel', stream.channel)
    // Twitch refuses to embed unless the embedding host is declared.
    url.searchParams.set('parent', window.location.hostname)
    url.searchParams.set('muted', muted ? 'true' : 'false')
    url.searchParams.set('autoplay', 'true')

    return url.toString()
  }, [stream, muted])

  const dismiss = useCallback(() => {
    if (!stream) {
      return
    }

    setDismissedStreamId(stream.streamId)

    try {
      window.localStorage.setItem(TWITCH_DISMISSED_STREAM_KEY, stream.streamId)
    } catch {
      // Dismissal still holds for this page view; it just will not persist.
    }
  }, [stream])

  // Dismissal is remembered per stream id, so the card stays gone for the rest
  // of this broadcast but returns for the next one.
  if (!stream || stream.streamId === dismissedStreamId) {
    return null
  }

  return (
    <aside className="twitch-card" aria-label="Live on Twitch">
      <div className="twitch-card-header">
        <span className="twitch-live-dot" aria-hidden="true" />
        <span className="twitch-live-label">Live now</span>
        <button
          type="button"
          className="twitch-dismiss"
          onClick={dismiss}
          aria-label="Dismiss the live stream notice"
        >
          ×
        </button>
      </div>
      <div
        className="twitch-player"
        style={stream.thumbnail ? { backgroundImage: `url(${stream.thumbnail})` } : undefined}
      >
        <iframe
          // Remounting on mute change is what actually applies the new setting.
          key={muted ? 'muted' : 'unmuted'}
          src={playerSrc}
          title={`${stream.channel} live on Twitch`}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
      {stream.title ? <p className="twitch-title">{stream.title}</p> : null}
      <p className="twitch-meta">
        {stream.game ? `${stream.game} · ` : ''}
        {stream.viewers.toLocaleString()} watching
      </p>
      <div className="twitch-actions">
        <button
          type="button"
          className="secondary-button twitch-action"
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <a
          className="primary-button twitch-action"
          href={`https://www.twitch.tv/${stream.channel}`}
          target="_blank"
          rel="noreferrer"
        >
          Watch on Twitch
        </a>
      </div>
    </aside>
  )
}

function SiteNav({ showHomeLink = false }) {
  return (
    <nav className="site-nav">
      <div className="wordmark">Luke Markham</div>
      <div className="nav-links">
        {showHomeLink ? <Link className="nav-link" to="/">Home</Link> : null}
        <a className="nav-link" href="/#about">About</a>
        <a className="nav-link" href="/#services">Services</a>
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-link nav-trigger"
            aria-haspopup="menu"
          >
            Content
          </button>
          <div className="nav-dropdown-menu" role="menu">
            <Link className="dropdown-link" to="/video">
              Video
            </Link>
            <Link className="dropdown-link" to="/audio">
              Audio
            </Link>
          </div>
        </div>
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-link nav-trigger"
            aria-haspopup="menu"
          >
            Practice Tools
          </button>
          <div className="nav-dropdown-menu" role="menu">
            <Link className="dropdown-link" to="/tempo-guessr">
              Tempo Guessr
            </Link>
            <Link className="dropdown-link" to="/metronome">
              Metronome
            </Link>
            <Link className="dropdown-link" to="/sticking-generator">
              Sticking Generator
            </Link>
            <Link className="dropdown-link" to="/ear-training">
              Ear Trainer
            </Link>
          </div>
        </div>
        <a className="nav-link" href="/#store">Beat Store</a>
        <a className="nav-link" href="/#gear-shop">Gear Shop</a>
        <a className="nav-link" href="/#contact">Contact</a>
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-link nav-trigger"
            aria-haspopup="menu"
          >
            Extras
          </button>
          <div className="nav-dropdown-menu" role="menu">
            <Link className="dropdown-link" to="/photography">
              Photography
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

function PrimaryButton({ children }) {
  return <button className="primary-button">{children}</button>
}

function SecondaryButton({ children }) {
  return <button className="secondary-button">{children}</button>
}

function ReviewGallery() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isReviewVisible, setIsReviewVisible] = useState(true)
  const transitionTimeoutRef = useRef(null)
  const totalReviews = reviews.length
  const currentReview = reviews[currentIndex]

  function getReviewSizeClass(quote) {
    if (quote.length > 240) return 'is-compact'
    if (quote.length > 150) return 'is-medium'
    return 'is-large'
  }

  const showReview = useCallback((nextIndex) => {
    if (nextIndex === currentIndex) {
      return
    }

    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current)
    }

    setIsReviewVisible(false)
    transitionTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex)
      setIsReviewVisible(true)
      transitionTimeoutRef.current = null
    }, 180)
  }, [currentIndex])

  useEffect(() => {
    if (totalReviews <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      showReview((currentIndex + 1) % totalReviews)
    }, 5500)

    return () => {
      window.clearInterval(intervalId)
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [currentIndex, showReview, totalReviews])

  if (totalReviews === 0) {
    return (
      <div className="review-stage surface-card">
        <blockquote className="review-quote is-medium is-visible">
          Reviews will appear here soon.
        </blockquote>
      </div>
    )
  }

  return (
    <div className="review-stage surface-card">
      <div className={`review-stars${isReviewVisible ? ' is-visible' : ''}`} aria-label={`${currentReview.stars} star review`}>
        {'★'.repeat(currentReview.stars)}
      </div>
      <blockquote className={`review-quote ${getReviewSizeClass(currentReview.quote)}${isReviewVisible ? ' is-visible' : ''}`}>
        {currentReview.quote}
      </blockquote>
      <p className={`review-source${isReviewVisible ? ' is-visible' : ''}`}>
        {currentReview.source}
      </p>

      {totalReviews > 1 ? (
        <div className="review-controls">
          <button
            type="button"
            className="review-control"
            onClick={() => showReview((currentIndex - 1 + totalReviews) % totalReviews)}
            aria-label="Previous review"
          >
            Prev
          </button>
          <div className="review-dots" aria-label="Review gallery position">
            {reviews.map((review, index) => (
              <button
                key={review.id}
                type="button"
                className={`review-dot${index === currentIndex ? ' is-active' : ''}`}
                onClick={() => showReview(index)}
                aria-label={`Show review ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="review-control"
            onClick={() => showReview((currentIndex + 1) % totalReviews)}
            aria-label="Next review"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ClientMapSection() {
  return (
    <a
      className="map-card surface-card"
      href={SOUNDBETTER_MAP_URL}
      target="_blank"
      rel="noreferrer"
    >
      <div className="map-card-media">
        <img
          className="map-card-image"
          src="/soundbetter-map/client-map.png"
          alt="SoundBetter client map preview"
        />
      </div>
    </a>
  )
}

function SoundBetterSection() {
  return (
    <section id="soundbetter" className="surface-panel" style={sectionStyle}>
      <div className="reviews-header">
        <div style={metaStyle}>SoundBetter</div>
        <h2 style={sectionHeadingStyle}>Reviews And Client Map</h2>
      </div>

      <div className="soundbetter-grid">
        <div className="soundbetter-column">
          <div className="soundbetter-column-header">
            <span className="soundbetter-kicker">5-Star Reviews</span>
          </div>
          <ReviewGallery />
        </div>

        <div className="soundbetter-column">
          <div className="soundbetter-column-header">
            <span className="soundbetter-kicker">Client Map</span>
          </div>
          <ClientMapSection />
        </div>
      </div>
    </section>
  )
}

function appendScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`)

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve()
        return
      }

      existingScript.addEventListener('load', resolve, { once: true })
      existingScript.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = reject

    document.body.appendChild(script)
  })
}

function ReverbShopSection() {
  useEffect(() => {
    let cancelled = false

    async function loadReverbEmbed() {
      try {
        await appendScript(JQUERY_SCRIPT_URL)
        if (!cancelled) {
          await appendScript(REVERB_EMBED_SCRIPT_URL)
        }
      } catch {
        // The direct shop link remains available if the third-party embed script fails.
      }
    }

    loadReverbEmbed()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="gear-shop" className="surface-panel" style={sectionStyle}>
      <div className="reverb-shop-header">
        <div style={metaStyle}>Reverb</div>
        <h2 style={sectionHeadingStyle}>Gear Shop</h2>
        <p style={{ ...mutedTextStyle, maxWidth: '720px', margin: '0 auto 22px' }}>
          Browse available instruments, drums, recording gear, and other listings through Luke's Reverb shop.
        </p>
      </div>

      <div className="reverb-shop-card surface-card">
        <div
          className="reverb-embed-host"
          data-reverb-embed-listings
          data-reverb-search-shop={REVERB_SHOP_SLUG}
          data-reverb-search-per-page="6"
          data-reverb-currency="USD"
        />
        <a className="text-link reverb-shop-link" href={REVERB_SHOP_URL} target="_blank" rel="noreferrer">
          Open Reverb Shop
        </a>
      </div>
    </section>
  )
}

function HomePage() {
  return (
    <div style={pageShellStyle}>
      <SiteNav />

      <section className="hero-shell surface-panel" style={{ ...sectionStyle, padding: 'clamp(32px, 5vw, 60px)', marginBottom: '28px' }}>
        <div style={metaStyle}>Freelance Musician • Drummer • Producer</div>
        <h1 style={titleStyle}>Drums, production, and musical support for artists who care about the details.</h1>
        <p style={introStyle}>
          Luke Markham helps artists, producers, and students bring songs into focus through tasteful drum parts, practical production support, and clear musical communication.
        </p>

        <div style={buttonRowStyle} className="hero-actions">
          <a href="#services">
            <PrimaryButton>View Services</PrimaryButton>
          </a>
          <Link to="/video">
            <SecondaryButton>Watch Video Work</SecondaryButton>
          </Link>
          <Link to="/beats">
            <SecondaryButton>View Beat Store</SecondaryButton>
          </Link>
        </div>
      </section>

      <section id="about" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>About</h2>
        <p style={{ ...mutedTextStyle, maxWidth: '760px', margin: '0 auto' }}>
          Luke is an NYC-based drummer, producer, and collaborator with 12+ years of professional experience across remote sessions, live performances, original productions, and private instruction. His work centers on serving the song, keeping the process organized, and making each part feel intentional.
        </p>
      </section>

      <section id="services" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Services</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Session Drumming</h3>
            <p style={mutedTextStyle}>Remote and in-person drum tracking with parts shaped around the song, the artist, and the production.</p>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Production & Editing</h3>
            <p style={mutedTextStyle}>Arrangement support, editing, programming, and practical problem-solving for artists and producers.</p>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Private Drum Lessons</h3>
            <p style={mutedTextStyle}>One-on-one instruction for students who want stronger time, better feel, cleaner technique, and a more musical approach to the kit.</p>
            <a className="text-link" href="mailto:luke@lukemarkham.com?subject=Private%20Drum%20Lessons">Ask About Lessons</a>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Live Performance</h3>
            <p style={mutedTextStyle}>Prepared, adaptable drum support for live dates, artist sets, rehearsals, and performance-focused projects.</p>
          </div>
        </div>
      </section>

      <SoundBetterSection />

      <section id="tools" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Practice Tools</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Tempo Guessr</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              A browser-based tool that plays a random tempo and lets you guess the BPM.
            </p>
            <Link className="text-link" to="/tempo-guessr">Go to Tempo Guessr</Link>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Metronome</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              A probability-based metronome for random subdivisions and silent-bar practice.
            </p>
            <Link className="text-link" to="/metronome">Go to Metronome</Link>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Sticking Generator</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Generate linear fill stickings built from rudiments, resolving on the kick or snare.
            </p>
            <Link className="text-link" to="/sticking-generator">Go to Sticking Generator</Link>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Progression Ear Trainer</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Hear a jazz or neo-soul progression, then name the one chord missing from the chart.
            </p>
            <Link className="text-link" to="/ear-training">Go to Ear Trainer</Link>
          </div>
        </div>
      </section>

      <section id="content" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Content</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Video</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Live clips, studio sessions, playthroughs, and performance videos in one dedicated viewing space.
            </p>
            <Link className="text-link" to="/video">Open Video Page</Link>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Audio</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              A listening hub for productions, drum work, beats, and selected recordings.
            </p>
            <Link className="text-link" to="/audio">Open Audio Page</Link>
          </div>
        </div>
      </section>

      <section id="extras" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Extras</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Photography</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              A small gallery for favorite photos, side experiments, and visual notes.
            </p>
            <Link className="text-link" to="/photography">Open Gallery</Link>
          </div>
        </div>
      </section>

      <section id="store" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Beat Store</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Beat Store</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Browse beats and production-ready instrumentals through the embedded BeatStars store.
            </p>
            <Link className="text-link" to="/beats">Go to Beat Store</Link>
          </div>
        </div>
      </section>

      <ReverbShopSection />

      <section id="contact" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Contact</h2>
        <p style={{ ...mutedTextStyle, maxWidth: '680px', margin: '0 auto 20px' }}>
          Reach out about recording sessions, private lessons, live work, production support, or custom music.
        </p>
        <a className="text-link" href="mailto:luke@lukemarkham.com">Email Me</a>
      </section>
    </div>
  )
}

function PhotographyPage() {
  const [selectedShot, setSelectedShot] = useState(null)

  useEffect(() => {
    if (!selectedShot) {
      return
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSelectedShot(null)
      }
    }

    document.body.classList.add('lightbox-open')
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.classList.remove('lightbox-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedShot])

  return (
    <div style={{ ...pageShellStyle, maxWidth: '1280px' }}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(30px, 4vw, 44px)' }}>
        <div style={metaStyle}>Extras</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Photography</h1>
        <p style={introStyle}>
          Some of my favorite personal shots from outside the music world.
        </p>

        {photographyShots.length > 0 ? (
          <div className="photo-grid">
            {photographyShots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                className="photo-card surface-card"
                onClick={() => setSelectedShot(shot)}
                aria-label={`View ${shot.alt} full size`}
              >
                <img className="photo-image" src={shot.src} alt={shot.alt} />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state surface-card">
            <h2 style={{ ...sectionHeadingStyle, marginBottom: '8px' }}>Gallery Coming Soon</h2>
            <p style={mutedTextStyle}>
              Favorite shots will appear here once photo files are added to the site.
            </p>
          </div>
        )}

        {selectedShot ? (
          <div
            className="photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded photo"
            onClick={() => setSelectedShot(null)}
          >
            <button
              type="button"
              className="photo-lightbox-close"
              onClick={() => setSelectedShot(null)}
              aria-label="Close expanded photo"
            >
              Close
            </button>
            <img
              className="photo-lightbox-image"
              src={selectedShot.src}
              alt={selectedShot.alt}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function randomInt(min, max) {
  const low = Math.ceil(min)
  const high = Math.floor(max)
  return Math.floor(Math.random() * (high - low + 1)) + low
}

// Fills are built from cells: short rudiments, and linear versions of them
// with some strokes moved to the kick. Each cell is written right-hand lead;
// the left-lead mirror is added automatically.
const STICKING_CELLS = [
  { pattern: 'RL', name: 'Single strokes', weight: 1 },
  { pattern: 'RR', name: 'Double stroke', weight: 1 },
  { pattern: 'RLRR', name: 'Paradiddle', weight: 2 },
  { pattern: 'RLLR', name: 'Inverted paradiddle', weight: 1 },
  { pattern: 'RRLLR', name: 'Five-stroke roll', weight: 1 },
  { pattern: 'RLRLRR', name: 'Double paradiddle', weight: 1 },
  { pattern: 'RLRRLL', name: 'Paradiddle-diddle', weight: 1 },
  { pattern: 'K', name: 'Kick', weight: 1 },
  { pattern: 'RLK', name: 'Singles into the kick', weight: 3 },
  { pattern: 'RRK', name: 'Double into the kick', weight: 2 },
  { pattern: 'RLRLK', name: 'Singles into the kick', weight: 2 },
  { pattern: 'RLRK', name: 'Paradiddle, last stroke on the kick', weight: 3 },
  { pattern: 'RLKK', name: 'Paradiddle, double on the kick', weight: 3 },
  { pattern: 'RLLK', name: 'Inverted paradiddle, last stroke on the kick', weight: 2 },
  { pattern: 'RKKR', name: 'Inverted paradiddle, double on the kick', weight: 2 },
  { pattern: 'RRLLK', name: 'Five-stroke roll, release on the kick', weight: 2 },
  { pattern: 'RLRLKK', name: 'Double paradiddle, double on the kick', weight: 2 },
  { pattern: 'RLKKLL', name: 'Paradiddle-diddle, first double on the kick', weight: 2 },
].flatMap((cell) => {
  const mirror = cell.pattern.replace(/[RL]/g, (hand) => (hand === 'R' ? 'L' : 'R'))
  const cells = [{ ...cell, strokes: cell.pattern.split('') }]
  if (mirror !== cell.pattern) cells.push({ ...cell, pattern: mirror, strokes: mirror.split('') })
  return cells
})

const STICKING_RATES = [
  { id: 'sixteenth', label: '16ths', notesPerBeat: 4, counts: ['', 'e', '&', 'a'] },
  { id: 'triplet', label: 'Triplets', notesPerBeat: 3, counts: ['', '&', 'a'] },
]

// The resolution is the downbeat the fill lands on. A snare landing is taken
// with the right hand, so the fill is checked against that stroke too.
const STICKING_RESOLUTIONS = [
  { id: 'kick', label: 'Kick', stroke: 'K' },
  { id: 'snare', label: 'Snare', stroke: 'R' },
]

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

// No limb three times in a row, and never two kicks going into the landing.
// Fills get played two ways, so the three-in-a-row rule holds for both: once
// through into the landing stroke, and looped, where the end runs straight
// back into the start.
function isPlayableSticking(strokes, resolutionStroke) {
  const withResolution = [...strokes, resolutionStroke]
  for (let index = 2; index < withResolution.length; index += 1) {
    const stroke = withResolution[index]
    if (stroke === withResolution[index - 1] && stroke === withResolution[index - 2]) return false
  }

  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index]
    const next = strokes[(index + 1) % strokes.length]
    const afterNext = strokes[(index + 2) % strokes.length]
    if (stroke === next && stroke === afterNext) return false
  }

  return !(strokes.at(-1) === 'K' && strokes.at(-2) === 'K')
}

// Recent fills are kept in this browser so a new one avoids repeating them,
// within a session and across visits.
const STICKING_HISTORY_KEY = 'lm-sticking-history'
const STICKING_HISTORY_LIMIT = 300

function getStickingId(rateId, strokes, resolutionStroke) {
  return `${rateId}:${strokes.join('')}>${resolutionStroke}`
}

function readStickingHistory() {
  try {
    const history = JSON.parse(window.localStorage.getItem(STICKING_HISTORY_KEY))
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

function rememberSticking(id) {
  try {
    const history = [id, ...readStickingHistory().filter((item) => item !== id)]
    window.localStorage.setItem(STICKING_HISTORY_KEY, JSON.stringify(history.slice(0, STICKING_HISTORY_LIMIT)))
  } catch {
    // Without storage the generator still works; it just can't remember.
  }
}

// Downvoted fills are identified by sticking and landing alone: a sticking
// that sits badly under the hands is awkward at either rate.
function getDownvoteKey(strokes, resolutionStroke) {
  return `${strokes.join('')}>${resolutionStroke}`
}

function getRandomFill(length, resolutionStroke, rateId, downvoted = new Set()) {
  const history = readStickingHistory()
  let fallback = null
  let fallbackAge = -1
  let lastResort = null

  // Random cells rarely break the rules, so drawing again until they fit is
  // quick; single strokes and a lone kick can always close out the bar. A
  // fill that hasn't come up recently wins outright. Short lengths can run
  // out of fresh ones, so otherwise the one seen longest ago is used, and a
  // downvoted fill only if nothing else will do.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const cells = []
    let remaining = length
    while (remaining > 0) {
      const cell = pickWeighted(STICKING_CELLS.filter((item) => item.strokes.length <= remaining))
      cells.push(cell)
      remaining -= cell.strokes.length
    }

    const strokes = cells.flatMap((cell) => cell.strokes)
    if (!isPlayableSticking(strokes, resolutionStroke)) continue
    if (downvoted.has(getDownvoteKey(strokes, resolutionStroke))) {
      lastResort = cells
      continue
    }

    const age = history.indexOf(getStickingId(rateId, strokes, resolutionStroke))
    if (age === -1) return cells
    if (age > fallbackAge) {
      fallback = cells
      fallbackAge = age
    }
  }

  return fallback ?? lastResort
}

function getDefaultMetronomeProbabilities() {
  return METRONOME_SUBDIVISIONS.reduce((probabilities, subdivision) => {
    probabilities[subdivision.id] = subdivision.defaultProbability
    return probabilities
  }, {})
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clampWholeNumber(value, min, max) {
  return clamp(Math.round(Number(value)), min, max)
}

function scoreFromDifference(diff) {
  return Math.max(0, 100 - diff * 5)
}

function buildYouTubePlaylistEmbedUrl(playlistId) {
  return `https://www.youtube.com/embed?listType=playlist&list=${playlistId}&rel=0`
}

function getBestThumbnail(thumbnails) {
  if (!thumbnails) return ''
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ''
  )
}

function TempoGuessrPage() {
  const [minBpm, setMinBpm] = useState(60)
  const [maxBpm, setMaxBpm] = useState(140)
  const [bars, setBars] = useState(2)
  const [targetBpm, setTargetBpm] = useState(null)
  const [guess, setGuess] = useState('')
  const [roundActive, setRoundActive] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const audioContextRef = useRef(null)
  const timeoutRef = useRef(null)

  const averageError = useMemo(() => {
    if (history.length === 0) return null
    const total = history.reduce((sum, item) => sum + item.diff, 0)
    return (total / history.length).toFixed(1)
  }, [history])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  async function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  async function playClick(time, accented = false) {
    const ctx = await getAudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'square'
    oscillator.frequency.value = accented ? 1400 : 900

    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(accented ? 0.35 : 0.22, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.start(time)
    oscillator.stop(time + 0.06)
  }

  async function startRound() {
    if (isPlaying) return

    const safeMin = clamp(Math.min(Number(minBpm), Number(maxBpm)), 30, 250)
    const safeMax = clamp(Math.max(Number(minBpm), Number(maxBpm)), 30, 250)
    const nextBpm = randomInt(safeMin, safeMax)
    const totalBeats = Number(bars) * 4
    const secondsPerBeat = 60 / nextBpm

    setTargetBpm(nextBpm)
    setGuess('')
    setResult(null)
    setRoundActive(true)
    setIsPlaying(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const ctx = await getAudioContext()
    const startTime = ctx.currentTime + 0.08

    for (let beat = 0; beat < totalBeats; beat += 1) {
      const time = startTime + beat * secondsPerBeat
      const accented = beat % 4 === 0
      playClick(time, accented)
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsPlaying(false)
    }, (totalBeats * secondsPerBeat + 0.1) * 1000)
  }

  function submitGuess() {
    if (!roundActive || targetBpm == null) return

    const guessedValue = Math.round(Number(guess))
    if (!Number.isFinite(guessedValue) || guessedValue <= 0) return

    const diff = Math.abs(guessedValue - targetBpm)
    const nextResult = {
      target: targetBpm,
      guess: guessedValue,
      diff,
      score: scoreFromDifference(diff),
      id: Date.now(),
    }

    setResult(nextResult)
    setHistory((previous) => [nextResult, ...previous].slice(0, 10))
    setRoundActive(false)
  }

  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Tempo Guessr</h1>
        <p style={introStyle}>Hear a random metronome tempo, then guess the BPM.</p>

        <PracticeTimer />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '18px', marginBottom: '24px' }}>
          <div className="control-card">
            <label className="control-label">Minimum BPM</label>
            <div className="range-value">{minBpm}</div>
            <input
              className="range-input"
              type="range"
              min="30"
              max="250"
              step="1"
              value={minBpm}
              onChange={(e) => setMinBpm(e.target.value)}
            />
          </div>

          <div className="control-card">
            <label className="control-label">Maximum BPM</label>
            <div className="range-value">{maxBpm}</div>
            <input
              className="range-input"
              type="range"
              min="30"
              max="250"
              step="1"
              value={maxBpm}
              onChange={(e) => setMaxBpm(e.target.value)}
            />
          </div>

          <div className="control-card">
            <label className="control-label">Bars of Clicks</label>
            <div className="range-value">{bars}</div>
            <input
              className="range-input"
              type="range"
              min="1"
              max="8"
              step="1"
              value={bars}
              onChange={(e) => setBars(e.target.value)}
            />
          </div>
        </div>

        <div style={{ ...buttonRowStyle, marginBottom: '24px' }}>
          <button className="primary-button" onClick={startRound} disabled={isPlaying}>
            {isPlaying ? 'Playing...' : 'Start Round'}
          </button>
        </div>

        <div className="surface-card" style={{ ...cardStyle, marginBottom: '18px' }}>
          <label className="control-label">Your BPM Guess</label>
          <div style={{ ...buttonRowStyle, marginTop: '14px' }}>
            <input
              className="control-input guess-input"
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submitGuess()
                }
              }}
            />
            <button className="secondary-button" onClick={submitGuess} disabled={!roundActive || isPlaying || guess === ''}>
              Submit Guess
            </button>
          </div>
        </div>

        <div className="surface-card" style={{ ...cardStyle, marginBottom: '18px' }}>
          {!result ? (
            <p style={mutedTextStyle}>
              {roundActive
                ? isPlaying
                  ? 'Listen to the clicks, then enter your guess when playback ends.'
                  : 'Playback finished. Enter your BPM guess.'
                : 'Press Start Round to begin.'}
            </p>
          ) : (
            <div className="stats-grid">
              <div>
                <div className="stat-label">Target Tempo</div>
                <div className="stat-value">{result.target} BPM</div>
              </div>
              <div>
                <div className="stat-label">Your Guess</div>
                <div className="stat-value">{result.guess} BPM</div>
              </div>
              <div>
                <div className="stat-label">Error</div>
                <div className="stat-value">{result.diff} BPM</div>
              </div>
              <div>
                <div className="stat-label">Score</div>
                <div className="stat-value">{result.score}/100</div>
              </div>
            </div>
          )}
        </div>

        <div className="surface-card" style={cardStyle}>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: '8px' }}>Session Stats</h2>
          <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
            Rounds played: {history.length} • Average error: {averageError === null ? '—' : `${averageError} BPM`}
          </p>

          <div style={{ display: 'grid', gap: '12px' }}>
            {history.length === 0 ? (
              <p style={mutedTextStyle}>No rounds yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="history-row">
                  <span>Guess {item.guess}</span>
                  <span>Target {item.target}</span>
                  <span>Off by {item.diff}</span>
                  <span>Score {item.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function playMetronomeClick(ctx, time, frequency, volume, duration = 0.045) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'square'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(time)
  oscillator.stop(time + duration + 0.01)
}

function playSessionCompleteSound(ctx) {
  const now = ctx.currentTime + 0.04
  const notes = [523.25, 659.25, 783.99, 1046.5]

  notes.forEach((frequency, index) => {
    const time = now + index * 0.12
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, time)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.18, time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(time)
    oscillator.stop(time + 0.38)
  })
}

function formatSessionTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Every practice tool carries a session timer. This is the standalone one, for
// tools with no transport of their own; the metronome and the sticking
// generator run theirs off their Start button instead. It keeps time against
// the wall clock, so a throttled background tab still ends on time.
function PracticeTimer({ onComplete, defaultMinutes = 10 }) {
  const [minutesDraft, setMinutesDraft] = useState(String(defaultMinutes))
  const [status, setStatus] = useState('idle')
  const [remaining, setRemaining] = useState(null)
  const endsAtRef = useRef(null)
  const pausedMsRef = useRef(null)
  const tickRef = useRef(null)
  const audioContextRef = useRef(null)
  const wakeLockRef = useRef(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    return () => {
      window.clearInterval(tickRef.current)
      wakeLockRef.current?.release().catch(() => {})
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  async function holdWakeLock() {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request('screen')
    } catch {
      wakeLockRef.current = null
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  function halt() {
    window.clearInterval(tickRef.current)
    releaseWakeLock()
  }

  function finish() {
    halt()
    setStatus('done')
    setRemaining(0)
    if (audioContextRef.current) playSessionCompleteSound(audioContextRef.current)
    onCompleteRef.current?.()
  }

  function run(durationMs) {
    endsAtRef.current = Date.now() + durationMs
    setStatus('running')
    setRemaining(Math.ceil(durationMs / 1000))
    window.clearInterval(tickRef.current)
    tickRef.current = window.setInterval(() => {
      const leftMs = endsAtRef.current - Date.now()
      if (leftMs <= 0) {
        finish()
      } else {
        setRemaining(Math.ceil(leftMs / 1000))
      }
    }, 250)
    holdWakeLock()
  }

  function start() {
    // The chime at the end needs an audio context that was opened by a click.
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }
    audioContextRef.current.resume()

    const minutes = clampWholeNumber(Number(minutesDraft) || defaultMinutes, 1, 240)
    setMinutesDraft(String(minutes))
    run(minutes * 60 * 1000)
  }

  function pause() {
    pausedMsRef.current = endsAtRef.current - Date.now()
    halt()
    setStatus('paused')
  }

  function reset() {
    halt()
    setStatus('idle')
    setRemaining(null)
  }

  return (
    <div className={`surface-card practice-timer is-${status}`}>
      <span className="control-label">Session Timer</span>
      {status === 'idle' ? (
        <div className="practice-timer-row">
          <input
            className="control-input practice-timer-input"
            type="number"
            min="1"
            max="240"
            step="1"
            value={minutesDraft}
            aria-label="Session length in minutes"
            onChange={(event) => setMinutesDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') start()
            }}
          />
          <span className="metronome-bpm">Min</span>
          <button className="secondary-button" type="button" onClick={start}>Start</button>
        </div>
      ) : (
        <>
          <div className="practice-timer-clock" aria-live="polite">
            {status === 'done' ? 'Session complete' : formatSessionTime(remaining)}
          </div>
          <div className="practice-timer-row">
            {status === 'running' ? (
              <button className="secondary-button" type="button" onClick={pause}>Pause</button>
            ) : null}
            {status === 'paused' ? (
              <button className="secondary-button" type="button" onClick={() => run(pausedMsRef.current)}>
                Resume
              </button>
            ) : null}
            <button className="secondary-button" type="button" onClick={reset}>
              {status === 'done' ? 'New Session' : 'Reset'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function MetronomePage() {
  const [tempo, setTempo] = useState(120)
  const [tempoDraft, setTempoDraft] = useState('120')
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4)
  const [downbeatProbability, setDownbeatProbability] = useState(100)
  const [silentBarProbability, setSilentBarProbability] = useState(0)
  const [probabilities, setProbabilities] = useState(() => getDefaultMetronomeProbabilities())
  const [isPatternLocked, setIsPatternLocked] = useState(false)
  const [sessionMinutes, setSessionMinutes] = useState(0)
  const [remainingSessionSeconds, setRemainingSessionSeconds] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeTick, setActiveTick] = useState(null)
  const audioContextRef = useRef(null)
  const schedulerRef = useRef(null)
  const sessionTimeoutRef = useRef(null)
  const sessionCountdownRef = useRef(null)
  const nextTickTimeRef = useRef(0)
  const absoluteTickRef = useRef(0)
  const patternCacheRef = useRef({})
  const silentBarCacheRef = useRef({})
  const visualTimeoutsRef = useRef([])
  const settingsRef = useRef({
    tempo,
    beatsPerMeasure,
    downbeatProbability,
    silentBarProbability,
    probabilities,
    isPatternLocked,
  })

  const beatMarkers = useMemo(() => {
    return Array.from({ length: beatsPerMeasure }, (_, index) => index + 1)
  }, [beatsPerMeasure])

  useEffect(() => {
    settingsRef.current = {
      tempo: Number(tempo),
      beatsPerMeasure: Number(beatsPerMeasure),
      downbeatProbability: Number(downbeatProbability),
      silentBarProbability: Number(silentBarProbability),
      probabilities,
      isPatternLocked,
    }
  }, [beatsPerMeasure, downbeatProbability, isPatternLocked, probabilities, silentBarProbability, tempo])

  useEffect(() => {
    patternCacheRef.current = {}
    silentBarCacheRef.current = {}
  }, [beatsPerMeasure, downbeatProbability, isPatternLocked, probabilities, silentBarProbability])

  useEffect(() => {
    return () => {
      if (schedulerRef.current) {
        window.clearInterval(schedulerRef.current)
      }
      if (sessionTimeoutRef.current) {
        window.clearTimeout(sessionTimeoutRef.current)
      }
      if (sessionCountdownRef.current) {
        window.clearInterval(sessionCountdownRef.current)
      }
      visualTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  async function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  function probabilityHit(key, probability) {
    const safeProbability = clamp(Number(probability), 0, 100)
    if (safeProbability >= 100) return true
    if (safeProbability <= 0) return false

    if (settingsRef.current.isPatternLocked) {
      if (patternCacheRef.current[key] === undefined) {
        patternCacheRef.current[key] = Math.random() * 100 < safeProbability
      }

      return patternCacheRef.current[key]
    }

    return Math.random() * 100 < safeProbability
  }

  function isBarSilent(barIndex) {
    const safeProbability = clamp(settingsRef.current.silentBarProbability, 0, 100)
    if (safeProbability >= 100) return true
    if (safeProbability <= 0) return false

    if (silentBarCacheRef.current[barIndex] === undefined) {
      silentBarCacheRef.current[barIndex] = Math.random() * 100 < safeProbability
    }

    return silentBarCacheRef.current[barIndex]
  }

  function flashTick(ctx, time, tickInBar) {
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    const showTimeout = window.setTimeout(() => setActiveTick(tickInBar), delay)
    const hideTimeout = window.setTimeout(() => setActiveTick(null), delay + 90)
    visualTimeoutsRef.current.push(showTimeout, hideTimeout)
  }

  function scheduleTick(ctx, absoluteTick, time) {
    const {
      beatsPerMeasure: currentBeatsPerMeasure,
      downbeatProbability: currentDownbeatProbability,
      probabilities: currentProbabilities,
    } = settingsRef.current
    const currentTicksPerMeasure = currentBeatsPerMeasure * METRONOME_TICKS_PER_BEAT
    const tickInBar = absoluteTick % currentTicksPerMeasure
    const tickInBeat = tickInBar % METRONOME_TICKS_PER_BEAT
    const barIndex = Math.floor(absoluteTick / currentTicksPerMeasure)
    const barPositionKey = tickInBar
    let played = false

    if (isBarSilent(barIndex)) {
      return
    }

    if (tickInBar === 0 && probabilityHit(`downbeat-${barPositionKey}`, currentDownbeatProbability)) {
      playMetronomeClick(ctx, time, 1320, 0.36, 0.055)
      played = true
    }

    METRONOME_SUBDIVISIONS.forEach((subdivision) => {
      const isBeatOne = subdivision.id === 'beat' && tickInBar === 0
      if (isBeatOne || !subdivision.ticks.includes(tickInBeat)) {
        return
      }

      const hitKey = `${subdivision.id}-${barPositionKey}`
      if (probabilityHit(hitKey, currentProbabilities[subdivision.id])) {
        playMetronomeClick(ctx, time, subdivision.frequency, subdivision.volume)
        played = true
      }
    })

    if (played) {
      flashTick(ctx, time, tickInBar)
    }
  }

  function scheduler(ctx) {
    while (nextTickTimeRef.current < ctx.currentTime + METRONOME_SCHEDULE_AHEAD_SECONDS) {
      scheduleTick(ctx, absoluteTickRef.current, nextTickTimeRef.current)
      const secondsPerBeat = 60 / settingsRef.current.tempo
      nextTickTimeRef.current += secondsPerBeat / METRONOME_TICKS_PER_BEAT
      absoluteTickRef.current += 1
    }
  }

  async function startMetronome() {
    if (isPlaying) return

    const ctx = await getAudioContext()
    const sessionDurationMs = clampWholeNumber(sessionMinutes, 0, 240) * 60 * 1000
    patternCacheRef.current = {}
    silentBarCacheRef.current = {}
    absoluteTickRef.current = 0
    nextTickTimeRef.current = ctx.currentTime + 0.08
    setIsPlaying(true)

    schedulerRef.current = window.setInterval(() => scheduler(ctx), METRONOME_LOOKAHEAD_MS)

    if (sessionDurationMs > 0) {
      const sessionDurationSeconds = Math.ceil(sessionDurationMs / 1000)
      setRemainingSessionSeconds(sessionDurationSeconds)

      sessionCountdownRef.current = window.setInterval(() => {
        setRemainingSessionSeconds((currentSeconds) => {
          if (currentSeconds === null) return null
          return Math.max(0, currentSeconds - 1)
        })
      }, 1000)

      sessionTimeoutRef.current = window.setTimeout(() => {
        stopMetronome({ playCompletion: true })
      }, sessionDurationMs)
    } else {
      setRemainingSessionSeconds(null)
    }
  }

  function stopMetronome(options = {}) {
    if (schedulerRef.current) {
      window.clearInterval(schedulerRef.current)
      schedulerRef.current = null
    }

    if (sessionTimeoutRef.current) {
      window.clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }

    if (sessionCountdownRef.current) {
      window.clearInterval(sessionCountdownRef.current)
      sessionCountdownRef.current = null
    }

    visualTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    visualTimeoutsRef.current = []
    setActiveTick(null)
    setRemainingSessionSeconds(null)
    setIsPlaying(false)

    if (options.playCompletion && audioContextRef.current) {
      playSessionCompleteSound(audioContextRef.current)
    }
  }

  function toggleMetronome() {
    if (isPlaying) {
      stopMetronome()
    } else {
      startMetronome()
    }
  }

  // Keep whatever is typed in the tempo field as-is. Clamping mid-keystroke would
  // rewrite "9" to "30" on the way to typing "93", making two-digit tempos
  // impossible to enter.
  function updateTempo(event) {
    const { value } = event.target
    setTempoDraft(value)

    const parsed = Number(value)
    if (value.trim() !== '' && Number.isFinite(parsed) && parsed >= 30 && parsed <= 300) {
      setTempo(parsed)
    }
  }

  // Once the field loses focus the entry is finished, so snap it into range.
  function commitTempo() {
    const parsed = Number(tempoDraft)
    const nextTempo = tempoDraft.trim() === '' || !Number.isFinite(parsed)
      ? tempo
      : clamp(parsed, 30, 300)

    setTempo(nextTempo)
    setTempoDraft(String(nextTempo))
  }

  function updateProbability(subdivisionId, value) {
    setProbabilities((currentProbabilities) => ({
      ...currentProbabilities,
      [subdivisionId]: clamp(Number(value), 0, 100),
    }))
  }

  function randomizeProbabilities() {
    setDownbeatProbability(randomInt(0, 100))
    setSilentBarProbability(randomInt(0, 100))
    setProbabilities(
      METRONOME_SUBDIVISIONS.reduce((nextProbabilities, subdivision) => {
        nextProbabilities[subdivision.id] = randomInt(0, 100)
        return nextProbabilities
      }, {}),
    )
  }

  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <div style={metaStyle}>Practice Tools</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Metronome</h1>
        <p style={introStyle}>
          A probability-based metronome for random subdivision patterns and silent-bar practice.
        </p>

        <div className="metronome-transport surface-card">
          <div className="metronome-tempo">
            <label className="control-label" htmlFor="metronome-tempo">Tempo</label>
            <input
              id="metronome-tempo"
              className="control-input metronome-tempo-input"
              type="number"
              min="30"
              max="300"
              value={tempoDraft}
              onChange={updateTempo}
              onBlur={commitTempo}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <span className="metronome-bpm">BPM</span>
          </div>

          <div className="metronome-session">
            <label className="control-label" htmlFor="metronome-session-minutes">Timed Session</label>
            <input
              id="metronome-session-minutes"
              className="control-input metronome-session-input"
              type="number"
              min="0"
              max="240"
              step="1"
              value={sessionMinutes}
              onChange={(event) => setSessionMinutes(clampWholeNumber(event.target.value, 0, 240))}
              disabled={isPlaying}
            />
            <span className="metronome-bpm">
              {remainingSessionSeconds === null ? 'Min' : formatSessionTime(remainingSessionSeconds)}
            </span>
          </div>

          <button className="primary-button" type="button" onClick={toggleMetronome}>
            {isPlaying ? 'Stop' : 'Start'}
          </button>
        </div>

        <div className="metronome-beat-strip" aria-label="Current measure">
          {beatMarkers.map((beat) => {
            const isActive = activeTick != null && Math.floor(activeTick / METRONOME_TICKS_PER_BEAT) === beat - 1
            return (
              <div className={`metronome-beat${isActive ? ' is-active' : ''}`} key={beat}>
                {beat}
                <span>{beat === 1 ? 'Downbeat' : 'Beat'}</span>
              </div>
            )
          })}
        </div>

        <div className="metronome-control-grid">
          <div className="control-card">
            <label className="control-label" htmlFor="metronome-beats">Beats Per Measure</label>
            <div className="range-value">{beatsPerMeasure}</div>
            <input
              id="metronome-beats"
              className="range-input"
              type="range"
              min="2"
              max="12"
              step="1"
              value={beatsPerMeasure}
              onChange={(event) => setBeatsPerMeasure(Number(event.target.value))}
            />
          </div>

          <div className="control-card">
            <label className="control-label" htmlFor="metronome-downbeat">Downbeat Probability</label>
            <div className="probability-value">
              <input
                className="control-input probability-input"
                type="number"
                min="0"
                max="100"
                step="1"
                value={downbeatProbability}
                onChange={(event) => setDownbeatProbability(clamp(Number(event.target.value), 0, 100))}
                aria-label="Downbeat probability percent"
              />
              <span>%</span>
            </div>
            <input
              id="metronome-downbeat"
              className="range-input"
              type="range"
              min="0"
              max="100"
              step="5"
              value={downbeatProbability}
              onChange={(event) => setDownbeatProbability(clamp(Number(event.target.value), 0, 100))}
            />
          </div>

          <div className="control-card">
            <label className="control-label" htmlFor="metronome-silent-bars">Silent Bar Probability</label>
            <div className="probability-value">
              <input
                className="control-input probability-input"
                type="number"
                min="0"
                max="100"
                step="1"
                value={silentBarProbability}
                onChange={(event) => setSilentBarProbability(clamp(Number(event.target.value), 0, 100))}
                aria-label="Silent bar probability percent"
              />
              <span>%</span>
            </div>
            <input
              id="metronome-silent-bars"
              className="range-input"
              type="range"
              min="0"
              max="100"
              step="5"
              value={silentBarProbability}
              onChange={(event) => setSilentBarProbability(clamp(Number(event.target.value), 0, 100))}
            />
          </div>
        </div>

        <div className="metronome-repeat-row surface-card">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={isPatternLocked}
              onChange={(event) => setIsPatternLocked(event.target.checked)}
            />
            <span>Lock Pattern</span>
          </label>
          <button className="secondary-button" type="button" onClick={randomizeProbabilities}>
            Randomize
          </button>
        </div>

        <div className="metronome-subdivision-grid">
          {METRONOME_SUBDIVISIONS.map((subdivision) => (
            <div className="control-card metronome-subdivision-card" key={subdivision.id}>
              <div>
                <label className="control-label" htmlFor={`metronome-${subdivision.id}`}>
                  {subdivision.label}
                </label>
                <p className="metronome-subdivision-note">{subdivision.description}</p>
              </div>
              <div className="probability-value">
                <input
                  className="control-input probability-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={probabilities[subdivision.id]}
                  onChange={(event) => updateProbability(subdivision.id, event.target.value)}
                  aria-label={`${subdivision.label} probability percent`}
                />
                <span>%</span>
              </div>
              <input
                id={`metronome-${subdivision.id}`}
                className="range-input"
                type="range"
                min="0"
                max="100"
                step="5"
                value={probabilities[subdivision.id]}
                onChange={(event) => updateProbability(subdivision.id, event.target.value)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const STICKING_ROTATION_OPTIONS = [
  { seconds: 0, label: 'Never' },
  { seconds: 30, label: 'Every 30 sec' },
  { seconds: 60, label: 'Every 1 min' },
  { seconds: 120, label: 'Every 2 min' },
  { seconds: 180, label: 'Every 3 min' },
  { seconds: 300, label: 'Every 5 min' },
]

const STICKING_TEMPO_LIMITS = { min: 40, max: 240 }
const STICKING_DEFAULT_TEMPO_RANGE = [90, 150]
const STICKING_COUNT_IN_BEATS = 4
const STICKING_CHIME_SECONDS = 0.7
const STICKING_REVEAL_MS = 1500
// Rendered by scripts/generate-count-in.sh.
const STICKING_COUNT_IN_URLS = [1, 2, 3, 4].map((beat) => `/audio/count-in/${beat}.wav`)

const STICKING_FEEDBACK_URL = '/.netlify/functions/sticking-feedback'
const STICKING_OUTBOX_KEY = 'lm-sticking-feedback-outbox'
const STICKING_DOWNVOTES_KEY = 'lm-sticking-downvotes'
const STICKING_FEEDBACK_TAGS = [
  'Awkward hand motion',
  'Awkward kick placement',
  'Weak lead-in to the landing',
  "Doesn't loop smoothly",
  'Too many kicks',
  'Too few kicks',
  'Breaks a rule',
  'Not musical',
]

function readStoredList(key) {
  try {
    const list = JSON.parse(window.localStorage.getItem(key))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeStoredList(key, list) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Storage can be unavailable; the feedback still goes out if the network is up.
  }
}

// Votes queue here first and are sent from the queue, so a vote cast with no
// connection (or with the dev server down) goes out on the next try.
let isFlushingOutbox = false

async function flushStickingOutbox() {
  if (isFlushingOutbox) return
  isFlushingOutbox = true

  try {
    for (const entry of readStoredList(STICKING_OUTBOX_KEY)) {
      let response
      try {
        response = await fetch(STICKING_FEEDBACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
      } catch {
        return
      }

      // A 4xx will never succeed, so drop it rather than retrying forever.
      if (!response.ok && response.status >= 500) return
      writeStoredList(STICKING_OUTBOX_KEY, readStoredList(STICKING_OUTBOX_KEY).filter((item) => item.queuedAt !== entry.queuedAt))
    }
  } finally {
    isFlushingOutbox = false
  }
}

function sendStickingFeedback(entry) {
  writeStoredList(STICKING_OUTBOX_KEY, [...readStoredList(STICKING_OUTBOX_KEY), { ...entry, queuedAt: Date.now() }])
  flushStickingOutbox()
}

function playFillChangeChime(ctx, time) {
  ;[[1318.51, 0], [987.77, 0.16]].forEach(([frequency, offset]) => {
    const start = time + offset
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.95)
  })
}

// Used only if the spoken count-in can't be loaded: a woody two-tone knock,
// still nothing like the click.
function playCountInKnock(ctx, time) {
  ;[[780, 0.3], [1170, 0.14]].forEach(([frequency, volume]) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, time)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, time + 0.08)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(time)
    oscillator.stop(time + 0.1)
  })
}

// A pared-back metronome for the sticking page: a 4/4 click with beat one
// accented and a session countdown, at the tempo the current fill picked.
// When the new-fill interval runs out, the click stops on the next downbeat
// for a chime, the new fill is revealed, and a spoken one-bar count-in brings
// the click back. The page can also pause it (while a downvote is explained)
// and resume it, with or without a new fill.
function StickingPracticeSession({ tempo, onNewFill, manualFillCount, controlRef }) {
  const [sessionMinutes, setSessionMinutes] = useState(10)
  const [rotationSeconds, setRotationSeconds] = useState(60)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeBeat, setActiveBeat] = useState(null)
  const [banner, setBanner] = useState(null)
  const [clock, setClock] = useState({ session: null, nextFill: null })
  const audioContextRef = useRef(null)
  const schedulerRef = useRef(null)
  const clockRef = useRef(null)
  const visualTimeoutsRef = useRef([])
  const wakeLockRef = useRef(null)
  const runRef = useRef(null)
  const tempoRef = useRef(tempo)
  const onNewFillRef = useRef(onNewFill)
  const voiceFilesRef = useRef(null)
  const voiceBuffersRef = useRef(null)

  useEffect(() => {
    tempoRef.current = tempo
  }, [tempo])

  useEffect(() => {
    onNewFillRef.current = onNewFill
  }, [onNewFill])

  // Fetch the count-in early; decoding waits for an audio context.
  useEffect(() => {
    voiceFilesRef.current = Promise.all(
      STICKING_COUNT_IN_URLS.map((url) => fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`)
        return response.arrayBuffer()
      })),
    ).catch(() => null)
  }, [])

  // Picking a fill by hand restarts the wait for the next automatic one, so
  // it gets the full interval too.
  useEffect(() => {
    const run = runRef.current
    if (run && !run.paused && run.rotationSeconds > 0 && run.nextFillAt !== null) {
      run.nextFillAt = audioContextRef.current.currentTime + run.rotationSeconds
    }
  }, [manualFillCount])

  useEffect(() => {
    const visualTimeouts = visualTimeoutsRef.current
    return () => {
      window.clearInterval(schedulerRef.current)
      window.clearInterval(clockRef.current)
      visualTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
      wakeLockRef.current?.release().catch(() => {})
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  async function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  async function loadVoice(ctx) {
    if (voiceBuffersRef.current) return
    const files = await voiceFilesRef.current
    if (!files) return

    try {
      // decodeAudioData detaches the buffer it is given, so decode copies.
      voiceBuffersRef.current = await Promise.all(files.map((file) => ctx.decodeAudioData(file.slice(0))))
    } catch {
      voiceBuffersRef.current = null
    }
  }

  function playCountIn(ctx, time, beatInBar) {
    const buffer = voiceBuffersRef.current?.[beatInBar]
    if (!buffer) {
      playCountInKnock(ctx, time)
      return
    }

    // Each word is cut off at the next beat, so fast tempos don't pile them up.
    const beatSeconds = 60 / tempoRef.current
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    const endsAt = time + Math.min(buffer.duration, beatSeconds * 0.95)

    source.buffer = buffer
    gain.gain.setValueAtTime(0.9, time)
    gain.gain.setValueAtTime(0.9, endsAt - 0.02)
    gain.gain.linearRampToValueAtTime(0.0001, endsAt)
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(time)
    source.stop(endsAt + 0.01)
  }

  function atAudioTime(ctx, time, callback) {
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    visualTimeoutsRef.current.push(window.setTimeout(callback, delay))
  }

  function clearVisualTimeouts() {
    visualTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    visualTimeoutsRef.current = []
  }

  function scheduler(ctx) {
    const run = runRef.current

    while (run.nextBeatTime < ctx.currentTime + METRONOME_SCHEDULE_AHEAD_SECONDS) {
      const time = run.nextBeatTime
      if (run.sessionEndsAt !== null && time >= run.sessionEndsAt) return

      const beatInBar = run.beatIndex % 4
      const isCountIn = run.beatIndex < STICKING_COUNT_IN_BEATS

      // The interval starts counting once the count-in is over.
      if (run.beatIndex === STICKING_COUNT_IN_BEATS && run.rotationSeconds > 0) {
        run.nextFillAt = time + run.rotationSeconds
      }

      if (!isCountIn && beatInBar === 0 && run.nextFillAt !== null && time >= run.nextFillAt) {
        changeFill(ctx, time)
        continue
      }

      if (isCountIn) {
        playCountIn(ctx, time, beatInBar)
      } else {
        playMetronomeClick(ctx, time, beatInBar === 0 ? 1320 : 920, beatInBar === 0 ? 0.36 : 0.26)
      }
      atAudioTime(ctx, time, () => {
        setActiveBeat(beatInBar)
        setBanner(isCountIn ? String(beatInBar + 1) : null)
      })
      atAudioTime(ctx, time + 0.09, () => setActiveBeat(null))

      run.nextBeatTime += 60 / tempoRef.current
      run.beatIndex += 1
    }
  }

  // Rather than stopping the scheduler, push the next beat back past the chime
  // and the reveal and start a fresh count-in from there.
  function changeFill(ctx, time) {
    const run = runRef.current
    const resumeAt = time + STICKING_CHIME_SECONDS + STICKING_REVEAL_MS / 1000 + 0.3

    run.nextFillAt = null
    run.nextBeatTime = resumeAt
    run.beatIndex = 0
    playFillChangeChime(ctx, time)
    atAudioTime(ctx, time, () => setBanner('New fill'))
    atAudioTime(ctx, time + STICKING_CHIME_SECONDS, () => onNewFillRef.current())
  }

  function updateClock(ctx) {
    const run = runRef.current
    const now = ctx.currentTime

    if (run.sessionEndsAt !== null && now >= run.sessionEndsAt) {
      stop({ playCompletion: true })
      return
    }

    setClock({
      session: run.sessionEndsAt === null ? null : Math.ceil(run.sessionEndsAt - now),
      nextFill: run.nextFillAt === null ? null : Math.max(0, Math.ceil(run.nextFillAt - now)),
    })
  }

  function runFrom(ctx) {
    window.clearInterval(schedulerRef.current)
    window.clearInterval(clockRef.current)
    updateClock(ctx)
    schedulerRef.current = window.setInterval(() => scheduler(ctx), METRONOME_LOOKAHEAD_MS)
    clockRef.current = window.setInterval(() => updateClock(ctx), 200)
  }

  async function start() {
    const ctx = await getAudioContext()
    await loadVoice(ctx)
    const startsAt = ctx.currentTime + 0.08
    const sessionSeconds = clampWholeNumber(sessionMinutes, 0, 240) * 60

    runRef.current = {
      nextBeatTime: startsAt,
      beatIndex: 0,
      rotationSeconds,
      sessionEndsAt: sessionSeconds > 0 ? startsAt + sessionSeconds : null,
      nextFillAt: null,
      paused: null,
    }
    setIsPlaying(true)
    runFrom(ctx)

    // Keep the screen awake for the session; the fill is no use on a dark screen.
    try {
      wakeLockRef.current = await navigator.wakeLock?.request('screen')
    } catch {
      wakeLockRef.current = null
    }
  }

  // Holds the click and the session clock where they are. Anything already
  // queued (a pending new fill included) is dropped; resume sorts out the fill.
  function pause() {
    const run = runRef.current
    const ctx = audioContextRef.current
    if (!run || run.paused) return

    window.clearInterval(schedulerRef.current)
    window.clearInterval(clockRef.current)
    clearVisualTimeouts()
    run.paused = {
      sessionLeft: run.sessionEndsAt === null ? null : Math.max(0, run.sessionEndsAt - ctx.currentTime),
    }
    setActiveBeat(null)
    setBanner('Paused')
  }

  function resume({ newFill = false } = {}) {
    const run = runRef.current
    const ctx = audioContextRef.current
    if (!run || !run.paused) {
      if (newFill) onNewFillRef.current()
      return
    }

    const now = ctx.currentTime
    const startsAt = now + (newFill ? STICKING_REVEAL_MS / 1000 : 0) + 0.3
    if (newFill) {
      setBanner('New fill')
      onNewFillRef.current()
    } else {
      setBanner(null)
    }

    run.sessionEndsAt = run.paused.sessionLeft === null ? null : now + run.paused.sessionLeft
    run.nextBeatTime = startsAt
    run.beatIndex = 0
    run.nextFillAt = null
    run.paused = null
    runFrom(ctx)
  }

  function stop(options = {}) {
    window.clearInterval(schedulerRef.current)
    window.clearInterval(clockRef.current)
    clearVisualTimeouts()
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    runRef.current = null
    setActiveBeat(null)
    setBanner(null)
    setClock({ session: null, nextFill: null })
    setIsPlaying(false)

    if (options.playCompletion && audioContextRef.current) {
      playSessionCompleteSound(audioContextRef.current)
    }
  }

  // The page drives pause and resume around a downvote.
  useEffect(() => {
    if (!controlRef) return undefined
    controlRef.current = { pause, resume }
    return () => {
      controlRef.current = null
    }
  })

  const isCountInBanner = banner !== null && /^[1-4]$/.test(banner)

  return (
    <div className="sticking-session surface-card">
      <div className="sticking-session-controls">
        <div className="sticking-session-field">
          <label className="control-label" htmlFor="sticking-session-minutes">Session</label>
          <div className="sticking-session-input-row">
            <input
              id="sticking-session-minutes"
              className="control-input"
              type="number"
              min="0"
              max="240"
              step="1"
              value={sessionMinutes}
              disabled={isPlaying}
              onChange={(event) => setSessionMinutes(clampWholeNumber(event.target.value, 0, 240))}
            />
            <span className="metronome-bpm">Min</span>
          </div>
        </div>

        <div className="sticking-session-field">
          <label className="control-label" htmlFor="sticking-rotation">New Fill</label>
          <select
            id="sticking-rotation"
            className="control-input ear-select"
            value={rotationSeconds}
            disabled={isPlaying}
            onChange={(event) => setRotationSeconds(Number(event.target.value))}
          >
            {STICKING_ROTATION_OPTIONS.map((option) => (
              <option key={option.seconds} value={option.seconds}>{option.label}</option>
            ))}
          </select>
        </div>

        <button className="primary-button" type="button" onClick={() => (isPlaying ? stop() : start())}>
          {isPlaying ? 'Stop' : 'Start Session'}
        </button>
      </div>

      <div className="sticking-session-status">
        <div className={`sticking-session-banner${banner ? ' is-visible' : ''}`} aria-live="polite">
          {isCountInBanner ? <span className="stat-label">Count-in</span> : null}
          <span key={banner}>{banner}</span>
        </div>
        <div className="sticking-session-beats" aria-hidden="true">
          {[0, 1, 2, 3].map((beat) => (
            <span
              key={beat}
              className={`sticking-session-beat${beat === 0 ? ' is-downbeat' : ''}${activeBeat === beat ? ' is-active' : ''}`}
            />
          ))}
        </div>
        <div className="sticking-session-readout">
          <span>
            <span className="stat-label">Tempo</span>
            {tempo}
          </span>
          <span>
            <span className="stat-label">Session</span>
            {clock.session !== null
              ? formatSessionTime(clock.session)
              : sessionMinutes > 0 ? formatSessionTime(sessionMinutes * 60) : 'Open'}
          </span>
          <span>
            <span className="stat-label">Next Fill</span>
            {clock.nextFill !== null
              ? formatSessionTime(clock.nextFill)
              : rotationSeconds > 0 ? formatSessionTime(rotationSeconds) : 'Off'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Two thumbs over one track. Each input only takes pointer events on its own
// thumb, so either end can be dragged wherever the other one sits.
function TempoRangeSlider({ id, value, onChange }) {
  const [low, high] = value
  const span = STICKING_TEMPO_LIMITS.max - STICKING_TEMPO_LIMITS.min
  const lowPercent = ((low - STICKING_TEMPO_LIMITS.min) / span) * 100
  const highPercent = ((high - STICKING_TEMPO_LIMITS.min) / span) * 100

  return (
    <div className="dual-range" style={{ '--range-low': `${lowPercent}%`, '--range-high': `${highPercent}%` }}>
      <input
        id={id}
        className="dual-range-input"
        type="range"
        min={STICKING_TEMPO_LIMITS.min}
        max={STICKING_TEMPO_LIMITS.max}
        step="1"
        value={low}
        aria-label="Slowest tempo"
        onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
      />
      <input
        className="dual-range-input"
        type="range"
        min={STICKING_TEMPO_LIMITS.min}
        max={STICKING_TEMPO_LIMITS.max}
        step="1"
        value={high}
        aria-label="Fastest tempo"
        onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
      />
    </div>
  )
}

function StickingFeedbackDialog({ open, sticking, onSubmit, onCancel }) {
  const dialogRef = useRef(null)
  const noteRef = useRef(null)
  const [tags, setTags] = useState([])
  const [note, setNote] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      noteRef.current.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  function finish(callback) {
    callback({ tags, note })
    setTags([])
    setNote('')
  }

  function toggleTag(tag) {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))
  }

  return (
    <dialog
      ref={dialogRef}
      className="sticking-feedback"
      onCancel={(event) => {
        event.preventDefault()
        finish(onCancel)
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault()
          finish(onSubmit)
        }}
      >
        <span className="control-label">What's off about this one?</span>
        <div className="sticking-line sticking-feedback-sticking">{sticking}</div>

        <div className="sticking-feedback-tags">
          {STICKING_FEEDBACK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`ear-level-chip${tags.includes(tag) ? ' is-active' : ''}`}
              aria-pressed={tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <textarea
          ref={noteRef}
          className="control-input sticking-feedback-note"
          rows="3"
          maxLength="2000"
          placeholder="Anything else? (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              finish(onSubmit)
            }
          }}
        />

        <div className="sticking-feedback-actions">
          <button className="secondary-button" type="button" onClick={() => finish(onCancel)}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Log &amp; New Fill
          </button>
        </div>
      </form>
    </dialog>
  )
}

// The fill as notation, sticking underneath. Falls back to the sticking as
// text until (or unless) VexFlow loads.
function FillNotation({ steps, notesPerBeat, beats, landing }) {
  const hostRef = useRef(null)
  const [vexflow, setVexflow] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadVexFlow()
      .then((module) => {
        if (!cancelled) setVexflow(module)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!vexflow || !host) return
    const style = getComputedStyle(host)
    const token = (name) => style.getPropertyValue(name).trim()

    renderFillNotation(host, vexflow, {
      steps,
      notesPerBeat,
      beats,
      landing,
      colors: {
        ink: token('--text'),
        muted: token('--text-muted'),
        hand: token('--text'),
        kick: token('--accent-warm'),
      },
      font: style.fontFamily,
    })
  }, [vexflow, steps, notesPerBeat, beats, landing])

  if (failed) {
    return <div className="sticking-line fill-notation-fallback">{steps.map((step) => step.stroke).join(' ')}</div>
  }

  return <div ref={hostRef} className="fill-notation" role="img" aria-label={`Fill: ${steps.map((step) => step.stroke).join(' ')}, landing on the ${landing.label.toLowerCase()}`} />
}

function ThumbIcon({ down = false }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {down ? (
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
      ) : (
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      )}
    </svg>
  )
}

function StickingGeneratorPage() {
  const [rateId, setRateId] = useState('sixteenth')
  const [resolutionId, setResolutionId] = useState('kick')
  const [beats, setBeats] = useState(2)
  const [tempoRange, setTempoRange] = useState(STICKING_DEFAULT_TEMPO_RANGE)
  const rate = STICKING_RATES.find((item) => item.id === rateId)
  const resolution = STICKING_RESOLUTIONS.find((item) => item.id === resolutionId)
  // Downvotes from this browser straight away, and everyone's once the
  // feedback store answers, so a bad fill stays gone on both machines.
  const downvotedRef = useRef(null)
  const [fill, setFill] = useState(() => ({
    cells: getRandomFill(beats * rate.notesPerBeat, resolution.stroke, rateId, new Set(readStoredList(STICKING_DOWNVOTES_KEY))),
    tempo: randomInt(...STICKING_DEFAULT_TEMPO_RANGE),
  }))
  const [manualFillCount, setManualFillCount] = useState(0)
  const [reveal, setReveal] = useState(null)
  const [upvoted, setUpvoted] = useState(null)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const revealTimerRef = useRef(null)
  const sessionControlRef = useRef(null)
  const { cells } = fill
  const strokes = useMemo(() => cells.flatMap((cell) => cell.strokes), [cells])

  useEffect(() => {
    rememberSticking(getStickingId(rateId, strokes, resolution.stroke))
  }, [strokes, rateId, resolution])

  useEffect(() => () => window.clearInterval(revealTimerRef.current), [])

  useEffect(() => {
    downvotedRef.current = new Set(readStoredList(STICKING_DOWNVOTES_KEY))
    flushStickingOutbox()

    fetch(STICKING_FEEDBACK_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        data?.entries
          ?.filter((entry) => entry.vote === 'down')
          .forEach((entry) => downvotedRef.current.add(`${entry.strokes}>${entry.resolution}`))
      })
      .catch(() => {})
  }, [])

  // Counted where the fill sits in the bar: it ends the bar, so a two-beat
  // fill runs "3 e & a 4 e & a".
  const notationSteps = useMemo(() => {
    const firstBeat = 4 - strokes.length / rate.notesPerBeat + 1
    return strokes.map((stroke, index) => {
      const offset = index % rate.notesPerBeat
      const isScrambling = reveal !== null && index >= reveal.settled
      return {
        stroke: isScrambling ? reveal.noise[index] : stroke,
        count: offset === 0 ? String(firstBeat + index / rate.notesPerBeat) : rate.counts[offset],
        isScrambling,
      }
    })
  }, [strokes, rate, reveal])

  function generate(next = {}) {
    const nextRate = STICKING_RATES.find((item) => item.id === (next.rateId ?? rateId))
    const nextResolution = STICKING_RESOLUTIONS.find((item) => item.id === (next.resolutionId ?? resolutionId))
    const nextBeats = next.beats ?? beats
    const nextCells = getRandomFill(
      nextBeats * nextRate.notesPerBeat,
      nextResolution.stroke,
      nextRate.id,
      downvotedRef.current ?? new Set(),
    )
    setFill({ cells: nextCells, tempo: randomInt(...tempoRange) })
    setUpvoted(null)
    return nextCells
  }

  function stopReveal() {
    window.clearInterval(revealTimerRef.current)
    setReveal(null)
  }

  function generateByHand(next) {
    stopReveal()
    generate(next)
    setManualFillCount((count) => count + 1)
  }

  // A new fill in a session scrambles for a moment, then settles left to right.
  function revealNewFill() {
    const length = generate().flatMap((cell) => cell.strokes).length
    const frameMs = 70
    let frame = 0

    function step() {
      const progress = (frame * frameMs) / STICKING_REVEAL_MS
      frame += 1
      if (progress >= 1) {
        stopReveal()
        return
      }
      setReveal({
        settled: Math.floor(Math.max(0, (progress - 0.3) / 0.7) * length),
        noise: Array.from({ length }, () => 'RLK'[randomInt(0, 2)]),
      })
    }

    window.clearInterval(revealTimerRef.current)
    step()
    revealTimerRef.current = window.setInterval(step, frameMs)
  }

  function updateRate(nextRateId) {
    setRateId(nextRateId)
    generateByHand({ rateId: nextRateId })
  }

  function updateResolution(nextResolutionId) {
    setResolutionId(nextResolutionId)
    generateByHand({ resolutionId: nextResolutionId })
  }

  function updateBeats(event) {
    const nextBeats = Number(event.target.value)
    setBeats(nextBeats)
    generateByHand({ beats: nextBeats })
  }

  // A fill whose tempo falls outside the new range is pulled back inside it.
  function updateTempoRange(nextRange) {
    setTempoRange(nextRange)
    setFill((current) => ({ ...current, tempo: clamp(current.tempo, nextRange[0], nextRange[1]) }))
  }

  function describeFill() {
    return {
      strokes: strokes.join(''),
      resolution: resolution.stroke,
      rateId,
      beats,
      tempo: fill.tempo,
      cells: cells.map((cell) => cell.pattern),
    }
  }

  function upvote() {
    sendStickingFeedback({ vote: 'up', ...describeFill() })
    setUpvoted(fill)
  }

  function downvote() {
    sessionControlRef.current?.pause()
    setIsFeedbackOpen(true)
  }

  function submitDownvote({ tags, note }) {
    const described = describeFill()
    sendStickingFeedback({ vote: 'down', ...described, tags, note })

    const key = `${described.strokes}>${described.resolution}`
    downvotedRef.current.add(key)
    writeStoredList(STICKING_DOWNVOTES_KEY, [...new Set([...readStoredList(STICKING_DOWNVOTES_KEY), key])])

    setIsFeedbackOpen(false)
    setManualFillCount((count) => count + 1)
    if (sessionControlRef.current) {
      sessionControlRef.current.resume({ newFill: true })
    } else {
      revealNewFill()
    }
  }

  function cancelDownvote() {
    setIsFeedbackOpen(false)
    sessionControlRef.current?.resume()
  }

  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <div style={metaStyle}>Practice Tools</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Sticking Generator</h1>
        <p style={introStyle}>
          Generate linear fill stickings built from rudiments, with hands and kick sharing one line and
          the fill landing on the next downbeat.
        </p>

        <div className="sticking-toolbar">
          <div className="control-card">
            <span className="control-label">Rate</span>
            <div className="sticking-chips">
              {STICKING_RATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ear-level-chip${item.id === rateId ? ' is-active' : ''}`}
                  aria-pressed={item.id === rateId}
                  onClick={() => updateRate(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-card">
            <span className="control-label">Resolve On</span>
            <div className="sticking-chips">
              {STICKING_RESOLUTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ear-level-chip${item.id === resolutionId ? ' is-active' : ''}`}
                  aria-pressed={item.id === resolutionId}
                  onClick={() => updateResolution(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-card">
            <label className="control-label" htmlFor="sticking-beats">Length</label>
            <div className="range-value">{beats} {beats === 1 ? 'beat' : 'beats'}</div>
            <input
              id="sticking-beats"
              className="range-input"
              type="range"
              min="1"
              max="4"
              step="1"
              value={beats}
              onChange={updateBeats}
            />
          </div>

          <div className="control-card">
            <label className="control-label" htmlFor="sticking-tempo-range">Tempo Range</label>
            <div className="range-value">{tempoRange[0]}–{tempoRange[1]} BPM</div>
            <TempoRangeSlider id="sticking-tempo-range" value={tempoRange} onChange={updateTempoRange} />
          </div>
        </div>

        <StickingPracticeSession
          tempo={fill.tempo}
          onNewFill={revealNewFill}
          manualFillCount={manualFillCount}
          controlRef={sessionControlRef}
        />

        <div className="sticking-board surface-card">
          <FillNotation
            steps={notationSteps}
            notesPerBeat={rate.notesPerBeat}
            beats={strokes.length / rate.notesPerBeat}
            landing={resolution}
          />

          <div className="sticking-board-actions">
            <button
              className={`sticking-vote${upvoted === fill ? ' is-active' : ''}`}
              type="button"
              disabled={reveal !== null || upvoted === fill}
              onClick={upvote}
              aria-label={upvoted === fill ? 'Liked' : 'Thumbs up'}
              title={upvoted === fill ? 'Liked' : 'Thumbs up'}
            >
              <ThumbIcon />
            </button>
            <button
              className="sticking-vote"
              type="button"
              disabled={reveal !== null}
              onClick={downvote}
              aria-label="Thumbs down"
              title="Thumbs down"
            >
              <ThumbIcon down />
            </button>
            <button className="primary-button" type="button" onClick={() => generateByHand()}>
              Generate Fill
            </button>
          </div>
        </div>

        <div className={`surface-card sticking-built-from${reveal ? ' is-hidden' : ''}`} style={cardStyle}>
          <div className="stat-label">Built From</div>
          <ol className="sticking-cells">
            {cells.map((cell, index) => (
              <li key={index}>
                <span className="sticking-line">{cell.pattern}</span>
                <span className="sticking-cell-name">{cell.name}</span>
              </li>
            ))}
          </ol>
        </div>

        <StickingFeedbackDialog
          open={isFeedbackOpen}
          sticking={cells.map((cell) => cell.pattern).join(' ')}
          onSubmit={submitDownvote}
          onCancel={cancelDownvote}
        />
      </section>
    </div>
  )
}

function BeatsPage() {
  return (
    <div style={{ ...pageShellStyle, maxWidth: '1320px' }}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Beat Store</h1>
        <p style={introStyle}>Stream, browse, and purchase beats from Luke's BeatStars store.</p>

        <div className="embed-shell">
          <iframe
            src="https://player.beatstars.com/?storeId=152173"
            width="100%"
            height="900"
            style={{ width: '100%', maxWidth: '100%', minHeight: '70vh', border: 'none', display: 'block', borderRadius: '18px' }}
            title="BeatStars Store"
          ></iframe>
        </div>
      </section>
    </div>
  )
}

function VideoPage() {
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState(YOUTUBE_API_KEY ? 'loading' : 'fallback')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!YOUTUBE_API_KEY) {
      return
    }

    const controller = new AbortController()

    async function loadPlaylistVideos() {
      try {
        setStatus('loading')
        setErrorMessage('')

        const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
        url.searchParams.set('part', 'snippet,contentDetails')
        url.searchParams.set('maxResults', '24')
        url.searchParams.set('playlistId', YOUTUBE_PLAYLIST_ID)
        url.searchParams.set('key', YOUTUBE_API_KEY)

        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`YouTube API request failed with status ${response.status}.`)
        }

        const data = await response.json()
        const playlistVideos = (data.items || [])
          .map((item) => {
            const snippet = item.snippet || {}
            const resourceVideoId = snippet.resourceId?.videoId
            const contentVideoId = item.contentDetails?.videoId
            const videoId = resourceVideoId || contentVideoId

            if (!videoId) {
              return null
            }

            return {
              id: item.id,
              videoId,
              title: snippet.title || 'Untitled video',
              description: snippet.description || '',
              thumbnail: getBestThumbnail(snippet.thumbnails),
            }
          })
          .filter(Boolean)

        if (playlistVideos.length === 0) {
          throw new Error('No playlist videos were returned.')
        }

        setVideos(playlistVideos)
        setStatus('ready')
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        setStatus('fallback')
        setErrorMessage(error.message)
      }
    }

    loadPlaylistVideos()

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(30px, 4vw, 44px)' }}>
        <div style={metaStyle}>Content</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Video</h1>
        <p style={introStyle}>
          Watch recent performances, playthroughs, studio clips, and other video work.
        </p>

        {status === 'ready' ? (
          <div className="video-portfolio">
            <div className="video-portfolio-header">
              <h2 style={{ ...sectionHeadingStyle, marginBottom: '6px' }}>Playlist Grid</h2>
              <p style={mutedTextStyle}>
                {videos.length} videos from Luke's featured YouTube playlist.
              </p>
            </div>

            <div className="video-grid">
              {videos.map((video) => (
                <article key={video.id} className="video-grid-card">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}&list=${YOUTUBE_PLAYLIST_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="video-grid-link"
                  >
                    <div className="video-grid-media">
                      <img className="video-thumb" src={video.thumbnail} alt="" />
                      <span className="video-play-badge">Watch</span>
                    </div>
                    <div className="video-card-copy">
                      <span className="video-card-title">{video.title}</span>
                      {video.description ? (
                        <span className="video-card-description">{video.description}</span>
                      ) : null}
                    </div>
                  </a>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="surface-card" style={cardStyle}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Playlist Embed</h2>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              {status === 'loading'
                ? 'Loading videos from YouTube.'
                : 'Watch the featured YouTube playlist below.'}
            </p>
            {errorMessage ? <p className="video-note">{errorMessage}</p> : null}

            <div className="embed-shell">
              <iframe
                src={buildYouTubePlaylistEmbedUrl(YOUTUBE_PLAYLIST_ID)}
                title="YouTube playlist"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="video-frame"
              ></iframe>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function AudioPage() {
  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(30px, 4vw, 44px)' }}>
        <div style={metaStyle}>Content</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Audio</h1>
        <p style={introStyle}>
          Listen to selected productions, drum work, beats, and releases.
        </p>

        <div className="surface-card" style={cardStyle}>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Featured Playlist</h2>
          <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
            A curated Spotify playlist featuring selected audio work.
          </p>

          <div className="embed-shell">
            <iframe
              title="Spotify playlist"
              src={`https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator&theme=0`}
              width="100%"
              height="720"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="audio-frame"
            ></iframe>
          </div>
        </div>
      </section>
    </div>
  )
}

const CONFETTI_COLORS = ['#8f9d78', '#b88a5a', '#d4c7a1', '#f6edd8', '#7fbf7a', '#7f8b9b']

// Fires from whichever chord chip came back correct, so the celebration lands
// where the eye already is.
function ConfettiBurst({ trigger }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!trigger || !canvas) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const context = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * ratio
    canvas.height = height * ratio
    context.scale(ratio, ratio)

    // A hard mode clear lights the whole chart, so the burst comes from the
    // middle of everything that was named rather than from the first of it. A
    // single chip is its own first and last, and lands where it always did.
    const named = document.querySelectorAll('.ear-chord-result.is-correct')
    const first = named.length > 0 ? named[0].getBoundingClientRect() : null
    const last = named.length > 0 ? named[named.length - 1].getBoundingClientRect() : null
    const originX = first ? (first.left + last.right) / 2 : width / 2
    const originY = first ? (first.top + last.bottom) / 2 : height / 3

    const pieces = Array.from({ length: 90 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 7
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.5,
        size: 4 + Math.random() * 5,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 0,
      }
    })

    const lifespan = 110
    const draw = () => {
      context.clearRect(0, 0, width, height)
      let alive = false
      pieces.forEach((piece) => {
        piece.life += 1
        const fade = 1 - piece.life / lifespan
        if (fade <= 0) return
        alive = true
        piece.vy += 0.28
        piece.vx *= 0.99
        piece.x += piece.vx
        piece.y += piece.vy
        piece.rotation += piece.spin
        context.save()
        context.globalAlpha = fade
        context.translate(piece.x, piece.y)
        context.rotate(piece.rotation)
        context.fillStyle = piece.color
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62)
        context.restore()
      })
      frameRef.current = alive ? window.requestAnimationFrame(draw) : null
      if (!alive) context.clearRect(0, 0, width, height)
    }
    frameRef.current = window.requestAnimationFrame(draw)

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      context.clearRect(0, 0, width, height)
    }
  }, [trigger])

  return <canvas ref={canvasRef} className="ear-confetti" aria-hidden="true" />
}

const EAR_TRAINER_DEFAULT_LEVELS = { core: true, intermediate: true, advanced: false }

// Settled once at load rather than during a render, so nothing has to reach for
// the browser while React is deciding what the page looks like.
const MIDI_SUPPORTED = isMidiSupported()

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function beatsPerChordFor(progression) {
  return progression.chords.length >= 6 ? 2 : 4
}

// A little tempo drift stops the ear from anchoring on one groove. It lives out
// here with the other rolls of the dice, away from anything React renders.
function driftTempo(tempo) {
  return Math.round(Number(tempo) * (0.9 + Math.random() * 0.28))
}

function describeChordResult(item) {
  if (item.status === 'correct') {
    return item.exact ? 'Correct — extension and all' : 'Correct — right function'
  }
  const label = qualityLabel(item.family, item.quality)
  if (item.status === 'rootOnly') return `Right root — it was a ${label}`
  if (item.status === 'quality') return `Right root, but it was a ${label}`
  if (item.status === 'missing') return 'Nothing typed'
  return `You typed ${item.typed}`
}

// A chord chip is a button when there is something to hear and a plain panel
// when there is not — a blank is never played through this, since hearing it
// on its own would be handing over the answer. It has a button of its own,
// which picks it out for the answer box instead of sounding it.
function ChordCard({ className, onPlay, children }) {
  if (!onPlay) return <div className={className}>{children}</div>
  return (
    <button
      className={`${className} is-clickable`}
      type="button"
      onClick={onPlay}
      title="Play this chord on its own"
    >
      {children}
    </button>
  )
}

function EarTrainerPage() {
  const [levels, setLevels] = useState(EAR_TRAINER_DEFAULT_LEVELS)
  const [tempo, setTempo] = useState(78)
  const [varySounds, setVarySounds] = useState(true)
  const [instrumentId, setInstrumentId] = useState(CHORD_INSTRUMENTS[0].id)
  const [useRandomKey, setUseRandomKey] = useState(true)
  const [playReference, setPlayReference] = useState(true)
  const [loopPlayback, setLoopPlayback] = useState(true)
  const [drums, setDrums] = useState(true)
  const [showKey, setShowKey] = useState(true)
  const [showRoman, setShowRoman] = useState(true)
  // Hard mode leaves nothing on the page: the key centre sounds, the changes go
  // round, and every chord in them is a blank to be named.
  const [hardMode, setHardMode] = useState(false)
  const [question, setQuestion] = useState(null)
  // A draft per blank, kept against the chord's place in the progression. One
  // blank or all of them is only a difference in how many keys this has, so the
  // chart, the answer box and the grading read the same shape either way.
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [activeChordIndex, setActiveChordIndex] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [celebration, setCelebration] = useState(0)
  const [history, setHistory] = useState([])
  // Every answer graded this session. The Recent list keeps only the last ten,
  // so it is this that the session score is out of — otherwise the eleventh
  // answer starts dividing by a total that has stopped growing.
  const [answered, setAnswered] = useState(0)
  const [bonuses, setBonuses] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [sessionPoints, setSessionPoints] = useState(0)
  const [midi, setMidi] = useState({ status: MIDI_SUPPORTED ? 'idle' : 'unsupported', devices: [], error: null })
  // What is under the fingers now, what the notes played add up to, and which
  // chord on the chart they were played at — the readings on offer belong to
  // that slot, and must not still be there to be taken once it has moved on.
  const [played, setPlayed] = useState({ held: [], heard: null, slot: null })
  const midiRef = useRef(null)
  // A pedal is for sustaining, so it only moves things along once there is
  // something to move on from — a chord played since the last time it did.
  const pedalArmedRef = useRef(false)
  // One live voice per key that is down, so a note can be let go of.
  const liveVoicesRef = useRef(new Map())
  // The MIDI callbacks are made once, when the keyboard is connected, so they
  // read the question as it stands now off a ref rather than off the render
  // they happened to be created in.
  const liveRef = useRef({ key: null, slot: 0, locked: true, advance: () => {} })
  const engineRef = useRef(null)
  const playTimeoutRef = useRef(null)
  // What the loop is waiting to play next, kept so a pause can drop the timer
  // and a resume can put it back against the clock as it stands then.
  const pendingRepeatRef = useRef(null)
  const frameRef = useRef(null)
  const loopRef = useRef({ enabled: true, answered: false })
  const passesRef = useRef([])
  const currentQuestionRef = useRef(null)
  const answerInputRef = useRef(null)

  const pool = useMemo(() => progressions.filter((item) => levels[item.level]), [levels])

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) window.clearTimeout(playTimeoutRef.current)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      if (engineRef.current) engineRef.current.close()
      // Live voices need no unwinding of their own: closing the context takes
      // the whole graph, monitor bus and all, with it.
      if (midiRef.current) midiRef.current.close()
    }
  }, [])

  // What you play, in the stock piano, on a bus of its own. Not the question's
  // instrument: hearing your guess in the same voice as the chord you are
  // guessing about is halfway to being told.
  function soundLiveNote({ note, on, velocity }) {
    const engine = engineRef.current
    const voices = liveVoicesRef.current
    // Pausing suspends the audio clock, and a note started against a stopped
    // clock would sit silent until the clock ran again and then all arrive at
    // once. Nothing sounds until the question does.
    if (!engine || engine.ctx.state !== 'running') return
    voices.get(note)?.release()
    if (!on) {
      voices.delete(note)
      return
    }
    voices.set(note, playLiveNote(engine, note, velocity))
  }

  // Web MIDI asks the user for permission, so the request has to come from
  // something they did. Once granted it is remembered for the origin, and the
  // next visit connects on the first press without a prompt.
  async function connectMidiKeyboard() {
    if (!MIDI_SUPPORTED || midi.status === 'connecting' || midi.status === 'ready') return
    setMidi((previous) => ({ ...previous, status: 'connecting', error: null }))
    try {
      // The connect button is the user gesture the audio clock needs, so the
      // engine is started here rather than on the first note. Sounding a key
      // is then synchronous, which is the only way it lands in time.
      await getEngine()
      const connection = await connectMidi({
        onNote: soundLiveNote,
        onChord: ({ chord, held }) => {
          const live = liveRef.current
          const heard = live.key && chord.length > 0 ? recogniseChord(chord, live.key) : null
          setPlayed({ held, heard, slot: live.slot })
          // Held is the authority on whether anything is down, so a note-off
          // that never arrived cannot leave the loop ducked for good.
          engineRef.current?.duckPhrases(held.length > 0)
          if (!heard || live.locked) return
          pedalArmedRef.current = true
          setAnswers((previous) => ({ ...previous, [live.slot]: heard.symbol }))
        },
        onSustain: (down) => {
          if (!down) return
          // Once the answer is up the pedal is the way to the next question,
          // and nothing needs to have been played for that.
          if (!pedalArmedRef.current && !liveRef.current.locked) return
          pedalArmedRef.current = false
          liveRef.current.advance()
        },
        onDevices: (devices) => setMidi((previous) => ({ ...previous, devices })),
        onError: (error) => setMidi((previous) => ({ ...previous, error: String(error?.message ?? error) })),
      })
      midiRef.current = connection
      setMidi({ status: 'ready', devices: connection.devices, error: null })
    } catch (error) {
      // A refused permission and a browser that cannot do this at all land in
      // the same place: there is no keyboard, and the box still takes typing.
      setMidi({ status: 'denied', devices: [], error: String(error?.message ?? error) })
    }
  }

  async function getEngine() {
    if (!engineRef.current) {
      engineRef.current = createEngine()
    }
    await engineRef.current.ensure()
    return engineRef.current
  }

  // The chart follows the audio clock: whichever scheduled pass is sounding
  // right now decides which chip is lit.
  function trackHighlight() {
    const engine = engineRef.current
    if (!engine) return
    const now = engine.ctx.currentTime
    passesRef.current = passesRef.current.filter((pass) => now < pass.startTime + pass.length)
    if (passesRef.current.length === 0) {
      setActiveChordIndex(null)
      setPlaying(false)
      frameRef.current = null
      return
    }
    const pass = passesRef.current.find((item) => now >= item.startTime)
    if (pass) {
      const elapsed = now - pass.startTime
      const segment = pass.timeline.find((item) => elapsed >= item.start && elapsed < item.end)
      setActiveChordIndex(segment ? segment.index : null)
    }
    frameRef.current = window.requestAnimationFrame(trackHighlight)
  }

  // The tonic reference is a way in to the key, so it plays once at the top of
  // a question rather than on every time round the loop.
  function schedulePass(target, tempoScale, isLoopPass, at) {
    const engine = engineRef.current
    if (!engine) return
    const chordInstrument =
      CHORD_INSTRUMENTS.find((item) => item.id === target.instrumentId) ?? CHORD_INSTRUMENTS[0]
    const bassInstrument = BASS_INSTRUMENTS[target.bassId]
    const withReference = target.playReference && !isLoopPass
    const arrangement =
      tempoScale === 1
        ? (withReference ? target.arrangement : target.loopArrangement)
        : buildArrangement({
            chords: target.chords,
            key: target.key,
            tonic: target.progression.tonic,
            tempo: target.tempo * tempoScale,
            beatsPerChord: target.beatsPerChord,
            pattern: target.pattern,
            playReference: withReference,
            drums: target.drums,
          })

    const { startTime } = playArrangement(engine, arrangement, chordInstrument, bassInstrument, at)
    passesRef.current.push({
      startTime,
      timeline: arrangement.timeline,
      length: arrangement.loopLength,
    })
    if (!frameRef.current) {
      frameRef.current = window.requestAnimationFrame(trackHighlight)
    }

    // Queue the repeat before this pass ends and pin it to the exact bar line,
    // so the loop carries straight on rather than pausing for a fresh count-in.
    pendingRepeatRef.current = { target, tempoScale, boundary: startTime + arrangement.loopLength }
    armRepeat()
  }

  // The repeat is a wall-clock timer pointing at a moment on the audio clock,
  // so it has to be measured against that clock every time it is set — after a
  // pause the two are further apart than they were.
  function armRepeat() {
    const engine = engineRef.current
    const pending = pendingRepeatRef.current
    if (!engine || !pending) return
    if (playTimeoutRef.current) window.clearTimeout(playTimeoutRef.current)
    playTimeoutRef.current = window.setTimeout(() => {
      const { enabled, answered } = loopRef.current
      if (!enabled || answered || currentQuestionRef.current !== pending.target) return
      schedulePass(pending.target, pending.tempoScale, true, pending.boundary)
    }, Math.max(0, pending.boundary - 0.35 - engine.ctx.currentTime) * 1000)
  }

  // Every voice is scheduled ahead on the audio clock and cannot be taken back,
  // so pausing means stopping that clock: the notes still to sound stay where
  // they are relative to it, and the chart, which reads the same clock, holds
  // its place with them.
  async function togglePause() {
    const engine = engineRef.current
    if (!engine || !playing) return
    if (paused) {
      await engine.ctx.resume()
      setPaused(false)
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(trackHighlight)
      armRepeat()
      return
    }
    if (playTimeoutRef.current) window.clearTimeout(playTimeoutRef.current)
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    playTimeoutRef.current = null
    frameRef.current = null
    await engine.ctx.suspend()
    setPaused(true)
  }

  // One chord on its own, lifted out of the pass the question is playing: the
  // same voicing and the same rhythm it has in the progression, so clicking a
  // chip is a closer listen rather than a different arrangement of it.
  async function playChordAlone(index) {
    if (!question) return
    const source = index === -1 ? question.arrangement : question.loopArrangement
    const slot = source.timeline.find((item) => item.index === index)
    if (!slot) return
    const events = source.events
      .filter((event) => event.kind !== 'drum' && event.time >= slot.start - 0.001 && event.time < slot.end - 0.001)
      .map((event) => ({ ...event, time: event.time - slot.start }))
    if (events.length === 0) return
    const engine = await getEngine()
    stopPlayback()
    const chordInstrument =
      CHORD_INSTRUMENTS.find((item) => item.id === question.instrumentId) ?? CHORD_INSTRUMENTS[0]
    const span = slot.end - slot.start
    const single = { events, duration: span + 1.2 }
    const { startTime } = playArrangement(
      engine, single, chordInstrument, BASS_INSTRUMENTS[question.bassId], null,
    )
    // The chip that was clicked is the one that lights, whatever its place in
    // the progression the slice came from.
    passesRef.current.push({ startTime, timeline: [{ index, start: 0, end: span }], length: span })
    setPlaying(true)
    if (!frameRef.current) frameRef.current = window.requestAnimationFrame(trackHighlight)
  }

  async function playQuestion(target, tempoScale = 1) {
    if (!target) return
    await getEngine()
    stopPlayback()
    schedulePass(target, tempoScale, false, null)
    setPlaying(true)
  }

  function stopPlayback() {
    if (playTimeoutRef.current) window.clearTimeout(playTimeoutRef.current)
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    playTimeoutRef.current = null
    frameRef.current = null
    pendingRepeatRef.current = null
    if (engineRef.current) {
      // Cutting a phrase short is a quick fade on the audio clock, which only
      // runs once that clock does — so a paused engine is started again first.
      if (engineRef.current.ctx.state === 'suspended') engineRef.current.ctx.resume()
      engineRef.current.stopAll()
    }
    passesRef.current = []
    setActiveChordIndex(null)
    setPlaying(false)
    setPaused(false)
  }

  // The MIDI is the loop pass: the progression itself, without the tonic
  // reference that is only there to set up the question.
  function downloadMidi() {
    if (!question) return
    const chordInstrument =
      CHORD_INSTRUMENTS.find((item) => item.id === question.instrumentId) ?? CHORD_INSTRUMENTS[0]
    const bytes = arrangementToMidi({
      arrangement: question.loopArrangement,
      tempo: question.tempo,
      name: `${question.progression.name} in ${question.key.label}`,
      chordProgram: chordInstrument.gm,
      bassProgram: BASS_INSTRUMENTS[question.bassId].gm,
    })
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
    const link = document.createElement('a')
    link.href = url
    link.download = midiFilename(question.progression.name, question.key.label)
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoked on a timer rather than straight away, which some browsers treat
    // as cancelling the download they have only just been handed.
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function startQuestion() {
    if (pool.length === 0) return

    // Never ask the same progression twice in a row unless it is the only one left.
    const candidates = pool.filter((item) => !question || item.id !== question.progression.id)
    const progression = pickRandom(candidates.length > 0 ? candidates : pool)
    // Spelling and the printed label both depend on whether the progression is
    // major or minor, so the key is resolved against the progression's tonic.
    const key = keyForMode(useRandomKey ? pickRandom(KEYS) : KEYS[0], progression.tonic)
    const chordInstrument = varySounds
      ? pickRandom(CHORD_INSTRUMENTS)
      : CHORD_INSTRUMENTS.find((item) => item.id === instrumentId) ?? CHORD_INSTRUMENTS[0]
    // Each chord instrument names the basses that suit it rather than one, so
    // the same Rhodes can come back under a different rhythm section.
    const bassId = varySounds ? pickRandom(chordInstrument.bass) : chordInstrument.bass[0]
    const pattern = varySounds ? pickRandom(PATTERNS).id : 'block'
    const questionTempo = varySounds ? driftTempo(tempo) : Number(tempo)
    const beatsPerChord = beatsPerChordFor(progression)
    // With every chord hidden the tonic is the only way into the key, so hard
    // mode sounds it whether or not the toggle asked for it.
    const withReference = playReference || hardMode
    // Extensions are re-rolled per question, so the same changes arrive in a
    // different colour each time. Everything downstream — chart, audio and
    // grading — reads this array rather than the progression's written chords.
    const chords = shadeProgression(progression)

    const next = {
      progression,
      chords,
      key,
      blanks: hardMode
        ? chords.map((_, index) => index)
        : [randomInt(0, chords.length - 1)],
      instrumentId: chordInstrument.id,
      bassId,
      pattern,
      tempo: questionTempo,
      beatsPerChord,
      playReference: withReference,
      drums,
      arrangement: buildArrangement({
        chords,
        key,
        tonic: progression.tonic,
        tempo: questionTempo,
        beatsPerChord,
        pattern,
        playReference: withReference,
        drums,
      }),
      loopArrangement: buildArrangement({
        chords,
        key,
        tonic: progression.tonic,
        tempo: questionTempo,
        beatsPerChord,
        pattern,
        playReference: false,
        drums,
      }),
    }

    currentQuestionRef.current = next

    setQuestion(next)
    setAnswers({})
    setPlayed({ held: [], heard: null, slot: null })
    setSelected(next.blanks[0])
    setResults(null)
    setRevealed(false)
    await playQuestion(next)
    if (answerInputRef.current) answerInputRef.current.focus()
  }

  function submitAnswer() {
    if (!question || results || revealed || !hasDraft) return

    // Each blank is graded on its own rather than as one line of chords, so a
    // space in "E maj7" stays one answer and a slot left empty costs only
    // itself instead of pushing every chord after it out of step.
    const graded = question.blanks.map((index) => ({
      index,
      ...gradeAnswer(answers[index] ?? '', [question.chords[index]], question.key).results[0],
    }))
    stopPlayback()
    setResults(graded)

    const points = graded.reduce((sum, item) => sum + item.points, 0)
    const exact = graded.filter((item) => item.exact).length
    // A streak is chords running that named what the chord does; a revealed
    // answer breaks it just as a wrong one does. A hard mode question can
    // carry it several chords further, or break it partway through.
    let nextStreak = streak
    let best = bestStreak
    graded.forEach((item) => {
      nextStreak = item.status === 'correct' ? nextStreak + 1 : 0
      best = Math.max(best, nextStreak)
    })
    setStreak(nextStreak)
    setBestStreak(best)
    setSessionPoints((previous) => previous + points)
    setAnswered((previous) => previous + graded.length)
    if (graded.every((item) => item.status === 'correct')) {
      setCelebration((previous) => previous + 1)
    }
    if (exact > 0) {
      setBonuses((previous) => previous + exact)
    }
    // Checking with the mouse moves focus to the button, which is then
    // disabled — putting it back keeps Enter working for the next question.
    if (answerInputRef.current) answerInputRef.current.focus()
    setHistory((previous) => [
      ...graded.map((item, order) => {
        const chord = question.chords[item.index]
        return {
          id: Date.now() + order,
          name: question.progression.name,
          chord: showKey ? chordSymbol(chord, question.key) : romanLabel(chord),
          keyLabel: question.key.label,
          points: item.points,
        }
      }),
      ...previous,
    ].slice(0, 10))
  }

  // What Enter does, and what the sustain pedal does: walk on to the next chord
  // still waiting for a name, check the answer once none are, and once the
  // answer is up, go again.
  function advanceOrSubmit() {
    if (showAnswerKey) {
      startQuestion()
      return
    }
    const next = question
      ? question.blanks.find((index) => index !== selected && (answers[index] ?? '').trim() === '')
      : undefined
    if (next === undefined) submitAnswer()
    else setSelected(next)
  }

  function toggleLevel(levelId) {
    setLevels((previous) => {
      const next = { ...previous, [levelId]: !previous[levelId] }
      // Leaving every level off would leave nothing to ask.
      return Object.values(next).some(Boolean) ? next : previous
    })
  }

  // Both spellings are always graded; this only says which one the chart is
  // showing, so the example matches what is in front of you.
  const answerHint = showRoman && showKey ? 'V7 or G7' : (showRoman ? 'V7' : 'G7')
  const activeInstrument = question
    ? CHORD_INSTRUMENTS.find((item) => item.id === question.instrumentId)
    : null
  const activePattern = question ? PATTERNS.find((item) => item.id === question.pattern) : null
  const showAnswerKey = revealed || Boolean(results)
  // More than one blank is what makes a question hard mode, whatever the toggle
  // has been moved to since it was dealt.
  const manyBlanks = Boolean(question) && question.blanks.length > 1
  const hasDraft = Boolean(question)
    && question.blanks.some((index) => (answers[index] ?? '').trim() !== '')

  // The loop is scheduled from a timer, so it reads the live settings off a ref.
  useEffect(() => {
    loopRef.current = { enabled: loopPlayback, answered: showAnswerKey }
  }, [loopPlayback, showAnswerKey])

  // No dependency list: everything the keyboard needs to know changes on
  // ordinary renders, and it needs the latest of all of it.
  useEffect(() => {
    liveRef.current = {
      key: question ? question.key : null,
      slot: selected,
      // Once the answer is up there is nothing to fill in, so a chord played
      // then is just someone playing along.
      locked: showAnswerKey || !question,
      advance: advanceOrSubmit,
    }
  })

  return (
    // Padding is set here rather than in the stylesheet because the shared page
    // style is inline, and a class cannot outrank it.
    <div
      style={{ ...pageShellStyle, maxWidth: '1340px', padding: '12px clamp(14px, 2.5vw, 30px) 16px' }}
      className="ear-shell"
    >
      <SiteNav showHomeLink />
      <ConfettiBurst trigger={celebration} />

      <section className="surface-panel ear-panel">
        <div className="ear-topbar">
          <h1 className="ear-title">Progression Ear Trainer</h1>
          <div className="ear-level-chips">
            {PROGRESSION_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                className={`ear-level-chip${levels[level.id] ? ' is-active' : ''}`}
                onClick={() => toggleLevel(level.id)}
                aria-pressed={levels[level.id]}
              >
                {level.label}
              </button>
            ))}
            <span className="ear-pool-count">{pool.length} in the pool</span>
          </div>
        </div>

        <div className="ear-layout">
          <div className="ear-main">
            <div className="ear-toolbar">
              <div className="control-card">
                <label className="control-label" htmlFor="ear-tempo">Tempo</label>
                <div className="range-value">{tempo} BPM</div>
                <input
                  id="ear-tempo"
                  className="range-input"
                  type="range"
                  min="50"
                  max="140"
                  step="1"
                  value={tempo}
                  onChange={(event) => setTempo(Number(event.target.value))}
                />
              </div>

              <div className="control-card">
                <label className="control-label" htmlFor="ear-instrument">Instrument</label>
                <select
                  id="ear-instrument"
                  className="control-input ear-select"
                  value={varySounds ? 'random' : instrumentId}
                  disabled={varySounds}
                  onChange={(event) => setInstrumentId(event.target.value)}
                >
                  {varySounds ? <option value="random">Random each question</option> : null}
                  {CHORD_INSTRUMENTS.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className="control-card ear-options-card">
                {[
                  ['New sound each question', varySounds, setVarySounds],
                  ['Random key', useRandomKey, setUseRandomKey],
                  // Hard mode needs the tonic, so it holds this on and says so
                  // by showing it ticked rather than by quietly overriding it.
                  ['Play tonic first', playReference || hardMode, setPlayReference, hardMode],
                  ['Loop until answered', loopPlayback, setLoopPlayback],
                  ['Drums', drums, setDrums],
                  ['Show roman numerals', showRoman, (next) => {
                    setShowRoman(next)
                    if (!next) setShowKey(true)
                  }],
                  ['Show chord names', showKey, (next) => {
                    setShowKey(next)
                    if (!next) setShowRoman(true)
                  }],
                  ['Hard mode — hide every chord', hardMode, setHardMode],
                ].map(([label, checked, set, locked]) => (
                  <label
                    className={`toggle-control${locked ? ' is-locked' : ''}`}
                    key={label}
                    title={locked ? 'Hard mode plays the key centre every question' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(locked)}
                      onChange={(event) => set(event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="ear-transport">
              <button className="primary-button" type="button" onClick={startQuestion} disabled={pool.length === 0}>
                {question ? 'Next' : 'Start'}
              </button>
              <button className="secondary-button" type="button" onClick={() => playQuestion(question)} disabled={!question}>
                Replay
              </button>
              <button className="secondary-button" type="button" onClick={() => playQuestion(question, 0.72)} disabled={!question}>
                Slower
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={togglePause}
                disabled={!playing}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  stopPlayback()
                  setRevealed(true)
                  setStreak(0)
                }}
                disabled={!question || showAnswerKey}
              >
                Reveal
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={downloadMidi}
                disabled={!question || !showAnswerKey}
                title={showAnswerKey ? 'Save this progression as a MIDI file' : 'Answer the question first'}
              >
                MIDI
              </button>
            </div>

            <div className="surface-card ear-stage">
              {!question ? (
                <p className="ear-stage-empty">
                  Press Start. Every question picks a fresh progression, key, instrument and feel.
                </p>
              ) : (
                <>
                  <div className="ear-question-meta">
                    <span>{question.key.label}</span>
                    <span>{activeInstrument?.name}</span>
                    <span>{BASS_INSTRUMENTS[question.bassId]?.name}</span>
                    <span>{activePattern?.name}</span>
                    <span>{question.tempo} BPM</span>
                  </div>

                  <div className={`ear-answer-grid${showRoman ? '' : ' is-symbol-lead'}`}>
                    {question.arrangement.reference ? (
                      <ChordCard
                        className={`ear-chord-result is-reference${activeChordIndex === -1 ? ' is-playing' : ''}`}
                        onPlay={() => playChordAlone(-1)}
                      >
                        {showRoman ? (
                          <span className="ear-chord-roman">
                            {romanLabel(question.arrangement.reference)}
                          </span>
                        ) : null}
                        {showKey ? (
                          <span className="ear-chord-symbol">
                            {chordSymbol(question.arrangement.reference, question.key)}
                          </span>
                        ) : null}
                        <span className="ear-chord-note">Key centre</span>
                      </ChordCard>
                    ) : null}

                    {question.chords.map((chord, index) => {
                      const isBlank = question.blanks.includes(index)
                      const isSounding = activeChordIndex === index ? ' is-playing' : ''
                      const roman = romanLabel(chord)
                      const graded = results ? results.find((item) => item.index === index) : null

                      if (!isBlank) {
                        return (
                          <ChordCard
                            className={`ear-chord-result is-given${isSounding}`}
                            onPlay={() => playChordAlone(index)}
                            key={`${roman}-${index}`}
                          >
                            {showRoman ? <span className="ear-chord-roman">{roman}</span> : null}
                            {showKey ? (
                              <span className="ear-chord-symbol">{chordSymbol(chord, question.key)}</span>
                            ) : null}
                            {chord.secondary && showRoman ? (
                              <span className="ear-chord-secondary">V/{chord.secondary}</span>
                            ) : null}
                          </ChordCard>
                        )
                      }

                      if (!showAnswerKey) {
                        // The blank still will not play — hearing it alone
                        // would be a closer listen than the question is asking
                        // for — but it does say which chord the answer box is
                        // pointing at, which is the only way round a chart
                        // where every chip is a blank.
                        const draft = (answers[index] ?? '').trim()
                        const isSelected = manyBlanks && selected === index
                        return (
                          <button
                            className={`ear-chord-result is-blank is-clickable${isSounding}${isSelected ? ' is-selected' : ''}`}
                            type="button"
                            key={`blank-${index}`}
                            onClick={() => {
                              setSelected(index)
                              if (answerInputRef.current) answerInputRef.current.focus()
                            }}
                            title="Answer this chord"
                          >
                            <span className={`ear-chord-roman${draft ? ' is-draft' : ''}`}>
                              {draft || '?'}
                            </span>
                            <span className="ear-chord-note">
                              {manyBlanks ? `Chord ${index + 1}` : 'Name this chord'}
                            </span>
                          </button>
                        )
                      }

                      return (
                        <ChordCard
                          className={`ear-chord-result is-${graded ? graded.status : 'revealed'}${isSounding}`}
                          onPlay={() => playChordAlone(index)}
                          key={`answer-${index}`}
                        >
                          {showRoman ? <span className="ear-chord-roman">{roman}</span> : null}
                          {showKey ? (
                            <span className="ear-chord-symbol">{chordSymbol(chord, question.key)}</span>
                          ) : null}
                          {chord.secondary && showRoman ? (
                            <span className="ear-chord-secondary">V/{chord.secondary}</span>
                          ) : null}
                          <span className="ear-chord-note">
                            {graded ? describeChordResult(graded) : 'Revealed'}
                          </span>
                          {graded && graded.points > 0 ? (
                            <span className={`ear-chord-gain is-p${graded.points}`} aria-hidden="true">
                              {`+${graded.points}`}
                            </span>
                          ) : null}
                        </ChordCard>
                      )
                    })}
                  </div>

                  <p className="ear-stage-caption">
                    {showAnswerKey ? (
                      <>
                        <strong>{question.progression.name}</strong>
                        {question.progression.note ? ` — ${question.progression.note}` : ''}
                      </>
                    ) : (
                      manyBlanks
                        ? `All ${question.chords.length} chords hidden — the key centre is the only thing given. Pick a chip and name it.${loopPlayback ? ' Looping until you check.' : ''}`
                        : `Chord ${question.blanks[0] + 1} of ${question.chords.length} is missing.${loopPlayback ? ' Looping until you answer.' : ''}`
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="surface-card ear-answer-card">
              <div className="ear-answer-row">
                <input
                  id="ear-answer"
                  ref={answerInputRef}
                  className="control-input ear-answer-input"
                  type="text"
                  placeholder={
                    manyBlanks
                      ? `Chord ${selected + 1} of ${question.chords.length} — ${answerHint}`
                      : `Name the missing chord — ${answerHint}`
                  }
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  value={answers[selected] ?? ''}
                  onChange={(event) => {
                    const { value } = event.target
                    setAnswers((previous) => ({ ...previous, [selected]: value }))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') advanceOrSubmit()
                  }}
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={submitAnswer}
                  disabled={!question || showAnswerKey || !hasDraft}
                >
                  Check
                </button>
              </div>
              <p className="ear-hint">
                {showAnswerKey ? (
                  <>Press <code>Enter</code> for the next progression.</>
                ) : (
                  <>
                    <code>ii7</code> <code>V13sus</code> <code>bVII7</code> <code>Dm7</code> <code>V7/ii</code> — root
                    scores 1, function 2, exact extension 3.
                  </>
                )}
              </p>

              <div className="ear-midi-row">
                {midi.status === 'unsupported' ? (
                  <span className="ear-midi-note">
                    Playing the answer in needs Chrome or Edge — Safari has no Web MIDI.
                  </span>
                ) : midi.status === 'ready' ? (
                  <>
                    <span className="ear-midi-badge">MIDI in</span>
                    <span className="ear-midi-note">
                      {midi.devices.length > 0
                        ? midi.devices.join(', ')
                        : 'No keyboard found — plug one in and it will appear.'}
                    </span>
                    {played.held.length > 0 ? (
                      <span className="ear-midi-held">
                        {played.held
                          .map((note) => midiNoteLabel(note, question ? question.key.accidental : 'flat'))
                          .join(' ')}
                      </span>
                    ) : null}
                    {/* A voicing with its root left out, or a note missing, is
                        genuinely more than one chord. Rather than pick for you,
                        the readings it could be are offered to take instead. */}
                    {!showAnswerKey && played.slot === selected
                      && played.heard && played.heard.options.length > 1 ? (
                      <span className="ear-midi-options">
                        <span className="ear-midi-note">or</span>
                        {played.heard.options.slice(1).map((option) => (
                          <button
                            key={option.symbol}
                            className="ear-midi-option"
                            type="button"
                            onClick={() => {
                              setAnswers((previous) => ({ ...previous, [selected]: option.symbol }))
                              if (answerInputRef.current) answerInputRef.current.focus()
                            }}
                          >
                            {option.symbol}
                          </button>
                        ))}
                      </span>
                    ) : null}
                    <span className="ear-midi-note">Sustain pedal moves on.</span>
                  </>
                ) : (
                  <>
                    <button
                      className="ear-midi-connect"
                      type="button"
                      onClick={connectMidiKeyboard}
                      disabled={midi.status === 'connecting'}
                    >
                      {midi.status === 'connecting' ? 'Asking…' : 'Play the answer in'}
                    </button>
                    <span className="ear-midi-note">
                      {midi.status === 'denied'
                        ? `No keyboard: ${midi.error}`
                        : 'Connect a MIDI keyboard and play the chord instead of spelling it.'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <aside className="ear-sidebar">
            <PracticeTimer onComplete={stopPlayback} />

            <div className="surface-card ear-score-card">
              <span className="control-label">Session</span>
              <div className="ear-score-big">
                {sessionPoints}
                {answered > 0 ? (
                  <span className="ear-score-percent">
                    {`(${Math.round((sessionPoints / (answered * POINTS_PER_CHORD)) * 100)}%)`}
                  </span>
                ) : null}
              </div>
              <span className="ear-score-unit">points</span>
              <div className="ear-stat-grid">
                <div className={`ear-stat${streak >= 3 ? ' is-hot' : ''}`}>
                  <strong>{streak}</strong>
                  <span>streak</span>
                </div>
                <div className="ear-stat">
                  <strong>{bestStreak}</strong>
                  <span>best</span>
                </div>
                <div className="ear-stat">
                  <strong>{answered}</strong>
                  <span>answered</span>
                </div>
                <div className="ear-stat">
                  <strong>{bonuses}</strong>
                  <span>extensions</span>
                </div>
              </div>
            </div>

            <div className="surface-card ear-history-card">
              <span className="control-label">Recent</span>
              {history.length === 0 ? (
                <p className="ear-stage-empty">Nothing yet.</p>
              ) : (
                <div className="ear-history-list">
                  {history.map((item) => (
                    <div className="ear-history-row" key={item.id}>
                      <span className="ear-history-chord">{item.chord}</span>
                      <span className="ear-history-name">{item.name}</span>
                      <span className={`ear-history-points is-p${item.points}`}>{item.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tempo-guessr" element={<TempoGuessrPage />} />
        <Route path="/metronome" element={<MetronomePage />} />
        <Route path="/sticking-generator" element={<StickingGeneratorPage />} />
        <Route path="/ear-training" element={<EarTrainerPage />} />
        <Route path="/beats" element={<BeatsPage />} />
        <Route path="/video" element={<VideoPage />} />
        <Route path="/audio" element={<AudioPage />} />
        <Route path="/photography" element={<PhotographyPage />} />
      </Routes>
      <TwitchLiveCard />
    </BrowserRouter>
  )
}

export default App
