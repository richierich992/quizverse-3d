# QuizVerse 3D — MVP

Game kuis edukasi 3D berbasis browser menggunakan Three.js, Firebase Authentication (Anonymous), Firebase Realtime Database, serta bank soal JSON.

## Fitur
- Avatar blocky 3D dengan live preview dan kustomisasi: 9 model rambut, 8 warna rambut, 8 ekspresi wajah, 5 warna kulit, 4 model baju, 12 warna baju, 4 model celana, 8 warna celana, dan 5 aksesori kepala.
- Kontrol keyboard WASD/panah, lompat dengan Space, joystick virtual dan tombol lompat pada layar sentuh.
- Arena 3D dengan empat platform warna, kuis 15 detik, skor, streak, dan podium.
- Mode solo tanpa Firebase.
- Room PIN 6 digit, lobi, sinkronisasi pemain dan avatar melalui Firebase RTDB.
- Bank soal `questions.json` dan contoh endpoint Google Apps Script di `admin/Code.gs`.

## Konfigurasi Firebase project `quizverse-a5e26`
1. Firebase Console → Authentication → Sign-in method → aktifkan **Anonymous**.
2. Firebase Console → Realtime Database → **Create Database**.
3. Salin URL database persis dari halaman Realtime Database.
4. Tempel URL tersebut ke `databaseURL` dalam `firebase-config.js`, mengganti `ISI_DATABASE_URL_DARI_FIREBASE_CONSOLE`.
5. Salin `database.rules.json` ke tab Rules Realtime Database lalu klik **Publish**.
6. Di Authentication → Settings → Authorized domains, pastikan domain GitHub Pages ditambahkan.

Web config telah diisi dengan konfigurasi aplikasi yang diberikan. URL database belum diisi karena database RTDB perlu dibuat terlebih dahulu. Jangan pernah menaruh service-account JSON atau private key di frontend.

Rules yang disertakan adalah baseline MVP: hanya host pemilik room dapat menulis metadata room, dan pemain hanya dapat menulis node pemainnya sendiri. Namun jawaban dan skor tetap diproses di klien, jadi ini belum aman untuk ujian/kompetisi publik. Untuk rilis publik, pindahkan validasi jawaban dan kalkulasi skor ke backend tepercaya (misalnya Cloud Functions) serta tambahkan App Check/rate limiting.

## Menjalankan lokal
Jalankan web server pada folder ini, misalnya:
```bash
python -m http.server 8000
```
Buka http://localhost:8000. Mode solo dapat dimainkan tanpa konfigurasi Firebase.

## GitHub Pages
Repository → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save. Pastikan `index.html` berada di root.

## Bank soal
Edit `questions.json`. Setiap soal memiliki `question`, empat `options`, dan `answerIndex` dengan indeks A=0, B=1, C=2, D=3. Template integrasi Google Sheets ada di `admin/Code.gs`.

## Batasan MVP
Fase eksplorasi peti/kristal, power-up, obby, eliminasi penuh, dan anti-cheat server authoritative belum termasuk build ini. Posisi avatar disinkronkan secara periodik dan dimaksudkan untuk uji MVP.
