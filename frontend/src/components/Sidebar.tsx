import React from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <nav>
        <ul>
          <li>
            <Link to="/">Galeria de Vídeos</Link>
          </li>
          <li>
            <Link to="/rotulos">Rótulos</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
