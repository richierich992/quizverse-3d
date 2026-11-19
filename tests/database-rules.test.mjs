import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { ref, get, set, update } from "firebase/database";

const projectId = "demo-quizverse";
const rules = readFileSync(new URL("../database.rules.json", import.meta.url), "utf8");
const env = await initializeTestEnvironment({
  projectId,
  database: { rules }
});
const pin = "123456";
const base = `rooms/${pin}`;

function profile(uid, name) {
  return {
    uid, name,
    avatar: {
      hair: "short", hairColor: "#252b38", face: "smile", skin: "#dfaa7e",
      shirt: "tee", shirtColor: "#38bdf8", pants: "jeans", pantsColor: "#294a70", hat: "none"
    },
    x: 0, z: 0, score: 0, streak: 0, lastScoredQuestionIndex: -1, connected: true
  };
}
function questionState(index, q, deadlineAt) {
  return {
    phase: "question", questionIndex: index, totalQuestions: 2, durationSeconds: 10,
    question: { id: q.id, category: q.category, question: q.question, options: q.options },
    deadlineAt, title: "Rules Test"
  };
}

try {
  const host = env.authenticatedContext("host").database();
  const p1 = env.authenticatedContext("player-1").database();
  const p2 = env.authenticatedContext("player-2").database();

  await assertSucceeds(set(ref(host, `${base}/meta`), {
    hostUid: "host", title: "Rules Test", status: "lobby", maxPlayers: 10
  }));
  await assertSucceeds(set(ref(host, `answerKeys/${pin}/questions`), {
    q0: { answerIndex: 1, explanation: "Private key A" },
    q1: { answerIndex: 2, explanation: "Private key B" }
  }));
  await assertSucceeds(set(ref(host, `${base}/public`), {
    phase: "lobby", questionIndex: -1, totalQuestions: 2, durationSeconds: 10,
    question: { category: "", question: "", options: [] }, title: "Rules Test", deadlineAt: 0
  }));
  await assertSucceeds(set(ref(host, `${base}/players/host`), profile("host", "Host")));
  await assertSucceeds(set(ref(p1, `${base}/players/player-1`), profile("player-1", "Player 1")));
  await assertSucceeds(set(ref(p2, `${base}/players/player-2`), profile("player-2", "Player 2")));

  await assertFails(get(ref(p1, `answerKeys/${pin}/questions`)));


  const deadline0 = Date.now() + 5000;
  await assertSucceeds(set(ref(host, `${base}/public`), questionState(0, {
    id: "q0", category: "Test", question: "Question one?", options: ["A", "B", "C", "D"]
  }, deadline0)));

  const submission1 = `submissions/${pin}/current/player-1`;
  const submission2 = `submissions/${pin}/current/player-2`;
  console.log("DEBUG deadline", deadline0, "localNow", Date.now());
  console.log("DEBUG public", JSON.stringify((await get(ref(p1, `${base}/public`))).val()));
  console.log("DEBUG player", JSON.stringify((await get(ref(p1, `${base}/players/player-1`))).val()));
  await assertSucceeds(set(ref(p1, submission1), { questionIndex: 0, answerIndex: 1 }));
  await assertFails(set(ref(p1, submission1), { questionIndex: 0, answerIndex: 0 }));
  await assertSucceeds(get(ref(p1, submission1)));
  await assertFails(get(ref(p1, submission2)));
  await assertFails(update(ref(p1, `${base}/players/player-1`), { score: 999 }));

  await delay(5100);
  await assertFails(update(ref(host, `${base}/public`), {
    phase: "reveal", correctOption: 0, explanation: "Wrong key", revealEndsAt: Date.now() + 100
  }));
  await assertSucceeds(update(ref(host, `${base}/public`), {
    phase: "reveal", correctOption: 1, explanation: "Correct key", revealEndsAt: Date.now() + 150
  }));

  await assertSucceeds(update(ref(p1, `${base}/players/player-1`), {
    score: 100, streak: 1, lastScoredQuestionIndex: 0
  }));
  await assertSucceeds(update(ref(p2, `${base}/players/player-2`), {
    score: 0, streak: 0, lastScoredQuestionIndex: 0
  }));
  await assertFails(update(ref(p1, `${base}/players/player-1`), {
    score: 200, streak: 2, lastScoredQuestionIndex: 0
  }));

  await delay(180);
  const deadline1 = Date.now() + 5000;
  await assertSucceeds(set(ref(host, `${base}/public`), questionState(1, {
    id: "q1", category: "Test", question: "Question two?", options: ["A", "B", "C", "D"]
  }, deadline1)));
  await assertSucceeds(set(ref(p1, submission1), { questionIndex: 1, answerIndex: 2 }));

  await delay(5100);
  await assertSucceeds(update(ref(host, `${base}/public`), {
    phase: "reveal", correctOption: 2, explanation: "Second key", revealEndsAt: Date.now() + 100
  }));
  await assertSucceeds(update(ref(p1, `${base}/players/player-1`), {
    score: 200, streak: 2, lastScoredQuestionIndex: 1
  }));

  console.log("PASS: private keys, one answer per round, deadline, reveal, score validation, and per-round progression.");
} finally {
  await env.cleanup();
}
