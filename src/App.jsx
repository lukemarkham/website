import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

function HomePage() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div><strong>Luke</strong></div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <a href="#about">About</a>
          <a href="#services">Services</a>
          <a href="#tools">Tools</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <section style={{ marginBottom: '60px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '20px' }}>
          Freelance Musician, Drummer, Producer
        </h1>
        <p style={{ fontSize: '18px', marginBottom: '20px' }}>
          A clean home base for your music work, services, and tools.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="#services">
            <button>View Services</button>
          </a>
          <Link to="/tempo-guessr">
            <button>Open Tempo Guessr</button>
          </Link>
        </div>
      </section>

      <section id="about" style={{ marginBottom: '60px' }}>
        <h2>About</h2>
        <p>
          This will eventually be your bio. You can describe your background,
          experience, and the type of work you want to attract.
        </p>
      </section>

      <section id="services" style={{ marginBottom: '60px' }}>
        <h2>Services</h2>
        <ul>
          <li><strong>Session Drumming:</strong> Remote or in-person drum tracking</li>
          <li><strong>Production & Editing:</strong> Arrangement, editing, programming</li>
          <li><strong>Live Performance:</strong> Touring and live gigs</li>
        </ul>
      </section>

      <section id="tools" style={{ marginBottom: '60px' }}>
        <h2>Tools</h2>
        <div style={{ border: '1px solid #ccc', padding: '20px' }}>
          <h3>Tempo Guessr</h3>
          <p>
            A browser-based tool that plays a random tempo and lets you guess the BPM.
          </p>
          <Link to="/tempo-guessr">Go to Tempo Guessr</Link>
        </div>
      </section>

      <section id="contact" style={{ marginBottom: '60px' }}>
        <h2>Contact</h2>
        <p>Reach out for sessions, gigs, or collaborations.</p>
        <a href="mailto:you@example.com">Email Me</a>
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
    <div style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <strong>Tempo Guessr</strong>
        <Link to="/">← Back to Home</Link>
      </nav>

      <h1 style={{ fontSize: '42px', marginBottom: '16px' }}>Tempo Guessr</h1>
      <p style={{ fontSize: '18px', marginBottom: '30px' }}>
        Hear a random metronome tempo, then guess the BPM.
      </p>

      <div style={{ display: 'grid', gap: '24px', marginBottom: '30px' }}>
        <div>
          <label>Minimum BPM</label>
          <br />
          <input type="number" value={minBpm} onChange={(e) => setMinBpm(e.target.value)} />
        </div>

        <div>
          <label>Maximum BPM</label>
          <br />
          <input type="number" value={maxBpm} onChange={(e) => setMaxBpm(e.target.value)} />
        </div>

        <div>
          <label>Bars of clicks</label>
          <br />
          <input type="number" min="1" max="8" value={bars} onChange={(e) => setBars(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button onClick={startRound} disabled={isPlaying}>
          {isPlaying ? 'Playing...' : 'Start Round'}
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label>Your BPM guess</label>
        <br />
        <input
          type="number"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              submitGuess()
            }
          }}
        />
        <button onClick={submitGuess} disabled={!roundActive || isPlaying || guess === ''} style={{ marginLeft: '10px' }}>
          Submit Guess
        </button>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '30px' }}>
        {!result ? (
          <p>
            {roundActive
              ? isPlaying
                ? 'Listen to the clicks, then enter your guess when playback ends.'
                : 'Playback finished. Enter your BPM guess.'
              : 'Press Start Round to begin.'}
          </p>
        ) : (
          <div>
            <p><strong>Target tempo:</strong> {result.target} BPM</p>
            <p><strong>Your guess:</strong> {result.guess} BPM</p>
            <p><strong>Error:</strong> {result.diff} BPM</p>
            <p><strong>Score:</strong> {result.score}/100</p>
          </div>
        )}
      </div>

      <div>
        <h2>Session Stats</h2>
        <p><strong>Rounds played:</strong> {history.length}</p>
        <p><strong>Average error:</strong> {averageError === null ? '—' : `${averageError} BPM`}</p>

        <div style={{ marginTop: '20px' }}>
          {history.length === 0 ? (
            <p>No rounds yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} style={{ borderTop: '1px solid #ddd', padding: '12px 0' }}>
                <div><strong>Guess:</strong> {item.guess} BPM</div>
                <div><strong>Target:</strong> {item.target} BPM</div>
                <div><strong>Off by:</strong> {item.diff} BPM</div>
                <div><strong>Score:</strong> {item.score}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tempo-guessr" element={<TempoGuessrPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App