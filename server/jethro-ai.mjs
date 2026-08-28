/**
 * Narasi AI ("Jethro") — merangkum kondisi ekosistem menjadi ringkasan eksekutif
 * untuk rapat Komisi Pemuda. Murni lapisan teks di atas data engine yang sudah
 * deterministik; keputusan akhir tetap di tangan manusia.
 *
 * Env: GEMINI_API_KEY (Google AI Studio)
 */
import { GoogleGenAI } from '@google/genai';
import { getDashboard } from './engine.mjs';

/**
 * AI Analysis for Placement Recommendations
 * Analyzes Jethro's placement recommendations and provides natural language insights
 */
export async function analyzePlacementRecommendations(recommendations, groupStates) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi — analisis AI nonaktif.');
  }

  const facts = {
    recommendations: recommendations.map((r) => ({
      newcomer: r.newcomerName,
      gender: r.newcomerGender,
      topGifts: r.newcomerGiftsTop5?.slice(0, 3) || [],
      recommendedGroup: r.recommendedGroupName,
      recommendedRole: r.recommendedRole,
      confidence: Math.round(r.confidence * 100),
      reasons: r.reasons,
      scoreBreakdown: r.scoreBreakdown,
    })),
    groupSummary: groupStates.map((g) => ({
      name: g.name,
      freeSlots: g.freeSlots,
      activeCount: g.activeCount,
      genderRatio: g.genderRatio,
      diversityScore: Math.round(g.diversityScore * 100),
      mentorCount: g.mentorCount,
      comentorCount: g.comentorCount,
    })),
  };

  const prompt = [
    'Kamu adalah asisten "Jethro" untuk Komisi Pemuda gereja (GMIM Eben Haezer Cikarang / GEHC Youth "Beyonders").',
    'Berdasarkan data JSON berikut (hasil rekomendasi penempatan newcomer ke kelompok mentoring), tulis ANALISIS MENGENAI REKOMENDASI PENEMPATAN untuk review Admin/Komisi.',
    '',
    'ATURAN:',
    '- Bahasa Indonesia, profesional namun hangat, maksimal ~250 kata.',
    '- Struktur: 1) Ringkasan keseluruhan rekomendasi, 2) Analisis per parameter (distribusi merata, gender balance, gift diversity, maturity fit), 3) Perhatian khusus (newcomer yang confidence rendah / tidak tertampung), 4) Satu kalimat penutup pengingat bahwa keputusan akhir ada di Admin/Komisi.',
    '- Sebut nama newcomer/grup secara spesifik bila relevan.',
    '- JANGAN mengarang data di luar JSON. JANGAN pakai markdown heading; boleh pakai tanda hubung untuk daftar.',
    '',
    'DATA:',
    JSON.stringify(facts),
  ].join('\n');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    contents: prompt,
  });

  return {
    analysis: res.text?.trim() || '(tidak ada keluaran)',
    basedOn: { recommendations: recommendations.length, groups: groupStates.length },
    generatedAt: new Date().toISOString(),
  };
}

export async function narrateDashboard() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi — narasi AI nonaktif.');
  }

  const dash = await getDashboard();
  const byType = (t) => dash.notifications.filter((n) => n.type === t);

  const facts = {
    threshold: dash.threshold,
    groups: dash.groups.map((g) => ({
      nama: g.name,
      anggotaAktif: g.activeCount,
      penuh: g.isFull,
      anakDari: g.parentName || undefined,
      status: g.status,
    })),
    flagIdle: byType('IDLE_FLAG').map((n) => ({ anggota: n.memberName, grup: n.groupName })),
    alertMitosis: byType('MITOSIS_ALERT').map((n) => ({
      grup: n.groupName,
      kandidatPromote: n.payload?.candidates?.map((c) => `${c.name} (${c.rate}%)`),
    })),
    saranMerger: byType('MERGER_SUGGESTION').map((n) => ({
      gabung: `${n.payload?.sourceName} + ${n.payload?.targetName}`,
      totalOrang: n.payload?.combined,
    })),
  };

  const prompt = [
    'Kamu adalah asisten "Jethro" untuk Komisi Pemuda gereja (GMIM Eben Haezer Cikarang / GEHC Youth "Beyonders").',
    'Berdasarkan data JSON berikut (hasil analisis engine regenerasi kelompok), tulis RINGKASAN EKSEKUTIF untuk rapat Komisi.',
    '',
    'ATURAN:',
    '- Bahasa Indonesia, profesional namun hangat, maksimal ~180 kata.',
    '- Struktur: 1) Kesehatan umum kapasitas grup, 2) Keputusan yang diminta minggu ini (mitosis/merger/idle), 3) Satu kalimat penutup pengingat bahwa keputusan akhir ada di Komisi.',
    '- Sebut nama grup/orang secara spesifik bila relevan.',
    '- JANGAN mengarang data di luar JSON. JANGAN pakai markdown heading; boleh pakai tanda hubung untuk daftar.',
    '',
    'DATA:',
    JSON.stringify(facts),
  ].join('\n');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    contents: prompt,
  });

  return {
    summary: res.text?.trim() || '(tidak ada keluaran)',
    basedOn: { groups: dash.groups.length, notifications: dash.notifications.length },
    generatedAt: new Date().toISOString(),
  };
}
