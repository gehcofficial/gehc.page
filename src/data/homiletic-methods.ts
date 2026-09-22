/**
 * 7 metode berkhotbah kanonik (referensi tim Didaskalia).
 * Deskripsi & analogi dipakai sebagai tooltip di Studio.
 */
export type HomileticMethodDef = {
  name: string;
  short: string;
  description: string;
  analogy: string;
};

export const HOMILETIC_METHODS_DATA: HomileticMethodDef[] = [
  {
    name: 'Teologi Sistematika',
    short: 'Topik doktrinal',
    description:
      'Mengelompokkan seluruh ajaran Alkitab ke dalam kategori doktrin yang terstruktur rapi. Bertanya: "Apa yang Alkitab ajarkan secara utuh tentang doktrin tertentu?"',
    analogy: 'Seperti menyusun skema database atau ensiklopedia — data dikelompokkan per kategori besar.',
  },
  {
    name: 'Teologi Biblika',
    short: 'Historis / garis waktu',
    description:
      'Berfokus pada perkembangan sejarah penebusan secara kronologis. Bertanya: "Bagaimana Allah mengungkapkan kebenaran secara bertahap dari zaman ke zaman?"',
    analogy: 'Seperti grafik time-series — memperhatikan proses progresif sebuah ide.',
  },
  {
    name: 'Pengajaran Tematika',
    short: 'Isu praktis',
    description:
      'Berangkat dari kebutuhan, isu, atau tema keseharian, lalu mencari prinsip firman yang menjawabnya. Sangat praktis dan relevan dengan audiens.',
    analogy: 'Seperti dashboard analitik yang difilter untuk menjawab satu isu hari ini.',
  },
  {
    name: 'Pengajaran Ekspositori',
    short: 'Teks / verse-by-verse',
    description:
      'Membedah satu kitab secara berurutan, ayat demi ayat (eksegesis), sesuai urutan teks Alkitab. Mencegah "memilih-milih" ayat favorit.',
    analogy: 'Seperti line-by-line code review — membaca seluruh skrip dari atas ke bawah.',
  },
  {
    name: 'Apologetika',
    short: 'Pembelaan iman',
    description:
      'Memberikan argumentasi logis dan rasional untuk mempertahankan iman dari pandangan dunia lain atau pertanyaan skeptis. Intelektual, filosofis, historis.',
    analogy: 'Seperti cybersecurity / firewall rohani — menangkal ideologi sekuler dengan logika solid.',
  },
  {
    name: 'Teologi Praktika / Pastoral',
    short: 'Aplikasi pelayanan',
    description:
      'Menjembatani teologi dengan praktik pelayanan dan perawatan jiwa: konseling, penyembuhan luka batin, pembentukan karakter. Penuh empati.',
    analogy: 'Sisi User Experience (UX) dari teologi — memastikan sistemnya ramah & solutif bagi jemaat.',
  },
  {
    name: 'Teologi Historis',
    short: 'Sejarah gereja',
    description:
      'Mempelajari bagaimana pemahaman doktrin berkembang dari abad ke abad: bapa gereja, pengakuan iman, perpecahan, dan kebangunan gereja.',
    analogy: 'Seperti riwayat Git commit / version control gereja — tahu mengapa gereja hari ini berbentuk begini.',
  },
];

export const HOMILETIC_METHOD_NAMES = HOMILETIC_METHODS_DATA.map((m) => m.name);

export function homileticMethodDef(name: string): HomileticMethodDef | undefined {
  return HOMILETIC_METHODS_DATA.find((m) => m.name === name);
}
