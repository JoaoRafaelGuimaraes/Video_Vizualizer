import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { VideosProvider } from './context/VideosContext';
import HomePage from './pages/HomePage';
import FullVideoPage from './pages/FullVideoPage';
import RotulosPage from './pages/RotulosPage';
import FullImagePage from './pages/FullImagePage';
import LabelImagePage from './pages/LabelImagePage';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  return (
    <Router>
      <VideosProvider>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/video/:videoIndex" element={<FullVideoPage />} />
              <Route path="/rotulos" element={<RotulosPage />} />
              <Route path="/rotulos/:videoName/:frame" element={<FullImagePage />} />
              <Route path="/label/:videoKey/:imageName" element={<LabelImagePage />} />
            </Routes>
          </main>
        </div>
      </VideosProvider>
    </Router>
  );
}

export default App;
