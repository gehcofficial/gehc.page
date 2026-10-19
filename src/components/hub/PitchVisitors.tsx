import React from 'react';
import PitchDeck from './PitchDeck';
import { VISITOR_PITCH_SLIDES } from '../../data/visitorPitchSlides';

/**
 * Deck tamu (English): perkenalan singkat GMIM Eben Haezer Cikarang untuk
 * misionaris/tamu. Tiga slide konten + cover + penutup.
 * Diakses lewat `#/welcome` — identik di semua host (hub & unit).
 */
const PitchVisitors: React.FC = () => (
  <PitchDeck
    slides={VISITOR_PITCH_SLIDES}
    storageKey="gehc-pitch-scale-visitor"
    label="GMIM Eben Haezer · Visitors"
    docTitle="GMIM Eben Haezer Cikarang — Welcome"
    exitHash="#/"
  />
);

export default PitchVisitors;
