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
  qualityLabel,
  romanLabel,
  shadeProgression,
} from './lib/harmony'
import {
  BASS_INSTRUMENTS,
  CHORD_INSTRUMENTS,
  PATTERNS,
  buildArrangement,
  createEngine,
  playArrangement,
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
              Generate random hand and foot sticking patterns for four-limb coordination practice.
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

function oppositeLimb(limb) {
  return limb === 'R' ? 'L' : 'R'
}

// A limb may never be used three times in a row, so once the previous two
// strokes match, the next one has to switch. Hands and feet are separate
// voices, so each is generated under the rule independently.
function getRandomLimbSequence(length) {
  const sequence = []

  for (let index = 0; index < length; index += 1) {
    const previous = sequence[index - 1]
    const mustSwitch = previous !== undefined && previous === sequence[index - 2]

    sequence.push(mustSwitch ? oppositeLimb(previous) : Math.random() > 0.5 ? 'R' : 'L')
  }

  return sequence
}

function getRandomSticking(length) {
  return {
    hands: getRandomLimbSequence(length),
    feet: getRandomLimbSequence(length),
  }
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

  function formatSessionTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
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

function StickingGeneratorPage() {
  const [stepCount, setStepCount] = useState(16)
  const [sticking, setSticking] = useState(() => getRandomSticking(16))

  const groupedSteps = useMemo(() => {
    const steps = sticking.hands.map((hand, index) => ({
      id: `${index}-${hand}-${sticking.feet[index]}`,
      count: index + 1,
      hand,
      foot: sticking.feet[index],
      isDownbeat: index % 4 === 0,
    }))

    const groups = []
    for (let index = 0; index < steps.length; index += 4) {
      groups.push(steps.slice(index, index + 4))
    }

    return groups
  }, [sticking])

  function generateSticking(nextLength = stepCount) {
    setSticking(getRandomSticking(Number(nextLength)))
  }

  function updateStepCount(event) {
    const nextStepCount = Number(event.target.value)
    setStepCount(nextStepCount)
    generateSticking(nextStepCount)
  }

  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <div style={metaStyle}>Practice Tools</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Sticking Generator</h1>
        <p style={introStyle}>
          Generate a random hand sticking and foot sticking for four-limb coordination practice.
        </p>

        <div className="sticking-toolbar">
          <div className="control-card">
            <label className="control-label" htmlFor="sticking-step-count">Pattern Length</label>
            <div className="range-value">{stepCount} notes</div>
            <input
              id="sticking-step-count"
              className="range-input"
              type="range"
              min="4"
              max="32"
              step="4"
              value={stepCount}
              onChange={updateStepCount}
            />
          </div>

          <button className="primary-button" type="button" onClick={() => generateSticking()}>
            Generate Sticking
          </button>
        </div>

        <div className="sticking-board surface-card">
          <div className="sticking-labels" aria-hidden="true">
            <span>Hands</span>
            <span>Feet</span>
          </div>

          <div className="sticking-groups">
            {groupedSteps.map((group, groupIndex) => (
              <div className="sticking-group" key={`group-${groupIndex}`}>
                {group.map((step) => (
                  <div className={`sticking-step${step.isDownbeat ? ' is-downbeat' : ''}`} key={step.id}>
                    <span className="sticking-count">{step.count}</span>
                    <span className="sticking-cell sticking-hand">{step.hand}</span>
                    <span className="sticking-cell sticking-foot">{step.foot}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="sticking-readout">
          <div className="surface-card" style={cardStyle}>
            <div className="stat-label">Hands</div>
            <div className="sticking-line">{sticking.hands.join(' ')}</div>
          </div>
          <div className="surface-card" style={cardStyle}>
            <div className="stat-label">Feet</div>
            <div className="sticking-line">{sticking.feet.join(' ')}</div>
          </div>
        </div>
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
    }
  }, [])

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
                    if (event.key !== 'Enter') return
                    // Once the answer is up, the only thing left to do is go
                    // again, so the same key does it.
                    if (showAnswerKey) {
                      startQuestion()
                      return
                    }
                    // Otherwise Enter walks on to the next chord still waiting
                    // for a name, and only checks once none are.
                    const next = question
                      ? question.blanks.find(
                        (index) => index !== selected && (answers[index] ?? '').trim() === '',
                      )
                      : undefined
                    if (next === undefined) submitAnswer()
                    else setSelected(next)
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
            </div>
          </div>

          <aside className="ear-sidebar">
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
