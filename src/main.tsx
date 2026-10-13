import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const pixelFont = new FontFace('Pixel', `url(${import.meta.env.BASE_URL}assets/PressStart2P-Regular.ttf)`);
pixelFont.load().then(font => document.fonts.add(font)).catch(() => { /* System monospace remains readable offline. */ });

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="error-page"><h1>The village couldn’t open.</h1><p>You can still read every section of the portfolio.</p><a href="./portfolio.html">Open portfolio</a><a href="./resume.pdf" download>Download résumé</a></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Boundary><App /></Boundary></React.StrictMode>);
