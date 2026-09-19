import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './book-preview.css'
import './photo-actions.css'
import './app-version.css'
import './export-actions.css'
import './linux-fonts.css'
import './cover-photo.css'
import './themes.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
