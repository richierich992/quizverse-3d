/**
 * Ekspor bank soal dari Google Sheets menjadi file JSON PRIBADI di Google Drive.
 *
 * Buat sheet bernama "Questions" dengan header:
 * ID | Category | Question | Option A | Option B | Option C | Option D | Answer | Explanation | Active
 *
 * Answer diisi A/B/C/D. Active diisi TRUE/FALSE.
 *
 * Jalankan exportPrivateQuestionBank() dari editor Apps Script saat login sebagai admin.
 * File JSON dibuat di My Drive dengan akses privat (tidak dipublikasikan sebagai Web App).
 * Unduh file itu lalu unggah melalui halaman Host QuizVerse.
 */
function exportPrivateQuestionBank() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Questions');
  if (!sheet) throw new Error('Sheet "Questions" tidak ditemukan.');

  var values = sheet.getDataRange().getValues();
  var questions = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var active = row[9] === true || String(row[9]).toUpperCase() === 'TRUE' || row[9] === 1;
    if (!active || !row[2]) continue;

    var answerLetter = String(row[7] || 'A').trim().toUpperCase();
    var answerIndex = ['A', 'B', 'C', 'D'].indexOf(answerLetter);
    if (answerIndex < 0) throw new Error('Kunci jawaban pada baris ' + (i + 1) + ' harus A/B/C/D.');

    var options = [row[3], row[4], row[5], row[6]].map(function(value) {
      return String(value || '').trim();
    });
    if (options.some(function(value) { return !value; })) {
      throw new Error('Empat opsi wajib diisi pada baris ' + (i + 1) + '.');
    }

    questions.push({
      id: String(row[0] || ('q' + i)),
      category: String(row[1] || 'Umum'),
      question: String(row[2]),
      options: options,
      answerIndex: answerIndex,
      explanation: String(row[8] || '')
    });
  }

  if (!questions.length) throw new Error('Tidak ada pertanyaan aktif.');
  if (questions.length > 50) throw new Error('Maksimal 50 pertanyaan per room.');

  var payload = {
    title: SpreadsheetApp.getActiveSpreadsheet().getName(),
    durationSeconds: 15,
    questions: questions
  };
  var fileName = 'QuizVerse-BankSoal-' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '.json';
  var file = DriveApp.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

  Logger.log('Bank soal berhasil dibuat secara privat: ' + file.getUrl());
  Logger.log('Buka file di Google Drive, lalu download sebagai file JSON untuk diunggah oleh Host QuizVerse.');
  Logger.log('Jumlah soal: ' + questions.length);
}
