# QuizVerse 3D — Free Spark MVP

Game kuis edukasi 3D berbasis browser. Client menggunakan Three.js, Firebase Anonymous Authentication, dan Firebase Realtime Database pada **Spark plan**. Tidak memakai Cloud Functions atau layanan Firebase yang memerlukan upgrade billing.

## Arsitektur Spark
- **Host** memilih bank soal JSON, membuat Room PIN, memegang alur kuis, dan menjaga tab Host tetap terbuka sampai permainan selesai.
- **Player** memasukkan PIN, memilih avatar, bergerak di arena, dan mengirim jawaban dengan memasuki platform warna.
- **Realtime Database** menyimpan room, soal aktif yang sudah disanitasi (tanpa kunci), posisi/avatar, jawaban pribadi, dan skor.
- **Realtime Database Security Rules** menyembunyikan answer keys, hanya menerima satu jawaban per pemain per ronde sebelum deadline, serta memvalidasi perubahan skor terhadap kunci jawaban tersembunyi. Pemeriksaan aturan terjadi di Firebase, bukan hanya di JavaScript client.

**Catatan model free:** tidak ada Cloud Functions. Browser Host bertindak sebagai pengatur pergantian ronde. Jika tab Host ditutup atau koneksi Host putus, timer tidak akan otomatis memajukan ronde berikutnya. Buka game dari browser Host di komputer/proyektor dan biarkan tab itu tetap aktif selama sesi.

## File penting
- `index.html`, `style.css`, `main.js`: UI Host/Player dan arena Three.js.
- `firebase-config.js`: konfigurasi Web app QuizVerse.
- `database.rules.json`: rules Spark untuk memisahkan room publik, answer keys privat, dan submission per pemilik.
- `admin/Code.gs`: ekspor bank soal Google Sheets menjadi file JSON privat di Google Drive.
- `firebase.json` dan `.firebaserc`: opsi deploy Rules melalui Firebase CLI.

## Firebase project
Project: `quizverse-a5e26`

Realtime Database URL: `https://quizverse-a5e26-default-rtdb.firebaseio.com`

Anonymous Authentication harus aktif:
Firebase Console → Authentication → Sign-in method → Anonymous → Enable.

## Pasang Security Rules
1. Buka Firebase Console → Realtime Database → tab **Rules**.
2. Buka file `database.rules.json` pada repository ini.
3. Salin seluruh isinya ke editor Rules Firebase.
4. Klik **Publish**.

Jangan memakai Rules lama yang memberikan izin menulis ke seluruh node room. Rules baru perlu dipublikasikan sebelum mencoba membuat room.

Opsional, deploy Rules dari komputer dengan Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database --project quizverse-a5e26
```

## Bank soal
Host memilih file JSON di panel Host. Format yang diterima:
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
`answerIndex`: A=0, B=1, C=2, D=3. Maksimal 50 pertanyaan per room, masing-masing berisi empat opsi.

Ketika Host membuat room, hanya teks soal dan opsi yang dipublikasikan ke room. Kunci jawaban dan penjelasan disimpan di path `answerKeys` yang tidak bisa dibaca oleh client. Pilihan pemain disimpan di path `submissions` yang hanya bisa dibaca oleh pemilik jawaban. Rules menggunakan data privat itu untuk memvalidasi skor.

### Dari Google Sheets
1. Buat sheet `Questions` dengan kolom:
   `ID | Category | Question | Option A | Option B | Option C | Option D | Answer | Explanation | Active`.
2. Buka Extensions → Apps Script.
3. Tempel isi `admin/Code.gs`.
4. Jalankan `exportPrivateQuestionBank()` saat login sebagai admin.
5. Apps Script membuat file JSON privat di Google Drive. Unduh file tersebut, lalu unggah dari panel Host.

Jangan menerbitkan endpoint publik yang mengirim answer key ke browser pemain.

## GitHub Pages

Workflow deployment sudah tersedia di `.github/workflows/deploy.yml`. Workflow menerbitkan situs statis dari branch `feature/server-authoritative-quiz` untuk pengujian dan dari `main` setelah perubahan di-merge.

**Aktifkan Pages satu kali sebelum deployment pertama:**
1. Buka repository GitHub → **Settings** → **Pages**.
2. Pada **Build and deployment → Source**, pilih **GitHub Actions** (bukan Deploy from a branch).
3. Simpan pengaturan bila diminta. Push berikutnya ke branch fitur atau `main` akan menjalankan workflow deployment.
4. Buka tab **Actions** → workflow **Deploy QuizVerse to GitHub Pages** untuk melihat hasil dan URL situs. Jika workflow pertama kali gagal karena Pages belum diaktifkan, setelah mengubah Source ke GitHub Actions jalankan ulang job yang gagal.

Saat PR fitur di-merge ke `main`, workflow otomatis menerbitkan versi `main`. Jangan menambahkan proteksi environment `github-pages` yang hanya mengizinkan `main` sebelum pengujian branch fitur selesai.

Di Firebase Authentication → Settings → Authorized domains, pastikan `richierich992.github.io` ditambahkan. Rules Realtime Database harus sudah dipublikasikan sebelum membuat room.

## Menjalankan lokal
```bash
python -m http.server 8000
```
Buka http://localhost:8000. Host dan semua pemain harus membuka URL yang sama.

## Kuota Spark dan batasan
Firebase Spark tidak memerlukan payment method untuk mulai digunakan. Realtime Database Spark menyediakan 1 GB penyimpanan, 10 GB download/bulan, dan maksimal 100 koneksi bersamaan. Angka ini merupakan batas paket dan perlu dipantau saat digunakan banyak pemain. Referensi: https://firebase.google.com/pricing/ dan https://firebase.google.com/docs/database/usage/limits

- Game menggunakan polling realtime Firebase untuk posisi avatar; batasi jumlah pemain dan frekuensi update supaya kuota download tidak cepat habis.
- Host wajib tetap online untuk memajukan timer dan ronde.
- Rules melakukan validasi server-side untuk submission dan skor, tetapi Host tetap dipercaya untuk memilih isi kuis dan memulai/transisi ronde. Jangan gunakan desain ini untuk ujian berisiko tinggi atau kompetisi berhadiah.
- GitHub Actions sudah menguji Rules di Firebase Emulator: kunci privat, jawaban ganda, jawaban setelah deadline, reveal, skor/streak sah, perubahan skor palsu, serta larangan pemain baru masuk setelah game dimulai. Uji browser dua perangkat dan integrasi ke project Firebase asli masih perlu dilakukan.
- Fase peti/kristal, power-up, obby, eliminasi penuh, serta admin bank soal berbasis web belum termasuk MVP.
