/**
 * Visitor deck (English) — short introduction to GMIM Eben Haezer Cikarang
 * for visiting friends & missionaries.
 *
 * Three content slides + cover + closing. Copy lives here so it can be edited
 * freely without touching the deck engine.
 *
 * Sumber fakta (agar tetap akurat):
 * - docs/product/tata-gereja-gmim.md  → GMIM = gereja Injili, sistem presbiterial sinodal
 * - docs/product/aturan-perantau.md   → jemaat anak muda perantau, 3–4 tahun, Cikarang industri
 * - src/data/mentorPitchSlides.ts     → rumah pemuridan, mentor/co-mentor, mitosis (berlipat)
 * - public/visuals/manifest.json      → aset foto kegiatan
 *
 * Catatan: foto "sport" belum ada aset khusus di public/visuals — sementara
 * memakai foto kegiatan terdekat. Ganti dengan foto asli bila sudah tersedia.
 */

import type { PitchSlide } from './pitchSlides';

export const VISITOR_PITCH_SLIDES: PitchSlide[] = [
  {
    id: 'cover',
    kind: 'cover',
    eyebrow: 'GMIM Eben Haezer Cikarang · Cikarang, Indonesia',
    title: 'Welcome',
    subtitle: 'A short introduction to our church — for our visiting friends and missionaries.',
  },
  {
    id: 'who-we-are',
    kind: 'list',
    eyebrow: 'Who we are',
    title: 'An Evangelical church serving young migrants',
    bullets: [
      'We are GMIM — Gereja Masehi Injili di Minahasa (the Evangelical Christian Church in Minahasa), one of Indonesia’s largest Evangelical–Reformed churches, rooted in North Sulawesi.',
      'Here in Cikarang we are a young, growing congregation and part of the wider GMIM family.',
      'Our focus today: young migrants (perantau) — students and workers living far from home.',
      'Why Cikarang? It is one of Indonesia’s largest industrial estates, drawing young people from across the country to study and to work.',
      'We gather in rented spaces, yet we are one church made of many small communities.',
    ],
  },
  {
    id: 'weekly-rhythm',
    kind: 'checklist',
    eyebrow: 'Our weekly rhythm',
    title: 'Priority: small discipleship houses',
    subtitle: 'Through the week, our main focus is small discipleship houses that keep growing and multiplying.',
    checklist: [
      {
        title: 'The heart of the week',
        detail: 'Beyond Sunday, small discipleship houses (rumah pemuridan) meet in homes — the center of our life together.',
      },
      {
        title: 'Every house is shepherded',
        detail: 'A leader and a co-leader walk with each member, week by week.',
      },
      {
        title: 'Growing deeper',
        detail: 'Worship, the Word, prayer, and honest shared life in a small, safe circle.',
      },
      {
        title: 'Multiplying',
        detail: 'As houses grow, they birth new houses — disciples making disciples, house by house.',
      },
    ],
  },
  {
    id: 'life-together',
    kind: 'image',
    eyebrow: 'Life together',
    title: 'Ministry and recreation',
    subtitle: 'Moments from our ministry — and the recreation that keeps us refreshed, on and off the church.',
    image: {
      src: '/visuals/landing/02-collage-worship.jpg',
      alt: 'Worship and community life at GMIM Eben Haezer Cikarang',
      caption: 'Worship, discipleship, and service — plus sports and the arts that build friendship.',
      images: [
        { src: '/visuals/landing/02-collage-worship.jpg', alt: 'Worship gathering' },
        { src: '/visuals/landing/03-collage-community.jpg', alt: 'Community and fellowship' },
        { src: '/visuals/landing/05-collage-study.jpg', alt: 'Discipleship and the Word' },
        { src: '/visuals/landing/04-collage-music.jpg', alt: 'Music and the arts' },
        { src: '/visuals/landing/06-collage-friends.jpg', alt: 'Friendship and recreation' },
        { src: '/visuals/kegiatan/baku-tau-4.jpg', alt: 'Church activity' },
      ],
    },
  },
  {
    id: 'closing',
    kind: 'closing',
    eyebrow: 'Thank you',
    title: 'Come and see',
    subtitle: 'You are always welcome at GMIM Eben Haezer Cikarang. God bless you.',
  },
];
