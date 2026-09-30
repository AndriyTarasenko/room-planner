import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

/**
 * The canvas measures text with the UI font, so wait (briefly) for Inter before the first
 * render; otherwise labels would be laid out with a fallback font.
 */
async function start() {
  try {
    await Promise.race([document.fonts.load("500 11px 'Inter Variable'"), new Promise((r) => setTimeout(r, 800))]);
  } catch {
    // Render with the fallback font.
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
