import { useState, useCallback } from 'react'
import GameCanvas from './components/GameCanvas'
import ResultCard from './components/ResultCard'
import {
  getDailySeed,
  getDayNumber,
  generateDailyWave,
  loadDailyRecord,
  saveDailyRecord,
  type DailyWaveData,
  type DailyRecord,
} from './game/DailyChallenge'
import './App.css'

type Screen = 'mode-select' | 'classic' | 'daily' | 'daily-result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('mode-select')
  const [dailyWaveData, setDailyWaveData] = useState<DailyWaveData | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyRecord | null>(null)

  const dayNumber = getDayNumber()
  const existingRecord = loadDailyRecord()
  const dailyCompleted = existingRecord !== null && existingRecord.completed

  function handleSelectClassic() {
    setScreen('classic')
  }

  function handleSelectDaily() {
    // If already completed today, go straight to result card
    if (dailyCompleted && existingRecord !== null) {
      setDailyResult(existingRecord)
      setScreen('daily-result')
      return
    }

    // Generate today's wave data for wave 1
    const seed = getDailySeed()
    const waveData = generateDailyWave(seed, 0)
    setDailyWaveData(waveData)
    setScreen('daily')
  }

  const handleDailyGameOver = useCallback((score: number, wave: number, waveEmojis: string[]) => {
    const record: DailyRecord = {
      completed: true,
      waveEmojis,
      score,
      dayNumber,
      wavesCleared: wave - 1,
    }
    saveDailyRecord(record)
    setDailyResult(record)
    // Short delay so the GAME OVER overlay is briefly visible, then show result card
    setTimeout(() => {
      setScreen('daily-result')
    }, 1200)
  }, [dayNumber])

  function handlePlayClassic() {
    setScreen('classic')
  }

  if (screen === 'classic') {
    return (
      <div style={wrapperStyle}>
        <GameCanvas />
      </div>
    )
  }

  if (screen === 'daily' && dailyWaveData !== null) {
    return (
      <div style={wrapperStyle}>
        <GameCanvas
          dailyWave={dailyWaveData}
          onGameOver={handleDailyGameOver}
        />
      </div>
    )
  }

  if (screen === 'daily-result' && dailyResult !== null) {
    return (
      <div style={wrapperStyle}>
        <ResultCard record={dailyResult} onPlayClassic={handlePlayClassic} />
      </div>
    )
  }

  // Mode select screen
  return (
    <div style={wrapperStyle}>
      <div style={modeSelectStyle}>
        <div style={logoStyle}>NEON ASTEROIDS</div>
        <div style={subtitleStyle}>choose your mode</div>

        <div style={cardsRowStyle}>
          <ModeCard
            title="CLASSIC"
            description="Endless arcade action. Survive as long as you can."
            badge={null}
            onClick={handleSelectClassic}
          />
          <ModeCard
            title="DAILY"
            description="Same asteroids for everyone. One shot per day."
            badge={`#${dayNumber}`}
            completed={dailyCompleted}
            onClick={handleSelectDaily}
          />
        </div>
      </div>
    </div>
  )
}

interface ModeCardProps {
  title: string
  description: string
  badge: string | null
  completed?: boolean
  onClick: () => void
}

function ModeCard({ title, description, badge, completed, onClick }: ModeCardProps) {
  const [hovered, setHovered] = useState(false)

  const cardStyle: React.CSSProperties = {
    background: hovered ? 'rgba(0,229,255,0.06)' : 'transparent',
    border: hovered ? '1px solid rgba(0,229,255,0.7)' : '1px solid rgba(255,255,255,0.25)',
    padding: '28px 32px',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    color: '#fff',
    width: '200px',
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
    position: 'relative',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    letterSpacing: '3px',
    color: hovered ? 'rgba(0,229,255,0.95)' : '#fff',
    marginBottom: '12px',
  }

  const descStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1.5',
    marginBottom: '16px',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '11px',
    color: 'rgba(0,229,255,0.8)',
    border: '1px solid rgba(0,229,255,0.4)',
    padding: '2px 8px',
    letterSpacing: '1px',
  }

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-label={`${title} mode${completed ? ' — Completed today' : ''}`}
    >
      <div style={titleStyle}>{title}</div>
      <div style={descStyle}>{description}</div>
      {badge !== null && (
        <div style={badgeStyle}>
          {completed ? `${badge} Completed ✓` : badge}
        </div>
      )}
    </div>
  )
}

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  background: '#000',
}

const modeSelectStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '24px',
}

const logoStyle: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '36px',
  color: '#fff',
  letterSpacing: '6px',
  textAlign: 'center',
}

const subtitleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.45)',
  letterSpacing: '2px',
}

const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  marginTop: '16px',
}
