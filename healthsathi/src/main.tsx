import "./i18n";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "leaflet/dist/leaflet.css";
import { startSyncService } from './services/syncService';

// Start the Bridge sync service — syncs anonymous patient data to cloud every 5 min
startSyncService();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
