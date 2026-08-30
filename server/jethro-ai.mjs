/**
 * Narasi AI ("Jethro") — merangkum kondisi ekosistem menjadi ringkasan eksekutif
 * untuk rapat Komisi Pemuda. Murni lapisan teks di atas data engine yang sudah
 * deterministik; keputusan akhir tetap di tangan manusia.
 *
 * Provider: Vercel AI SDK (OpenAI primary, Groq fallback)
 * Env: OPENAI_API_KEY, GROQ_API_KEY, AI_MODEL_MAIN, AI_MODEL_FALLBACK
 */
import { jethroGenerateText } from './ai-provider.mjs';
import { getDashboard } from './engine.mjs';

/**
 * AI Analysis for Placement Recommendations
 * Analyzes Jethro's placement recommendations and provides natural language insights
 */
export async function analyzePlacementRecommendations(recommendations, groupStates) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi — analisis AI nonaktif.');
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

  const system = 'Kamu adalah asisten "Jethro" untuk Komisi Pemuda gereja (GMIM Eben Haezer Cikarang / GEHC Youth "Beyonders").';

  const prompt = [
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

  const analysis = await jethroGenerateText({ system, prompt, maxTokens: 1024 });

  return {
    analysis: analysis || '(tidak ada keluaran)',
    basedOn: { recommendations: recommendations.length, groups: groupStates.length },
    generatedAt: new Date().toISOString(),
  };
}

export async function narrateDashboard() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi — narasi AI nonaktif.');
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

  const system = 'Kamu adalah asisten "Jethro" untuk Komisi Pemuda gereja (GMIM Eben Haezer Cikarang / GEHC Youth "Beyonders").';

  const prompt = [
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

  const summary = await jethroGenerateText({ system, prompt, maxTokens: 768 });

  return {
    summary: summary || '(tidak ada keluaran)',
    basedOn: { groups: dash.groups.length, notifications: dash.notifications.length },
    generatedAt: new Date().toISOString(),
  };
}
