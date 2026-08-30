/** Katalog minat rekreasional GEHC — parent selectable=false, leaf selectable=true */
module.exports = [
  // ── SPORTS ──
  { id: 'rec-cat-sports-olahraga', slug: 'sports-olahraga', name: 'Olahraga', kind: 'SPORTS', parentId: null, selectable: false, sortOrder: 1 },
  { id: 'rec-sport-futsal', slug: 'futsal', name: 'Futsal', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 1 },
  { id: 'rec-sport-sepak-bola', slug: 'sepak-bola', name: 'Sepak Bola', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 2 },
  { id: 'rec-sport-badminton', slug: 'badminton', name: 'Badminton', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 3 },
  { id: 'rec-sport-voli', slug: 'voli', name: 'Voli', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 4 },
  { id: 'rec-sport-basket', slug: 'basket', name: 'Basket', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 5 },
  { id: 'rec-sport-tenis-meja', slug: 'tenis-meja', name: 'Tenis Meja', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 6 },
  { id: 'rec-sport-lari', slug: 'lari-atletik', name: 'Lari & Atletik', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 7 },
  { id: 'rec-sport-renang', slug: 'renang', name: 'Renang', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 8 },
  { id: 'rec-sport-panjat', slug: 'panjat-tebing', name: 'Panjat Tebing', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 9 },
  { id: 'rec-sport-bulu-tangkis', slug: 'bulu-tangkis', name: 'Bulu Tangkis', kind: 'SPORTS', parentId: 'rec-cat-sports-olahraga', selectable: true, sortOrder: 10 },

  { id: 'rec-cat-sports-esports', slug: 'sports-esports', name: 'Esports', kind: 'SPORTS', parentId: null, selectable: false, sortOrder: 2 },
  { id: 'rec-esport-ml', slug: 'mobile-legends', name: 'Mobile Legends', kind: 'SPORTS', parentId: 'rec-cat-sports-esports', selectable: true, sortOrder: 1 },
  { id: 'rec-esport-valorant', slug: 'valorant', name: 'Valorant', kind: 'SPORTS', parentId: 'rec-cat-sports-esports', selectable: true, sortOrder: 2 },
  { id: 'rec-esport-pubgm', slug: 'pubg-mobile', name: 'PUBG Mobile', kind: 'SPORTS', parentId: 'rec-cat-sports-esports', selectable: true, sortOrder: 3 },
  { id: 'rec-esport-ff', slug: 'free-fire', name: 'Free Fire', kind: 'SPORTS', parentId: 'rec-cat-sports-esports', selectable: true, sortOrder: 4 },
  { id: 'rec-esport-efootball', slug: 'efootball', name: 'eFootball / FIFA', kind: 'SPORTS', parentId: 'rec-cat-sports-esports', selectable: true, sortOrder: 5 },

  // ── ARTS ──
  { id: 'rec-cat-arts-dance', slug: 'arts-dance', name: 'Dance', kind: 'ARTS', parentId: null, selectable: false, sortOrder: 1 },
  { id: 'rec-dance-maengket', slug: 'maengket', name: 'Maengket', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 1 },
  { id: 'rec-dance-kabasaran', slug: 'kabasaran', name: 'Kabasaran', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 2 },
  { id: 'rec-dance-katrili', slug: 'katrili', name: 'Katrili', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 3 },
  { id: 'rec-dance-modern', slug: 'tari-modern', name: 'Tari Modern / Kontemporer', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 4 },
  { id: 'rec-dance-tradisional', slug: 'tari-tradisional', name: 'Tari Tradisional', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 5 },
  { id: 'rec-dance-hiphop', slug: 'hip-hop', name: 'Hip Hop / Street Dance', kind: 'ARTS', parentId: 'rec-cat-arts-dance', selectable: true, sortOrder: 6 },

  { id: 'rec-cat-arts-vocal', slug: 'arts-vocal', name: 'Vocal', kind: 'ARTS', parentId: null, selectable: false, sortOrder: 2 },
  { id: 'rec-vocal-vocalia', slug: 'vocalia-its-gehc', name: 'Vocalia (Proyeksi ITS GEHC)', kind: 'ARTS', parentId: 'rec-cat-arts-vocal', selectable: true, sortOrder: 1 },
  { id: 'rec-vocal-group', slug: 'vocal-group', name: 'Vocal Group', kind: 'ARTS', parentId: 'rec-cat-arts-vocal', selectable: true, sortOrder: 2 },
  { id: 'rec-vocal-choir', slug: 'choir', name: 'Choir / Paduan Suara', kind: 'ARTS', parentId: 'rec-cat-arts-vocal', selectable: true, sortOrder: 3 },
  { id: 'rec-vocal-worship', slug: 'worship-vocal', name: 'Worship Team (Praise)', kind: 'ARTS', parentId: 'rec-cat-arts-vocal', selectable: true, sortOrder: 4 },
  { id: 'rec-vocal-solo', slug: 'solo-vocal', name: 'Solo Vocal', kind: 'ARTS', parentId: 'rec-cat-arts-vocal', selectable: true, sortOrder: 5 },

  { id: 'rec-cat-arts-drama', slug: 'arts-drama', name: 'Drama', kind: 'ARTS', parentId: null, selectable: false, sortOrder: 3 },
  { id: 'rec-drama-skit', slug: 'skit', name: 'Skit', kind: 'ARTS', parentId: 'rec-cat-arts-drama', selectable: true, sortOrder: 1 },
  { id: 'rec-drama-musikal', slug: 'drama-musikal', name: 'Drama Musikal', kind: 'ARTS', parentId: 'rec-cat-arts-drama', selectable: true, sortOrder: 2 },
  { id: 'rec-drama-teater', slug: 'teater', name: 'Teater', kind: 'ARTS', parentId: 'rec-cat-arts-drama', selectable: true, sortOrder: 3 },
  { id: 'rec-drama-monolog', slug: 'monolog', name: 'Monolog', kind: 'ARTS', parentId: 'rec-cat-arts-drama', selectable: true, sortOrder: 4 },
  { id: 'rec-drama-pantomim', slug: 'pantomim', name: 'Pantomim / Imitasi', kind: 'ARTS', parentId: 'rec-cat-arts-drama', selectable: true, sortOrder: 5 },

  { id: 'rec-cat-arts-musik', slug: 'arts-musik', name: 'Musik / Instrument', kind: 'ARTS', parentId: null, selectable: false, sortOrder: 4 },
  { id: 'rec-musik-gitar', slug: 'gitar', name: 'Gitar', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 1 },
  { id: 'rec-musik-keyboard', slug: 'keyboard', name: 'Keyboard / Piano', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 2 },
  { id: 'rec-musik-drum', slug: 'drum', name: 'Drum', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 3 },
  { id: 'rec-musik-bass', slug: 'bass', name: 'Bass', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 4 },
  { id: 'rec-musik-violin', slug: 'violin', name: 'Violin / Biola', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 5 },
  { id: 'rec-musik-saxophone', slug: 'saxophone', name: 'Saxophone / Tiup', kind: 'ARTS', parentId: 'rec-cat-arts-musik', selectable: true, sortOrder: 6 },
];
