/**
 * Endpoint contoh untuk menyajikan bank soal dari Google Sheets.
 * Sheet: Questions
 * Header: ID | Category | Question | Option A | Option B | Option C | Option D | Answer | Explanation | Active
 * Answer diisi A/B/C/D. Active diisi TRUE/FALSE.
 */
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Questions');
  if (!sheet) return jsonOutput({ error: 'Sheet "Questions" tidak ditemukan.' });

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return jsonOutput({ version: 1, title: 'Bank Soal', durationSeconds: 15, questions: [] });
  }

  var questions = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var active = row[9] === true || String(row[9]).toUpperCase() === 'TRUE' || row[9] === 1;
    if (!active || !row[2]) continue;

    var answerLetter = String(row[7] || 'A').trim().toUpperCase();
    var answerIndex = ['A', 'B', 'C', 'D'].indexOf(answerLetter);
    if (answerIndex < 0) answerIndex = 0;

    questions.push({
      id: String(row[0] || ('q' + i)),
      category: String(row[1] || 'Umum'),
      question: String(row[2]),
      options: [String(row[3] || ''), String(row[4] || ''), String(row[5] || ''), String(row[6] || '')],
      answerIndex: answerIndex,
      explanation: String(row[8] || '')
    });
  }
  return jsonOutput({ version: 1, title: 'Bank Soal', durationSeconds: 15, questions: questions });
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
