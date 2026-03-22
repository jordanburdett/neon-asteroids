import GameCanvas from './components/GameCanvas'
import './App.css'

export default function App() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#000',
      }}
    >
      <GameCanvas />
    </div>
  )
}
