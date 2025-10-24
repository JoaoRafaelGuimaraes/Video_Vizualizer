import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { VideosProvider } from './context/VideosContext'
import HomePage from './pages/HomePage'
import FullVideoPage from './pages/FullVideoPage'
import './App.css'

function App() {
  return (
    <Router>
      <VideosProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/video/:videoIndex" element={<FullVideoPage />} />
        </Routes>
      </VideosProvider>
    </Router>
  )
}

export default App
