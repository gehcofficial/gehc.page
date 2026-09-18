import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENTOR_PITCH_SLIDES } from '../../src/data/mentorPitchSlides';
import type { PitchSlideKind } from '../../src/data/pitchSlides';

const KNOWN_KINDS: PitchSlideKind[] = [
  'cover', 'section', 'list', 'roadmap', 'closing', 'demo', 'qr', 'flow', 'weights', 'checklist', 'image',
];

const root = path.resolve(__dirname, '..', '..');
const publicFile = (url: string) => path.join(root, 'public', url.replace(/^\//, ''));

describe('deck mentor: struktur', () => {
  it('id unik & kind dikenal', () => {
    const ids = MENTOR_PITCH_SLIDES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of MENTOR_PITCH_SLIDES) {
      expect(KNOWN_KINDS).toContain(s.kind);
      expect(s.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('setiap slide punya isi sesuai kind-nya', () => {
    for (const s of MENTOR_PITCH_SLIDES) {
      if (s.kind === 'list' || s.kind === 'section') expect(s.bullets?.length).toBeTruthy();
      if (s.kind === 'flow') expect(s.flow?.length).toBeTruthy();
      if (s.kind === 'weights') expect(s.weights?.length).toBeTruthy();
      if (s.kind === 'checklist') expect(s.checklist?.length).toBeTruthy();
      if (s.kind === 'demo') expect(s.demo?.steps?.length).toBeTruthy();
      if (s.kind === 'qr') expect(s.qr?.length).toBeTruthy();
      if (s.kind === 'image') expect(s.image?.src).toBeTruthy();
    }
  });

  it('bobot 4 parameter Jethro totalnya 100%', () => {
    const slide = MENTOR_PITCH_SLIDES.find((s) => s.kind === 'weights');
    const total = (slide?.weights || []).reduce((n, w) => n + w.value, 0);
    expect(Math.round(total * 100)).toBe(100);
    expect(slide?.weights?.map((w) => Math.round(w.value * 100))).toEqual([30, 25, 30, 15]);
  });
});

describe('deck mentor: aset', () => {
  it('file demo (gambar/video) ada di public/', () => {
    const urls = MENTOR_PITCH_SLIDES.flatMap((s) => [
      ...(s.demo?.steps || []).map((d) => d.media),
      ...(s.image ? [s.image.src] : []),
      ...(s.qr || []).map((q) => q.image),
    ]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(fs.existsSync(publicFile(url)), `hilang: public${url}`).toBe(true);
    }
  });

  it('alur lima langkah regenerasi berurutan', () => {
    const flow = MENTOR_PITCH_SLIDES.find((s) => s.id === 'lima-langkah')?.flow || [];
    expect(flow.map((f) => f.title)).toEqual([
      '1. Alumni', '2. Buka generasi', '3. Pemimpin', '4. Bawa anggota', '5. Assign baru',
    ]);
  });
});
