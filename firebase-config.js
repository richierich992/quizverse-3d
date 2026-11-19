// Firebase Web App configuration — QuizVerse (project: quizverse-a5e26).
// Konfigurasi Web app dan URL Realtime Database dari pemilik project.
export const firebaseConfig = {
  apiKey: "AIzaSyC1OiBW-8pXcZ2sUqd94Z0vB0zCiqcQC7E",
  authDomain: "quizverse-a5e26.firebaseapp.com",
  databaseURL: "https://quizverse-a5e26-default-rtdb.firebaseio.com",
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
    firebaseConfig.databaseURL.startsWith("https://")
  );
}
