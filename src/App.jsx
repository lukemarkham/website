import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

const YOUTUBE_PLAYLIST_ID = 'PLb3uq0jpJ8q-KEpFbTwJdOXcoNcaZoneA'
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

const pageShellStyle = {
  width: '100%',
  maxWidth: '1180px',
  margin: '0 auto',
  padding: 'clamp(24px, 4vw, 56px)',
  boxSizing: 'border-box',
  textAlign: 'center',
}

const sectionStyle = {
  marginBottom: '28px',
  padding: 'clamp(26px, 3vw, 38px)',
  border: '1px solid var(--surface-border)',
  borderRadius: '30px',
  background: 'var(--surface)',
  boxShadow: 'var(--surface-shadow)',
  backdropFilter: 'blur(14px)',
}

const titleStyle = {
  fontSize: 'clamp(38px, 7vw, 72px)',
  lineHeight: 0.96,
  letterSpacing: '-0.045em',
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
  fontSize: 'clamp(24px, 4vw, 34px)',
  letterSpacing: '-0.035em',
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
  borderRadius: '24px',
  border: '1px solid var(--surface-border)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 16px 40px rgba(3, 6, 10, 0.18)',
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
  padding: '9px 16px',
  borderRadius: '999px',
  border: '1px solid rgba(205, 168, 116, 0.28)',
  background: 'rgba(205, 168, 116, 0.08)',
  color: 'var(--accent-strong)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
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
        <a className="nav-link" href="/#contact">Contact</a>
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

function HomePage() {
  return (
    <div style={pageShellStyle}>
      <SiteNav />

      <section className="hero-shell surface-panel" style={{ ...sectionStyle, padding: 'clamp(32px, 5vw, 60px)', marginBottom: '28px' }}>
        <div style={metaStyle}>Freelance Musician • Drummer • Producer</div>
        <h1 style={titleStyle}>Modern musician website, beat store, and practice tools in one place.</h1>
        <p style={introStyle}>
          Built as a clear home base for sessions, production work, release-ready content, and tools like Tempo Guessr, with a sharper layout that feels more like a professional portfolio than a starter site.
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
          This can become your bio section: who you are, what you play, what kind of records or artists you like working with, and why someone should trust you with a session, production job, or live date.
        </p>
      </section>

      <section id="services" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Services</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Session Drumming</h3>
            <p style={mutedTextStyle}>Remote or in-person drum tracking with a clean process, musical instincts, and player-first communication.</p>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Production & Editing</h3>
            <p style={mutedTextStyle}>Arrangement help, editing, programming, and practical musical problem-solving for artists and producers.</p>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Live Performance</h3>
            <p style={mutedTextStyle}>Touring, live dates, and dependable musical support for artists who need someone prepared and adaptable.</p>
          </div>
        </div>
      </section>

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
              A dedicated place for live clips, studio sessions, playthroughs, reels, and visual work that supports your brand.
            </p>
            <Link className="text-link" to="/video">Open Video Page</Link>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Audio</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Highlight productions, mixes, records you played on, demos, or curated listening selections without forcing everything into one page.
            </p>
            <Link className="text-link" to="/audio">Open Audio Page</Link>
          </div>
        </div>
      </section>

      <section id="store" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Beat Store</h2>
        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h3 className="card-title">Beat Store</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Browse and purchase beats directly from your BeatStars store without leaving the site.
            </p>
            <Link className="text-link" to="/beats">Go to Beat Store</Link>
          </div>
        </div>
      </section>

      <section id="contact" className="surface-panel" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Contact</h2>
        <p style={{ ...mutedTextStyle, maxWidth: '680px', margin: '0 auto 20px' }}>
          Reach out for sessions, gigs, collaborations, production work, or custom music inquiries.
        </p>
        <a className="text-link" href="mailto:you@example.com">Email Me</a>
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

function buildYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?rel=0`
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
        <p style={introStyle}>Stream and purchase beats directly below.</p>

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
          This page now pulls from your YouTube playlist automatically when an API key is configured, so you can update the playlist once and let the site reflect it.
        </p>

        {status === 'ready' ? (
          <div className="video-portfolio">
            <div className="video-portfolio-header">
              <h2 style={{ ...sectionHeadingStyle, marginBottom: '6px' }}>Playlist Grid</h2>
              <p style={mutedTextStyle}>
                {videos.length} videos pulled from YouTube. Add a new video to the playlist and it appears here automatically.
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
          <div className="video-fallback-grid">
            <div className="surface-card" style={cardStyle}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Playlist Embed</h2>
              <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
                {status === 'loading'
                  ? 'Loading the playlist from YouTube.'
                  : 'The page is using the direct YouTube playlist embed because no API key is configured or the playlist request failed.'}
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

            <div className="surface-card" style={cardStyle}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Auto-Populate Setup</h2>
              <p style={{ ...mutedTextStyle, marginBottom: '14px' }}>
                To render each playlist video as its own card, add a referrer-restricted YouTube Data API key to your Vite env as <code>VITE_YOUTUBE_API_KEY</code>.
              </p>
              <p className="video-note">Playlist ID: {YOUTUBE_PLAYLIST_ID}</p>
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
          Use this page for productions, session credits, featured tracks, beat snippets, or curated playlists that show your sound clearly.
        </p>

        <div style={gridStyle}>
          <div className="surface-card" style={cardStyle}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Featured Tracks</h2>
            <p style={mutedTextStyle}>Lead with the strongest examples and keep the section selective. Strong curation reads more professionally than volume.</p>
          </div>
          <div className="surface-card" style={cardStyle}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: '10px' }}>Credits & Collaborations</h2>
            <p style={mutedTextStyle}>Add short notes about the artist, your role, and the type of work so a visitor immediately understands the context.</p>
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
      </Routes>
    </BrowserRouter>
  )
}

export default App
