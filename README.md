# QuizVerse 3D — Host + Player MVP

Game kuis edukasi 3D berbasis browser: Three.js untuk arena, Firebase Anonymous Authentication untuk identitas pemain, Realtime Database untuk status room, dan Cloud Functions sebagai server pengelola kuis.

## Arsitektur
- **Host** memilih bank soal JSON, membuat room PIN, lalu memulai permainan.
- **Player** hanya memasukkan PIN, memilih avatar, bergerak di arena, dan mengirim pilihan dengan berlari ke platform warna.
- **Cloud Functions** menyimpan kunci jawaban secara privat, mengatur ronde/timer, memvalidasi jawaban, dan menghitung skor.
- **Realtime Database** hanya mempublikasikan soal aktif tanpa kunci jawaban, status permainan, posisi, avatar, dan skor.

Pemain tidak mengambil `questions.json` dari repository. Kunci jawaban tidak disimpan di static client files.

## File penting
- `index.html`, `style.css`, `main.js`: UI Host/Player dan arena Three.js.
- `firebase-config.js`: konfigurasi Web app QuizVerse.
- `database.rules.json`: akses client hanya ke data room yang perlu; `privateRooms` ditutup.
- `functions/src/index.ts`: callable backend `createRoom`, `joinRoom`, `startGame`, `submitAnswer`, `advanceGame`.
- `admin/Code.gs`: ekspor Google Sheets ke JSON privat di Google Drive.

## Firebase project
Project: `quizverse-a5e26`

Realtime Database URL: `https://quizverse-a5e26-default-rtdb.firebaseio.com`

Anonymous Authentication sudah harus diaktifkan melalui Firebase Console → Authentication → Sign-in method → Anonymous.

## Mengatur Rules
1. Buka Firebase Console → Realtime Database → Rules.
2. Salin isi file `database.rules.json`.
3. Klik **Publish**.

Rules ini membaca semua node di bawah `rooms/{pin}` untuk pengguna terautentikasi, namun menolak penulisan langsung ke `meta` dan `public`. Pemain hanya dapat mengubah profil/posisi miliknya, sedangkan nilai `score` dan `streak` dilindungi. Seluruh `privateRooms` ditolak untuk client. Cloud Functions Admin SDK menulis data server.

## Menyiapkan bank soal
Host mengunggah file JSON dari perangkat sendiri. Format yang diterima:
```json
{
  "title": "Kuis Pengetahuan Umum",
  "durationSeconds": 15,
  "questions": [
    {
      "id": "q001",
      "category": "Sains",
      "question": "Planet yang dikenal sebagai Planet Merah adalah…",
      "options": ["Venus", "Mars", "Jupiter", "Saturnus"],
      "answerIndex": 1,
      "explanation": "Mars tampak kemerahan."
    }
  ]
}
```
`answerIndex`: A=0, B=1, C=2, D=3. Backend memvalidasi 1–50 soal dan empat opsi setiap soal.

### Dari Google Sheets
1. Buat sheet `Questions` sesuai header yang dijelaskan di `admin/Code.gs`.
2. Buka Extensions → Apps Script.
3. Tempel isi `admin/Code.gs`.
4. Jalankan `exportPrivateQuestionBank()` saat login sebagai admin.
5. File JSON dibuat di Google Drive dengan akses privat. Unduh, lalu unggah pada panel Host.

Jangan menerbitkan Apps Script sebagai Web App publik yang mengembalikan kunci jawaban. File ekspor harus tetap privat sampai Host mengunggahnya ke QuizVerse.

## Men-deploy Cloud Functions
**Penting: Firebase mensyaratkan paket Blaze (billing aktif) untuk men-deploy Cloud Functions.** Realtime Database dan Authentication dapat tetap menggunakan kuota gratis sesuai paketnya, tetapi penggunaan layanan yang melewati kuota dapat dikenakan biaya. Jangan aktifkan billing sebelum memahami estimasi dan membuat budget alerts. Lihat [Cloud Functions pricing](https://firebase.google.com/docs/functions/pricing).

Di komputer dengan Node.js 20 dan Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
npm --prefix functions install
npm --prefix functions run build
firebase deploy --only functions,database --project quizverse-a5e26
```
Cloud Functions menggunakan region `us-central1`, mengikuti format URL Realtime Database `.firebaseio.com` yang menunjukkan database `us-central1`. Pilih lokasi function yang sama dengan database untuk mengurangi latensi.

Jika belum ingin mengaktifkan Blaze, jangan deploy Functions dulu. UI Host/Player statis saja belum bisa menjalankan kuis server-authoritative sampai backend berhasil di-deploy.

## GitHub Pages
Repository → Settings → Pages → Deploy from a branch → `main` (atau branch fitur saat pengujian) → `/(root)` → Save. Tambahkan `richierich992.github.io` di Firebase Authentication → Settings → Authorized domains.

## Menjalankan frontend lokal
```bash
python -m http.server 8000
```
Buka http://localhost:8000. Host dan Player harus mengakses URL yang sama. Fungsi backend perlu sudah di-deploy agar pembuatan room dan join bekerja.

## MVP saat ini dan batasan
- Host dan Player menggunakan satu halaman yang beralih berdasarkan peran.
- Multiplayer: PIN 6 digit, lobby, sinkronisasi avatar/posisi.
- Jawaban dikirim saat pemain memasuki platform warna; tidak ada tombol klik jawaban.
- Jawaban disimpan privat selama ronde. Skor diproses server saat ronde ditutup; jawaban benar baru dipublikasikan pada fase reveal.
- Timer ronde diputuskan backend. Anggota room dapat memicu transisi setelah deadline sehingga room tidak bergantung pada host yang selalu online.
- Masih perlu uji integrasi dua perangkat dan uji Rules di Firebase Console. Untuk produksi, tambahkan App Check, limit pembuatan room, validasi rate, pembersihan room lama, dan observability.
- Fase eksplorasi peti/kristal, power-up, obby, dan eliminasi belum termasuk.
