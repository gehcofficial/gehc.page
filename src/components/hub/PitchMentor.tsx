import React from 'react';
import PitchDeck from './PitchDeck';
import { MENTOR_PITCH_SLIDES } from '../../data/mentorPitchSlides';

/**
 * Deck presentasi Mentor & Co-Mentor: cara kerja regenerasi + cara orang baru
 * ditempatkan (Jethro Engine) + fitur portal yang perlu diperhatikan mentor.
 * Diakses lewat youth.gehc.page/#/pitch (host-aware) atau /#/pitch-mentor.
 */
const PitchMentor: React.FC = () => (
  <PitchDeck
    slides={MENTOR_PITCH_SLIDES}
    storageKey="gehc-pitch-scale-mentor"
    label="Beyonders · Panduan Mentor"
    docTitle="Beyonders — Panduan Mentor & Co-Mentor"
    exitHash="#/portal"
  />
);

export default PitchMentor;
