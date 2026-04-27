import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { photographyShots } from './data/photography'
import { reviews } from './data/reviews'

const YOUTUBE_PLAYLIST_ID = 'PLb3uq0jpJ8q-KEpFbTwJdOXcoNcaZoneA'
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const SPOTIFY_PLAYLIST_ID = '63XW9ECd3X1hKJIMR0T7fr'
const SOUNDBETTER_MAP_URL = 'https://soundbetter.com/profiles/45761-luke-markham/map'
const REVERB_SHOP_SLUG = import.meta.env.VITE_REVERB_SHOP_SLUG || 'lukes-gear-emporium-220'
const REVERB_SHOP_URL = import.meta.env.VITE_REVERB_SHOP_URL || `https://reverb.com/shop/${REVERB_SHOP_SLUG}`
const REVERB_EMBED_SCRIPT_URL = 'https://d1g5417jjjo7sf.cloudfront.net/assets/embed/reverb.js'
const JQUERY_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js'

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
  color: 'var(--accent-neon)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: 0,
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
            <Link className="dropdown-link" to="/books">
              Book Reviews
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
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Book Reviews</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Notes on books, ideas worth keeping, and short reading reflections.
            </p>
            <Link className="text-link" to="/books">Open Reviews</Link>
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
          A small gallery of favorite shots from outside the music work.
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

function BooksPage() {
  return (
    <div style={pageShellStyle}>
      <SiteNav showHomeLink />

      <section className="surface-panel" style={{ ...sectionStyle, padding: 'clamp(30px, 4vw, 44px)' }}>
        <div style={metaStyle}>Extras</div>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Book Reviews</h1>
        <p style={introStyle}>
          Short reviews, reading notes, and ideas worth returning to.
        </p>
        <div className="empty-state surface-card">
          <h2 style={{ ...sectionHeadingStyle, marginBottom: '8px' }}>Reviews Coming Soon</h2>
          <p style={mutedTextStyle}>
            Reading notes and short reviews will live here.
          </p>
        </div>
      </section>
    </div>
  )
}

function randomInt(min, max) {
  const low = Math.ceil(min)
  const high = Math.floor(max)
  return Math.floor(Math.random() * (high - low + 1)) + low
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [roundActive, setRoundActive] = useState(false)
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tempo-guessr" element={<TempoGuessrPage />} />
        <Route path="/beats" element={<BeatsPage />} />
        <Route path="/video" element={<VideoPage />} />
        <Route path="/audio" element={<AudioPage />} />
        <Route path="/photography" element={<PhotographyPage />} />
        <Route path="/books" element={<BooksPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
