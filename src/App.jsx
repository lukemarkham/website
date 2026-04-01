import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

const pageShellStyle = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: 'clamp(24px, 4vw, 48px)',
  boxSizing: 'border-box',
  textAlign: 'center',
}

const sectionStyle = {
  marginBottom: '32px',
  padding: 'clamp(24px, 3vw, 36px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '28px',
  background: 'rgba(255, 255, 255, 0.04)',
  boxShadow: '0 18px 60px rgba(0, 0, 0, 0.22)',
  backdropFilter: 'blur(8px)',
}

const titleStyle = {
  fontSize: 'clamp(38px, 7vw, 72px)',
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
  margin: '0 0 18px',
}

const introStyle = {
  fontSize: 'clamp(16px, 2.3vw, 20px)',
  lineHeight: 1.7,
  margin: '0 auto 24px',
  maxWidth: '760px',
  color: 'rgba(245, 239, 230, 0.82)',
}

const sectionHeadingStyle = {
  fontSize: 'clamp(24px, 4vw, 34px)',
  letterSpacing: '-0.03em',
  margin: '0 0 12px',
}

const mutedTextStyle = {
  color: 'rgba(245, 239, 230, 0.74)',
  lineHeight: 1.7,
  margin: 0,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '20px',
}

const cardStyle = {
  padding: '24px',
  borderRadius: '22px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
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
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(212, 176, 106, 0.35)',
  background: 'rgba(212, 176, 106, 0.08)',
  color: '#d4b06a',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
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
      <nav style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <div className="wordmark">Luke</div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a className="nav-link" href="#about">About</a>
          <a className="nav-link" href="#services">Services</a>
          <a className="nav-link" href="#tools">Tools</a>
          <a className="nav-link" href="#contact">Contact</a>
        </div>
      </nav>

      <section style={{ ...sectionStyle, padding: 'clamp(32px, 5vw, 56px)', marginBottom: '28px' }}>
        <div style={metaStyle}>Freelance Musician • Drummer • Producer</div>
        <h1 style={titleStyle}>Modern musician website, beat store, and practice tools in one place.</h1>
        <p style={introStyle}>
          Built as a clean home base for your music work, your beat catalog, and tools like Tempo Guessr — all with a more premium, artist-first look.
        </p>

        <div style={buttonRowStyle}>
          <a href="#services">
            <PrimaryButton>View Services</PrimaryButton>
          </a>
          <Link to="/tempo-guessr">
            <SecondaryButton>Open Tempo Guessr</SecondaryButton>
          </Link>
          <Link to="/beats">
            <SecondaryButton>View Beat Store</SecondaryButton>
          </Link>
        </div>
      </section>

      <section id="about" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>About</h2>
        <p style={{ ...mutedTextStyle, maxWidth: '760px', margin: '0 auto' }}>
          This can become your bio section: who you are, what you play, what kind of records or artists you like working with, and why someone should trust you with a session, production job, or live date.
        </p>
      </section>

      <section id="services" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Services</h2>
        <div style={gridStyle}>
          <div style={cardStyle}>
            <h3 className="card-title">Session Drumming</h3>
            <p style={mutedTextStyle}>Remote or in-person drum tracking with a clean process, musical instincts, and player-first communication.</p>
          </div>
          <div style={cardStyle}>
            <h3 className="card-title">Production & Editing</h3>
            <p style={mutedTextStyle}>Arrangement help, editing, programming, and practical musical problem-solving for artists and producers.</p>
          </div>
          <div style={cardStyle}>
            <h3 className="card-title">Live Performance</h3>
            <p style={mutedTextStyle}>Touring, live dates, and dependable musical support for artists who need someone prepared and adaptable.</p>
          </div>
        </div>
      </section>

      <section id="tools" style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Tools & Store</h2>
        <div style={gridStyle}>
          <div style={cardStyle}>
            <h3 className="card-title">Tempo Guessr</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              A browser-based tool that plays a random tempo and lets you guess the BPM.
            </p>
            <Link className="text-link" to="/tempo-guessr">Go to Tempo Guessr</Link>
          </div>

          <div style={cardStyle}>
            <h3 className="card-title">Beat Store</h3>
            <p style={{ ...mutedTextStyle, marginBottom: '18px' }}>
              Browse and purchase beats directly from your BeatStars store without leaving the site.
            </p>
            <Link className="text-link" to="/beats">Go to Beat Store</Link>
          </div>
        </div>
      </section>

      <section id="contact" style={sectionStyle}>
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
      <nav style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <div className="wordmark">Tempo Guessr</div>
        <Link className="nav-link" to="/">Back to Home</Link>
      </nav>

      <section style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
        <h1 style={{ ...titleStyle, fontSize: 'clamp(34px, 6vw, 62px)' }}>Tempo Guessr</h1>
        <p style={introStyle}>Hear a random metronome tempo, then guess the BPM.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '18px', marginBottom: '24px' }}>
          <div className="control-card">
            <label className="control-label">Minimum BPM</label>
            <input className="control-input" type="number" value={minBpm} onChange={(e) => setMinBpm(e.target.value)} />
          </div>

          <div className="control-card">
            <label className="control-label">Maximum BPM</label>
            <input className="control-input" type="number" value={maxBpm} onChange={(e) => setMaxBpm(e.target.value)} />
          </div>

          <div className="control-card">
            <label className="control-label">Bars of Clicks</label>
            <input className="control-input" type="number" min="1" max="8" value={bars} onChange={(e) => setBars(e.target.value)} />
          </div>
        </div>

        <div style={{ ...buttonRowStyle, marginBottom: '24px' }}>
          <button className="primary-button" onClick={startRound} disabled={isPlaying}>
            {isPlaying ? 'Playing...' : 'Start Round'}
          </button>
        </div>

        <div style={{ ...cardStyle, marginBottom: '18px' }}>
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

        <div style={{ ...cardStyle, marginBottom: '18px' }}>
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

        <div style={cardStyle}>
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
      <nav style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <div className="wordmark">Beat Store</div>
        <Link className="nav-link" to="/">Back to Home</Link>
      </nav>

      <section style={{ ...sectionStyle, padding: 'clamp(28px, 4vw, 42px)' }}>
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tempo-guessr" element={<TempoGuessrPage />} />
        <Route path="/beats" element={<BeatsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App