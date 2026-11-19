import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomInt } from "node:crypto";

// The provided *.firebaseio.com URL belongs to the us-central1 RTDB location.
const REGION = "us-central1";
const DB_URL = "https://quizverse-a5e26-default-rtdb.firebaseio.com";
initializeApp({ databaseURL: DB_URL });
const db = getDatabase();

type QuizQuestion = {
  id: string;
  category: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

function uidOf(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Silakan login terlebih dahulu.");
  return uid;
}
function cleanText(value: unknown, max: number, fallback = ""): string {
  return String(value ?? fallback).trim().slice(0, max);
}
function cleanAvatar(value: any): Record<string, string> {
  const source = value && typeof value === "object" ? value : {};
  const keys = ["hair", "hairColor", "face", "skin", "shirt", "shirtColor", "pants", "pantsColor", "hat"];
  const result: Record<string, string> = {};
  for (const key of keys) result[key] = cleanText(source[key], 32, "default");
  return result;
}
function validateQuestions(value: any): QuizQuestion[] {
  const source = Array.isArray(value) ? value : value?.questions;
  if (!Array.isArray(source) || source.length < 1 || source.length > 50) {
    throw new HttpsError("invalid-argument", "Bank soal harus berisi 1–50 pertanyaan.");
  }
  return source.map((item: any, index: number) => {
    const question = cleanText(item?.question, 400);
    const options = Array.isArray(item?.options) ? item.options.map((v: unknown) => cleanText(v, 160)) : [];
    const answerIndex = Number(item?.answerIndex);
    if (!question || options.length !== 4 || options.some((v: string) => !v) ||
        !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      throw new HttpsError("invalid-argument", `Pertanyaan nomor ${index + 1} tidak valid. Harus ada teks, 4 pilihan, dan answerIndex 0–3.`);
    }
    return {
      id: cleanText(item?.id, 50, `q${index + 1}`),
      category: cleanText(item?.category, 60, "Umum"),
      question,
      options,
      answerIndex,
      explanation: cleanText(item?.explanation, 500)
    };
  });
}
function publicQuestion(question: QuizQuestion) {
  return { id: question.id, category: question.category, question: question.question, options: question.options };
}
function requireHost(meta: any, uid: string) {
  if (!meta || meta.hostUid !== uid) throw new HttpsError("permission-denied", "Hanya host yang dapat menjalankan perintah ini.");
}
function makePublicQuestion(question: QuizQuestion, index: number, total: number, durationSeconds: number, now: number) {
  return {
    phase: "question",
    questionIndex: index,
    totalQuestions: total,
    durationSeconds,
    question: publicQuestion(question),
    deadlineAt: now + durationSeconds * 1000,
    revealEndsAt: null,
    correctOption: null,
    explanation: null,
    updatedAt: now
  };
}

// Host submits its selected question bank once. Full answer keys are written only
// under /privateRooms; clients cannot read or write that path via database.rules.json.
export const createRoom = onCall({ region: REGION, maxInstances: 5 }, async (request) => {
  const uid = uidOf(request);
  const data = request.data ?? {};
  const questions = validateQuestions(data.questions);
  const name = cleanText(data.name, 18, "Host") || "Host";
  const avatar = cleanAvatar(data.avatar);
  const title = cleanText(data.title, 80, "QuizVerse Quiz") || "QuizVerse Quiz";
  const durationSeconds = Math.max(10, Math.min(30, Number(data.durationSeconds) || 15));

  let roomPin = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = String(randomInt(100000, 1000000));
    const existing = await db.ref(`rooms/${candidate}/meta`).get();
    if (!existing.exists()) { roomPin = candidate; break; }
  }
  if (!roomPin) throw new HttpsError("resource-exhausted", "Tidak berhasil membuat PIN. Coba lagi.");

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  updates[`rooms/${roomPin}/meta`] = {
    hostUid: uid, title, status: "lobby", createdAt: now, maxPlayers: 40
  };
  updates[`rooms/${roomPin}/public`] = {
    phase: "lobby", title, questionIndex: -1, totalQuestions: questions.length,
    durationSeconds, question: null, deadlineAt: null, correctOption: null, explanation: null,
    updatedAt: now
  };
  updates[`rooms/${roomPin}/players/${uid}`] = {
    uid, name, avatar, x: 0, z: 0, score: 0, streak: 0, connected: true, hasAnswered: false
  };
  updates[`privateRooms/${roomPin}`] = {
    hostUid: uid, questions, durationSeconds, createdAt: now,
    rounds: { "0": { locked: false, answers: {} } }
  };
  await db.ref().update(updates);
  return { roomPin, title, totalQuestions: questions.length };
});

export const joinRoom = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const uid = uidOf(request);
  const data = request.data ?? {};
  const pin = cleanText(data.roomPin, 6);
  if (!/^\\d{6}$/.test(pin)) throw new HttpsError("invalid-argument", "PIN harus 6 digit.");
  const roomRef = db.ref(`rooms/${pin}`);
  const [metaSnap, playersSnap] = await Promise.all([roomRef.child("meta").get(), roomRef.child("players").get()]);
  const meta = metaSnap.val();
  if (!meta || meta.status !== "lobby") throw new HttpsError("not-found", "Room tidak ditemukan atau sudah dimulai.");
  const players = playersSnap.val() ?? {};
  if (!players[uid] && Object.keys(players).length >= Number(meta.maxPlayers || 40)) {
    throw new HttpsError("resource-exhausted", "Room sudah penuh.");
  }
  const playerRef = roomRef.child(`players/${uid}`);
  await playerRef.transaction((current) => ({
    ...(current ?? { score: 0, streak: 0, x: 0, z: 0, hasAnswered: false }),
    uid,
    name: cleanText(data.name, 18, "Pemain") || "Pemain",
    avatar: cleanAvatar(data.avatar),
    connected: true
  }));
  return { roomPin: pin, title: meta.title };
});

export const startGame = onCall({ region: REGION, maxInstances: 5 }, async (request) => {
  const uid = uidOf(request);
  const pin = cleanText(request.data?.roomPin, 6);
  const roomRef = db.ref(`rooms/${pin}`);
  const [metaSnap, privateSnap, playersSnap, stateSnap] = await Promise.all([
    roomRef.child("meta").get(), db.ref(`privateRooms/${pin}`).get(),
    roomRef.child("players").get(), roomRef.child("public").get()
  ]);
  const meta = metaSnap.val();
  requireHost(meta, uid);
  const privateRoom = privateSnap.val();
  if (!privateRoom?.questions?.length) throw new HttpsError("failed-precondition", "Bank soal tidak ditemukan.");
  if (stateSnap.val()?.phase !== "lobby") throw new HttpsError("failed-precondition", "Permainan sudah dimulai.");
  const question = privateRoom.questions[0] as QuizQuestion;
  const duration = Number(privateRoom.durationSeconds || 15);
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`rooms/${pin}/meta/status`]: "playing",
    [`rooms/${pin}/public`]: {
      ...makePublicQuestion(question, 0, privateRoom.questions.length, duration, now),
      title: meta.title
    }
  };
  for (const playerId of Object.keys(playersSnap.val() ?? {})) {
    updates[`rooms/${pin}/players/${playerId}/hasAnswered`] = false;
  }
  await db.ref().update(updates);
  return { started: true };
});

// Answers are held in a server-only round node. The same transaction path is
// used to lock the round at the deadline, preventing late submissions racing the timer.
export const submitAnswer = onCall({ region: REGION, maxInstances: 20 }, async (request) => {
  const uid = uidOf(request);
  const pin = cleanText(request.data?.roomPin, 6);
  const answerIndex = Number(request.data?.answerIndex);
  if (!/^\\d{6}$/.test(pin) || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    throw new HttpsError("invalid-argument", "Jawaban tidak valid.");
  }
  const roomRef = db.ref(`rooms/${pin}`);
  const [stateSnap, privateSnap, playerSnap] = await Promise.all([
    roomRef.child("public").get(), db.ref(`privateRooms/${pin}`).get(),
    roomRef.child(`players/${uid}`).get()
  ]);
  const state = stateSnap.val();
  const privateRoom = privateSnap.val();
  if (!playerSnap.exists()) throw new HttpsError("permission-denied", "Kamu belum bergabung dengan room.");
  if (!state || state.phase !== "question") throw new HttpsError("failed-precondition", "Pertanyaan tidak sedang aktif.");
  if (Date.now() > Number(state.deadlineAt)) throw new HttpsError("deadline-exceeded", "Waktu menjawab sudah habis.");
  const questionIndex = Number(state.questionIndex);
  const question = privateRoom?.questions?.[questionIndex] as QuizQuestion | undefined;
  if (!question) throw new HttpsError("not-found", "Pertanyaan tidak ditemukan.");

  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((Number(state.deadlineAt) - now) / 1000));
  const roundRef = db.ref(`privateRooms/${pin}/rounds/${questionIndex}`);
  const answerTx = await roundRef.transaction((current) => {
    if (!current || current.locked === true) return;
    const answers = current.answers ?? {};
    if (answers[uid]) return;
    return {
      ...current,
      answers: {
        ...answers,
        [uid]: {
          answerIndex,
          isCorrect: answerIndex === question.answerIndex,
          remainingSeconds,
          submittedAt: now
        }
      }
    };
  });
  if (!answerTx.committed) {
    const latest = (await roomRef.child("public").get()).val();
    if (!latest || latest.phase !== "question" || Date.now() > Number(latest.deadlineAt)) {
      throw new HttpsError("deadline-exceeded", "Waktu menjawab sudah habis.");
    }
    throw new HttpsError("already-exists", "Jawaban sudah dikirim.");
  }
  return { accepted: true };
});

// Any room member may advance only after the authoritative deadline.
// The round node is atomically locked before scores are settled, so a submission
// cannot slip in after the server closes the timer.
export const advanceGame = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const uid = uidOf(request);
  const pin = cleanText(request.data?.roomPin, 6);
  const roomRef = db.ref(`rooms/${pin}`);
  const [playerSnap, stateSnap, privateSnap, playersSnap] = await Promise.all([
    roomRef.child(`players/${uid}`).get(), roomRef.child("public").get(),
    db.ref(`privateRooms/${pin}`).get(), roomRef.child("players").get()
  ]);
  if (!playerSnap.exists()) throw new HttpsError("permission-denied", "Kamu bukan anggota room.");
  const state = stateSnap.val();
  const privateRoom = privateSnap.val();
  const questions = privateRoom?.questions as QuizQuestion[] | undefined;
  if (!state || !questions?.length) throw new HttpsError("not-found", "Game tidak ditemukan.");
  const publicRef = roomRef.child("public");

  if (state.phase === "question" && Date.now() >= Number(state.deadlineAt)) {
    const questionIndex = Number(state.questionIndex);
    const roundRef = db.ref(`privateRooms/${pin}/rounds/${questionIndex}`);
    await roundRef.transaction((current) => {
      if (!current) return { locked: true, answers: {} };
      if (current.locked === true) return current;
      return { ...current, locked: true };
    });
    const closeAt = Date.now();
    await publicRef.transaction((current) => {
      if (!current || current.phase !== "question" || closeAt < Number(current.deadlineAt)) return;
      return { ...current, phase: "scoring", scoringStartedAt: closeAt, updatedAt: closeAt };
    });
  }

  let latestState = (await publicRef.get()).val();
  if (latestState?.phase === "scoring") {
    const questionIndex = Number(latestState.questionIndex);
    const question = questions[questionIndex];
    if (!question) throw new HttpsError("not-found", "Pertanyaan tidak ditemukan.");
    const [roundSnap, freshPlayersSnap] = await Promise.all([
      db.ref(`privateRooms/${pin}/rounds/${questionIndex}`).get(),
      roomRef.child("players").get()
    ]);
    const answers = roundSnap.val()?.answers ?? {};
    const players = freshPlayersSnap.val() ?? {};

    // Per-player transaction is idempotent. If a function invocation retries,
    // lastScoredQuestionIndex prevents awarding the same round twice.
    await Promise.all(Object.keys(players).map(async (playerId) => {
      const answer = answers[playerId];
      const playerRef = roomRef.child(`players/${playerId}`);
      await playerRef.transaction((current) => {
        if (!current || Number(current.lastScoredQuestionIndex ?? -1) >= questionIndex) return;
        const wasCorrect = Boolean(answer?.isCorrect);
        const currentStreak = Number(current.streak || 0);
        const points = wasCorrect
          ? 100 + Math.max(0, Number(answer.remainingSeconds || 0)) * 5 + Math.min(currentStreak, 10) * 10
          : 0;
        current.score = Number(current.score || 0) + points;
        current.streak = wasCorrect ? currentStreak + 1 : 0;
        current.lastScoredQuestionIndex = questionIndex;
        current.hasAnswered = Boolean(answer);
        return current;
      });
    }));

    const revealAt = Date.now();
    await publicRef.transaction((current) => {
      if (!current || current.phase !== "scoring" || Number(current.questionIndex) !== questionIndex) return;
      return {
        ...current,
        phase: "reveal",
        correctOption: question.answerIndex,
        explanation: question.explanation || "",
        revealEndsAt: revealAt + 3500,
        updatedAt: revealAt
      };
    });
    latestState = (await publicRef.get()).val();
  }

  if (latestState?.phase === "reveal" && Date.now() >= Number(latestState.revealEndsAt)) {
    const nextIndex = Number(latestState.questionIndex) + 1;
    if (nextIndex >= questions.length) {
      const freshPlayers = (await roomRef.child("players").get()).val() ?? {};
      const podium = Object.values(freshPlayers)
        .map((p: any) => ({ name: cleanText(p.name, 18, "Pemain"), score: Number(p.score || 0) }))
        .sort((a, b) => b.score - a.score).slice(0, 3);
      await publicRef.transaction((current) => {
        if (!current || current.phase !== "reveal" || Date.now() < Number(current.revealEndsAt)) return;
        return { ...current, phase: "finished", podium, finishedAt: Date.now(), updatedAt: Date.now() };
      });
      const finalState = (await publicRef.get()).val();
      if (finalState?.phase === "finished") await roomRef.child("meta/status").set("finished");
      latestState = finalState;
    } else {
      const nextRoundRef = db.ref(`privateRooms/${pin}/rounds/${nextIndex}`);
      await nextRoundRef.transaction((current) => current ?? { locked: false, answers: {} });
      const nextAt = Date.now();
      await publicRef.transaction((current) => {
        if (!current || current.phase !== "reveal" || Date.now() < Number(current.revealEndsAt)) return;
        return {
          ...makePublicQuestion(questions[nextIndex], nextIndex, questions.length,
            Number(privateRoom.durationSeconds || 15), nextAt),
          title: current.title || "QuizVerse Quiz"
        };
      });
      latestState = (await publicRef.get()).val();
      if (latestState?.phase === "question") {
        const reset: Record<string, boolean> = {};
        const freshPlayers = (await roomRef.child("players").get()).val() ?? {};
        for (const playerId of Object.keys(freshPlayers)) reset[`rooms/${pin}/players/${playerId}/hasAnswered`] = false;
        if (Object.keys(reset).length) await db.ref().update(reset);
      }
    }
  }
  return { phase: latestState?.phase || state.phase, advanced: latestState?.phase !== state.phase };
});

