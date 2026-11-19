// Firebase Web App configuration — QuizVerse (project: quizverse-a5e26).
// databaseURL wajib diisi dari Firebase Console > Realtime Database setelah database dibuat.
// Firebase Web API key adalah identifier aplikasi, bukan service-account secret.
// Jangan pernah memasukkan service-account JSON / private key ke frontend.
export const firebaseConfig = {
  apiKey: "AIzaSyC1OiBW-8pXcZ2sUqd94Z0vB0zCiqcQC7E",
  authDomain: "quizverse-a5e26.firebaseapp.com",
  databaseURL: "ISI_DATABASE_URL_DARI_FIREBASE_CONSOLE",
  projectId: "quizverse-a5e26",
  storageBucket: "quizverse-a5e26.firebasestorage.app",
  messagingSenderId: "70964517589",
  appId: "1:70964517589:web:0b30a012c9e8b97db0a05c",
  measurementId: "G-WYNYJ7R7R5"
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId === "quizverse-a5e26" &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes("ISI_DATABASE_URL")
  );
}
