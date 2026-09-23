# Paritas Staging ↔ Main

Staging: **https://staging-gehcpage.vercel.app** · Produksi: **https://youth.gehc.page**

## Kenapa staging bisa tertinggal (drift)

`npm run deploy:staging` menjalankan `vercel deploy` dari **isi working tree saat itu**
(bukan otomatis dari git), lalu memasang alias `staging-gehcpage.vercel.app` ke hasil build itu.
Akibatnya staging adalah **snapshot build manual** — ia **tidak** ikut berubah setiap `main` di-push.

Pernah terjadi: staging tertinggal **60 commit** dari main (visual portal berbeda).

## Cara menyelaraskan (satu perintah)

```powershell
npm run staging:sync
```

Urutannya:
1. **Fast-forward branch git** `staging` = `main` (`git push origin main:staging`).
2. **Deploy preview** `vercel deploy --yes` (dengan **retry 5×** — jaringan sering `fetch failed`).
3. **Pasang alias** `staging-gehcpage.vercel.app` ke deployment itu.
4. **Verifikasi**: membandingkan `/api/version` staging vs main.

Opsi:

```powershell
npm run staging:sync -- --branch-only   # hanya push branch (tanpa deploy)
npm run staging:sync -- --no-deploy     # branch + verifikasi saja
npm run staging:sync -- --no-verify     # tanpa cek /api/version
npm run deploy:staging                  # deploy + alias saja (retry 5×)
```

## Kalau `vercel deploy` gagal (`fetch failed`)

Jaringan/Vercel kadang menolak upload. Skrip sudah mencoba 5×. Bila masih gagal, lakukan manual:

```powershell
vercel.cmd deploy --yes
vercel.cmd alias set <URL_DEPLOYMENT> staging-gehcpage.vercel.app --scope gehc
```

(Prasyarat: `vercel login` + `vercel link` untuk project `gehc/gehc.page`.)

## Opsional — agar tidak drift lagi (otomatis dari git)

Dashboard Vercel tidak diekspos lewat CLI. Sekali set:

1. Buka **vercel.com → project `gehc.page` → Settings → Domains**.
2. Pada **`staging-gehcpage.vercel.app`** → **Edit** → **Git Branch** = `staging` → **Save**.
3. Mulai sekarang, setiap `git push origin main:staging` (atau `npm run staging:sync -- --branch-only`)
   akan **membuat staging ter-deploy otomatis** dari branch `staging`.

Setelah itu, alur rilis cukup:

```powershell
git push origin main              # produksi (Vercel Production = main)
git push origin main:staging      # staging ikut ter-update (otomatis)
```

## Verifikasi cepat

```powershell
curl https://staging-gehcpage.vercel.app/api/version
curl https://youth.gehc.page/api/version
# `commit` keduanya harus sama.
```

## Catatan database

Staging memakai **DB staging** (cluster TiDB terpisah dari produksi).
Migrasi/schema perlu dijalankan ke staging secara terpisah, mis.:

```powershell
npm run db:migrate:local:staging     # migrasi idempoten (server/_migrate-*.cjs)
npm run db:migrate:staging           # prisma migrate deploy (folder prisma/migrations)
```
