import { useState, useEffect } from 'react'
import type { DailyRecord } from '../game/DailyChallenge'
import { buildShareText } from '../game/DailyChallenge'

interface ResultCardProps {
  record: DailyRecord
  onPlayClassic: () => void
}

export default function ResultCard({ record, onPlayClassic }: ResultCardProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [copied, setCopied] = useState(false)

  // Stagger emoji reveal: 150ms per emoji
  useEffect(() => {
    if (visibleCount >= record.waveEmojis.length) return
    const timer = setTimeout(() => {
      setVisibleCount(v => v + 1)
    }, 150)
    return () => clearTimeout(timer)
  }, [visibleCount, record.waveEmojis.length])

  function handleShare() {
    const text = buildShareText(record)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        fallbackCopy(text)
      })
    } else {
      fallbackCopy(text)
    }
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
    document.body.removeChild(el)
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    border: '1px solid rgba(0,229,255,0.5)',
    padding: '40px 48px',
    color: '#fff',
    fontFamily: '"Courier New", Courier, monospace',
    minWidth: '360px',
    gap: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '22px',
    color: 'rgba(0,229,255,0.9)',
    letterSpacing: '2px',
    marginBottom: '8px',
  }

  const emojiRowStyle: React.CSSProperties = {
    fontSize: '32px',
    letterSpacing: '6px',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }

  const statsStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: '1.8',
  }

  const shareButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(0,229,255,0.7)',
    color: 'rgba(0,229,255,0.9)',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '14px',
    padding: '10px 24px',
    cursor: 'pointer',
    letterSpacing: '1px',
    marginTop: '8px',
  }

  const classicButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '12px',
    padding: '8px 20px',
    cursor: 'pointer',
    letterSpacing: '1px',
    marginTop: '4px',
  }

  return (
    <div style={containerStyle} role="dialog" aria-label="Daily Challenge Result">
      <div style={titleStyle}>
        NEON ASTEROIDS DAILY #{record.dayNumber}
      </div>

      <div style={emojiRowStyle} aria-label="wave result emojis">
        {record.waveEmojis.slice(0, visibleCount).map((emoji, i) => (
          <span key={i}>{emoji}</span>
        ))}
      </div>

      <div style={statsStyle}>
        <div>Wave {record.wavesCleared} — Score: {record.score}</div>
      </div>

      <button
        style={shareButtonStyle}
        onClick={handleShare}
        aria-label="Share result"
      >
        {copied ? 'COPIED!' : 'SHARE'}
      </button>

      <button
        style={classicButtonStyle}
        onClick={onPlayClassic}
        aria-label="Play Classic mode"
      >
        PLAY CLASSIC
      </button>
    </div>
  )
}
