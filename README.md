# QuizVerse 3D — MVP

Game kuis edukasi 3D berbasis browser menggunakan Three.js, Firebase Authentication (Anonymous), Firebase Realtime Database, serta bank soal JSON.

## Fitur
- Avatar blocky 3D dengan pilihan rambut, ekspresi, warna kulit, model/warna baju, model/warna celana, dan aksesori.
- Kontrol keyboard WASD/panah, joystick virtual dan tombol lompat pada layar sentuh.
- Arena 3D dengan empat platform warna, kuis 15 detik, skor, streak, dan podium.
- Mode solo tanpa Firebase.
- Room PIN 6 digit, lobi, dan sinkronisasi pemain/avatar melalui Firebase RTDB.
- Bank soal `questions.json` dan contoh endpoint Google Apps Script di `admin/Code.gs`.

## Konfigurasi Firebase project `quizverse-a5e26`
File `firebase-config.js` sudah berisi konfigurasi Web App dan URL Realtime Database:
`https://quizverse-a5e26-default-rtdb.firebaseio.com`

1. Firebase Console → Authentication → Sign-in method → aktifkan **Anonymous**.
2. Realtime Database → tab Rules → salin isi file `database.rules.json` → **Publish**.
3. Authentication → Settings → Authorized domains → pastikan domain GitHub Pages diizinkan.
4. Jalankan game dari localhost atau GitHub Pages untuk tes.

**Penting:** konfigurasi Web Firebase berada di frontend dan tidak setara dengan service-account credential. Jangan pernah commit service-account JSON atau private key. Batasi Authorized domains dan gunakan Security Rules. Rules yang disertakan adalah baseline MVP. Skor/jawaban masih diproses klien sehingga belum aman untuk ujian/kompetisi publik; untuk produksi pindahkan validasi jawaban dan kalkulasi skor ke backend tepercaya, lalu tambahkan App Check/rate limiting.

## Menjalankan lokal
```bash
python -m http.server 8000
```
Buka http://localhost:8000. Mode solo dapat dimainkan tanpa login Firebase.

## GitHub Pages
Repository → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save. Pastikan `index.html` berada di root.

## Bank soal
Edit `questions.json`. Setiap soal memiliki `question`, empat `options`, dan `answerIndex` (A=0, B=1, C=2, D=3). Template integrasi Google Sheets ada di `admin/Code.gs`.

## Batasan MVP
Fase eksplorasi peti/kristal, power-up, obby, eliminasi penuh, dan anti-cheat server-authoritative belum termasuk MVP ini. Sinkronisasi multiplayer masih berupa fondasi awal yang perlu diuji pada dua browser/perangkat.
