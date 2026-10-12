// Style mockups for the redesign, drawn from the Taste folder. Unlisted at
// /style-lab on the style-mockups branch; each direction is the home page's
// real copy in a different look. Nothing else on the site uses this.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviews } from './data/reviews'
import mirrorShot from './assets/photography-optimized/Mirror Shot.webp'
import windowKid from './assets/photography-optimized/Window Kid.webp'
import zenRider from './assets/photography-optimized/Zen Rider.webp'
import juiceGirl from './assets/photography-optimized/Juice Girl.webp'
import './styleLab.css'

const FONTS = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;800;900&family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Space+Mono&display=swap'

const SERVICES = [
  { title: 'Session Drumming', short: 'Session Drums', text: 'Remote and in-person drum tracking with parts shaped around the song, the artist, and the production.' },
  { title: 'Production & Editing', short: 'Production', text: 'Arrangement support, editing, programming, and practical problem-solving for artists and producers.' },
  { title: 'Private Drum Lessons', short: 'Lessons', text: 'One-on-one instruction for students who want stronger time, better feel, cleaner technique, and a more musical approach to the kit.' },
  { title: 'Live Performance', short: 'Live', text: 'Prepared, adaptable drum support for live dates, artist sets, rehearsals, and performance-focused projects.' },
]

const TOOLS = [
  { name: 'Tempo Guessr', to: '/tempo-guessr', kind: 'Ear' },
  { name: 'Metronome', to: '/metronome', kind: 'Time' },
  { name: 'Fill Generator', to: '/fill-generator', kind: 'Drums' },
  { name: 'Sticking Generator', to: '/sticking-generator', kind: 'Drums' },
  { name: 'Independence', to: '/independence', kind: 'Drums' },
  { name: 'Sight Reading', to: '/sight-reading', kind: 'Reading' },
  { name: 'Ear Trainer', to: '/ear-training', kind: 'Ear' },
  { name: 'Chord Progressions', to: '/chord-progressions', kind: 'Keys' },
]

const ABOUT = 'Luke is an NYC-based drummer, producer, and collaborator with 12+ years of professional experience across remote sessions, live performances, original productions, and private instruction. His work centers on serving the song, keeping the process organized, and making each part feel intentional.'
const INTRO = 'Luke Markham helps artists, producers, and students bring songs into focus through tasteful drum parts, practical production support, and clear musical communication.'
const NAV = ['About', 'Services', 'Practice', 'Video', 'Audio', 'Beats', 'Contact']

const review = reviews.find((item) => item.id === 'review-672330') ?? reviews[0]
const pad = (number) => String(number).padStart(2, '0')

const STYLES = [
  { id: 'lab', label: 'Lab', from: 'lab. / GAZU' },
  { id: 'signal', label: 'Signal', from: 'SNDWAV' },
  { id: 'liner', label: 'Liner Notes', from: 'Richard Gore / Designer' },
  { id: 'stage', label: 'Stage', from: 'John Mark McMillan / Jazz Sound' },
]

function Lab() {
  return (
    <div className="sl-lab">
      <nav className="sl-lab-nav">
        <span className="sl-lab-mark">LM+</span>
        <span className="sl-lab-navlinks">{NAV.slice(0, 4).map((item) => <a key={item}>{item}</a>)}</span>
        <span className="sl-lab-burger" aria-hidden="true"><i /><i /></span>
      </nav>
      <header className="sl-lab-hero">
        <div className="sl-lab-hero-left">
          <h1>luke.</h1>
          <p className="sl-lab-meta">Drums / Production / Lessons — NYC</p>
          <span className="sl-lab-count">001</span>
        </div>
        <div className="sl-lab-hero-right">
          <div className="sl-lab-block" />
          <img src={mirrorShot} alt="" />
          <a className="sl-lab-arrow" href="#lab-services">→</a>
          <p className="sl-lab-vertical">Serve<br />the<br />song</p>
          <p className="sl-lab-blurb">{INTRO}</p>
        </div>
      </header>
      <section className="sl-lab-about">
        <span className="sl-lab-label">— About</span>
        <p>{ABOUT}</p>
      </section>
      <section id="lab-services" className="sl-lab-services">
        {SERVICES.map((service, index) => (
          <article key={service.title}>
            <span className="sl-lab-label">— {pad(index + 1)}</span>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
          </article>
        ))}
      </section>
      <section className="sl-lab-review">
        <span className="sl-lab-quote">“</span>
        <blockquote>{review.quote}</blockquote>
        <cite>{review.source} — SoundBetter</cite>
      </section>
      <section className="sl-lab-tools">
        <h2>practice<span>.</span></h2>
        <ul>
          {TOOLS.map((tool, index) => (
            <li key={tool.name}>
              <Link to={tool.to}>
                <span>{pad(index + 1)}</span>
                <strong>{tool.name}</strong>
                <em>{tool.kind}</em>
                <b>→</b>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="sl-lab-footer">
        <span>luke.</span>
        <a href="mailto:luke@lukemarkham.com">luke@lukemarkham.com</a>
      </footer>
    </div>
  )
}

const ICONS = [
  <svg key="wave" viewBox="0 0 120 32"><path d="M0 16h20l4-10 5 20 5-26 5 32 5-24 5 16 5-8 4 4h58" /></svg>,
  <svg key="bars" viewBox="0 0 120 32">{[8, 20, 32, 44, 56, 68, 80].map((x, i) => <line key={x} x1={x} x2={x} y1={[10, 2, 14, 6, 18, 4, 12][i]} y2="32" />)}</svg>,
  <svg key="rings" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" /><circle cx="16" cy="16" r="10" /><circle cx="16" cy="16" r="5" /></svg>,
  <svg key="grid" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" /><path d="M1 11h30M1 21h30M11 1v30M21 1v30" /></svg>,
]

function Signal() {
  return (
    <div className="sl-signal">
      <nav className="sl-signal-nav">
        <span className="sl-signal-logo">
          <svg viewBox="0 0 40 20" aria-hidden="true"><path d="M0 10h8l3-7 4 14 4-17 4 20 3-14 3 6 3-2h8" /></svg>
          Luke Markham
        </span>
        <span className="sl-signal-links">{NAV.slice(0, 5).map((item) => <a key={item}>{item}</a>)}</span>
      </nav>
      <header className="sl-signal-hero">
        <div className="sl-signal-copy">
          <h1>Serve the<br /><span>song.</span></h1>
          <p>{INTRO}</p>
          <a className="sl-signal-pill">Listen to the work <i>▶</i></a>
        </div>
        <div className="sl-signal-photo">
          <img src={mirrorShot} alt="" />
          <svg className="sl-signal-scribble" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 250 l10-30 10 40 10-50 10 45 10-35 C160 220 300 40 380 60 C440 80 260 260 200 230 C150 200 420 170 520 230 C570 260 590 200 600 120" />
          </svg>
        </div>
      </header>
      <section className="sl-signal-strip">
        {SERVICES.map((service, index) => (
          <article key={service.title}>
            <span className="sl-signal-num">{pad(index + 1)}</span>
            <h3>{service.short}</h3>
            <div className="sl-signal-icon">{ICONS[index]}</div>
            <p>{service.text}</p>
          </article>
        ))}
      </section>
      <section className="sl-signal-review">
        <blockquote>“{review.quote}”</blockquote>
        <cite>{review.source} · 5 stars on SoundBetter</cite>
      </section>
      <section className="sl-signal-tools">
        <h2>Practice<br /><span>room.</span></h2>
        <div className="sl-signal-toolgrid">
          {TOOLS.map((tool, index) => (
            <Link key={tool.name} to={tool.to}>
              <span>{pad(index + 1)}</span>
              <strong>{tool.name}</strong>
              <em>{tool.kind}</em>
            </Link>
          ))}
        </div>
      </section>
      <section className="sl-signal-about">
        <p>{ABOUT}</p>
      </section>
    </div>
  )
}

function LinerNotes() {
  return (
    <div className="sl-liner">
      <nav className="sl-liner-nav">
        <span>Luke Markham</span>
        <span className="sl-liner-links">{NAV.slice(0, 5).map((item, index) => <a key={item} className={index === 0 ? 'is-on' : ''}>{item}</a>)}</span>
      </nav>
      <header className="sl-liner-hero">
        <div className="sl-liner-ghost" aria-hidden="true">DRUMS</div>
        <img src={mirrorShot} alt="" />
        <div className="sl-liner-name">
          <em>Luke</em>
          <h1>Markham<span>.</span></h1>
          <p>Drummer · Producer · Teacher</p>
        </div>
      </header>
      <section className="sl-liner-chapter">
        <div className="sl-liner-numeral" style={{ backgroundImage: `url("${windowKid}")` }}>01</div>
        <div>
          <span className="sl-liner-kicker">About</span>
          <h2>The Player</h2>
          <hr />
          <p>{ABOUT}</p>
        </div>
      </section>
      <section className="sl-liner-chapter is-flipped">
        <div className="sl-liner-numeral" style={{ backgroundImage: `url("${zenRider}")` }}>02</div>
        <div>
          <span className="sl-liner-kicker">Services</span>
          <h2>The Work</h2>
          <hr />
          <dl>
            {SERVICES.map((service) => (
              <div key={service.title}>
                <dt>{service.title}</dt>
                <dd>{service.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="sl-liner-chapter">
        <div className="sl-liner-numeral" style={{ backgroundImage: `url("${juiceGirl}")` }}>03</div>
        <div>
          <span className="sl-liner-kicker">Practice tools</span>
          <h2>Track Listing</h2>
          <hr />
          <ol className="sl-liner-tracks">
            {TOOLS.map((tool, index) => (
              <li key={tool.name}>
                <Link to={tool.to}>
                  <span>{index < 4 ? 'A' : 'B'}{(index % 4) + 1}</span>
                  <strong>{tool.name}</strong>
                  <i />
                  <em>{tool.kind}</em>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="sl-liner-review">
        <blockquote>{review.quote}</blockquote>
        <cite>{review.source}</cite>
      </section>
    </div>
  )
}

function Stage() {
  return (
    <div className="sl-stage">
      <header className="sl-stage-hero" style={{ backgroundImage: `url("${mirrorShot}")` }}>
        <nav>
          <span className="sl-stage-mono">LM</span>
          <span className="sl-stage-burger" aria-hidden="true"><i /><i /><i /></span>
        </nav>
        <div className="sl-stage-title">
          <p>Drummer · Producer · NYC</p>
          <h1>Luke Markham</h1>
          <hr />
          <a>Hear the work ›</a>
        </div>
      </header>
      <section className="sl-stage-split">
        <div>
          <hr />
          <h2>Serving the Song</h2>
          <p>{ABOUT}</p>
          <blockquote>
            <span>“</span>{review.quote}
            <cite>— {review.source}</cite>
          </blockquote>
        </div>
        <img src={windowKid} alt="" />
      </section>
      <section className="sl-stage-tiles">
        <div style={{ backgroundImage: `url("${zenRider}")` }}><h3>Video</h3></div>
        <div style={{ backgroundImage: `url("${juiceGirl}")` }}><span className="sl-stage-play">▶</span></div>
        <div style={{ backgroundImage: `url("${mirrorShot}")` }}><h3>Audio</h3></div>
      </section>
      <section className="sl-stage-services">
        <hr />
        <h2>What I Do</h2>
        <div className="sl-stage-servicegrid">
          {SERVICES.map((service) => (
            <article key={service.title}>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="sl-stage-dates">
        <div>
          <hr />
          <h2>Practice Room</h2>
          <p>Free tools for drummers and players, built for daily practice.</p>
        </div>
        <ul>
          {TOOLS.map((tool, index) => (
            <li key={tool.name}>
              <span className="sl-stage-date"><small>{tool.kind}</small>{pad(index + 1)}</span>
              <strong>{tool.name}</strong>
              <Link to={tool.to}>Open</Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="sl-stage-footer">
        <span className="sl-stage-mono">LM</span>
        <span>Contact / About Luke</span>
      </footer>
    </div>
  )
}

const VIEWS = { lab: Lab, signal: Signal, liner: LinerNotes, stage: Stage }

export default function StyleLab() {
  const [style, setStyle] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('v')
    return VIEWS[requested] ? requested : 'lab'
  })

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS
    document.head.append(link)
    return () => link.remove()
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', `?v=${style}`)
    window.scrollTo(0, 0)
  }, [style])

  const View = VIEWS[style]
  const current = STYLES.find((item) => item.id === style)
  return (
    <div className="sl-root">
      <View />
      <div className="sl-switcher" role="tablist" aria-label="Style">
        {STYLES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === style} onClick={() => setStyle(item.id)}>
            {item.label}
          </button>
        ))}
        <span className="sl-switcher-from">after {current.from}</span>
      </div>
    </div>
  )
}
