import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const COLORS = ["#f34f68", "#328df4", "#f4c542", "#27c88b"];
const COLOR_NAMES = ["MERAH", "BIRU", "KUNING", "HIJAU"];
const PAD_POINTS = [
  { x: -7, z: -6 }, { x: 7, z: -6 }, { x: -7, z: 6 }, { x: 7, z: 6 }
];

let app = null, auth = null, db = null, uid = "";
let roomPin = "", isHost = false, questionBank = null;
let activeState = null, playerData = {}, remotePlayers = {}, ownAvatar = null;
let ownPosition = { x: 0, z: 0 }, moveKeys = {}, joystick = { x: 0, y: 0 };
let jumpVelocity = 0, grounded = true, serverOffset = 0;
let stateUnsubscribe = null, playersUnsubscribe = null;
let localAnswerRound = -1, answerBusy = false, scoreBusyRound = -1;
let hostTransitionBusy = false, lastPositionWrite = 0, lastStatusMessage = "";

const serverNow = () => Date.now() + serverOffset;
function status(message, error = false) {
  lastStatusMessage = message;
  $("status").textContent = message;
  $("status").style.color = error ? "#ff9baa" : "";
}
function connection(message, good = false) {
  $("connection").textContent = "● " + message;
  $("connection").style.color = good ? "#68e7ba" : "#f4c982";
}
function showScreen(id) {
  ["roleScreen", "setupScreen", "lobbyScreen", "hud", "endScreen"].forEach((screen) => {
    $(screen).classList.toggle("hidden", screen !== id);
  });
  $("touchControls").classList.toggle("hidden", id !== "hud" || !matchMedia("(pointer: coarse)").matches);
}
function explainError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) {
    return "Firebase menolak akses. Periksa Realtime Database Rules sudah dipasang dari branch Spark.";
  }
  if (code.includes("auth/operation-not-allowed")) return "Anonymous Authentication belum aktif.";
  if (code.includes("network")) return "Koneksi internet terputus. Coba lagi.";
  return error?.message || "Terjadi kesalahan. Silakan coba lagi.";
}

// -------------------- Three.js arena --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#07111f");
scene.fog = new THREE.Fog("#07111f", 30, 78);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 13, 20);
const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight("#bfeaff", "#19283d", 1.9));
const sun = new THREE.DirectionalLight("#ffffff", 2.4);
sun.position.set(-10, 20, 12);
sun.castShadow = true;
scene.add(sun);
const fill = new THREE.PointLight("#3dbcf5", 75, 35);
fill.position.set(10, 8, -10);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(25, 25, 0.55, 64),
  new THREE.MeshStandardMaterial({ color: "#14283b", roughness: 0.82 })
);
floor.position.y = -0.34;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(50, 50, "#315c79", "#1c3953");
grid.position.y = -0.055;
scene.add(grid);

function mat(color, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
function cube(parent, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function labelSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#071522"; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 112, 24); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 112, 24); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "bold 46px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true
  }));
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}
const pads = PAD_POINTS.map((p, index) => {
  const group = new THREE.Group();
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.42, 7.1),
    new THREE.MeshStandardMaterial({
      color: COLORS[index], roughness: 0.42, metalness: 0.08,
      emissive: COLORS[index], emissiveIntensity: 0.18
    })
  );
  platform.position.y = 0.18;
  platform.castShadow = true; platform.receiveShadow = true;
  group.add(platform);
  const tag = labelSprite(String.fromCharCode(65 + index) + " · " + COLOR_NAMES[index], COLORS[index]);
  tag.position.set(0, 1.05, 0);
  group.add(tag);
  group.position.set(p.x, 0, p.z);
  scene.add(group);
  return { ...p, index, group, platform };
});
for (let i = 0; i < 10; i++) {
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28 + (i % 3) * 0.08),
    new THREE.MeshStandardMaterial({ color: i % 2 ? "#41c8ff" : "#9b83ff", emissive: "#2368a2", emissiveIntensity: 0.6 })
  );
  const a = i / 10 * Math.PI * 2;
  crystal.position.set(Math.cos(a) * 19, 1.2 + (i % 3) * 0.3, Math.sin(a) * 19);
  scene.add(crystal);
}

function appearance() {
  const value = (id) => $(id).value;
  return {
    hair: value("hair"), hairColor: value("hairColor"), face: value("face"),
    skin: value("skin"), shirt: value("shirt"), shirtColor: value("shirtColor"),
    pants: value("pants"), pantsColor: value("pantsColor"), hat: value("hat")
  };
}
function createAvatar(a = {}) {
  const g = new THREE.Group();
  const skin = a.skin || "#dfaa7e", shirt = a.shirtColor || "#38bdf8";
  const hair = a.hairColor || "#252b38", pants = a.pantsColor || "#294a70";
  cube(g, 0.86, 0.86, 0.46, shirt, 0, 1.1, 0);
  cube(g, 0.62, 0.62, 0.62, skin, 0, 1.88, 0);
  cube(g, 0.25, 0.77, 0.3, shirt, -0.57, 1.1, 0);
  cube(g, 0.25, 0.77, 0.3, shirt, 0.57, 1.1, 0);
  cube(g, 0.33, a.pants === "shorts" ? 0.52 : 0.72, 0.36, pants, -0.22, 0.39, 0);
  cube(g, 0.33, a.pants === "shorts" ? 0.52 : 0.72, 0.36, pants, 0.22, 0.39, 0);
  cube(g, 0.34, 0.19, 0.46, "#202a38", -0.22, 0.055, 0.01);
  cube(g, 0.34, 0.19, 0.46, "#202a38", 0.22, 0.055, 0.01);
  if (a.shirt === "hoodie") {
    cube(g, 0.48, 0.17, 0.18, shirt, 0, 1.57, 0.2);
    cube(g, 0.1, 0.28, 0.06, "#d8e4ef", 0, 1.17, -0.245);
  } else if (a.shirt === "jersey") {
    cube(g, 0.18, 0.12, 0.035, "#f4f8ff", 0, 1.28, -0.245);
  } else if (a.shirt === "jacket") {
    cube(g, 0.09, 0.85, 0.035, "#dce7f2", 0, 1.1, -0.245);
  }
  if (a.pants === "cargo") {
    cube(g, 0.13, 0.23, 0.08, "#a9b6c2", -0.39, 0.57, 0.2);
    cube(g, 0.13, 0.23, 0.08, "#a9b6c2", 0.39, 0.57, 0.2);
  }
  if (a.hair && a.hair !== "none") {
    cube(g, 0.68, 0.16, 0.68, hair, 0, 2.22, 0);
    if (a.hair === "spiky") {
      for (let i = 0; i < 5; i++) cube(g, 0.13, 0.3, 0.14, hair, -0.25 + i * 0.125, 2.43, 0);
    } else if (["long", "bob"].includes(a.hair)) {
      cube(g, 0.17, 0.62, 0.59, hair, -0.3, 1.92, 0);
      cube(g, 0.17, 0.62, 0.59, hair, 0.3, 1.92, 0);
      if (a.hair === "bob") cube(g, 0.66, 0.16, 0.2, hair, 0, 1.64, 0.08);
    } else if (a.hair === "ponytail") {
      cube(g, 0.2, 0.64, 0.2, hair, 0.32, 1.83, 0.3);
    } else if (["curly", "afro"].includes(a.hair)) {
      const n = a.hair === "afro" ? 12 : 7;
      for (let i = 0; i < n; i++) cube(g, 0.2, 0.2, 0.2, hair, -0.3 + (i % 4) * 0.2, 2.27 + (a.hair === "afro" ? 0.08 : 0), -0.22 + Math.floor(i / 4) * 0.22);
    } else if (a.hair === "sidepart") {
      cube(g, 0.38, 0.13, 0.48, hair, -0.13, 2.31, -0.03);
    }
  }
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.035), mat("#172333"));
  eye.position.set(-0.14, 1.96, -0.33); g.add(eye);
  const eye2 = eye.clone(); eye2.position.x = 0.14; g.add(eye2);
  if (a.face === "cool" || a.face === "nerd") cube(g, 0.25, 0.075, 0.045, "#192c43", 0, 1.96, -0.355);
  if (a.face === "surprised") cube(g, 0.095, 0.12, 0.04, "#6f2732", 0, 1.77, -0.34);
  else cube(g, a.face === "happy" ? 0.22 : 0.16, 0.035, 0.035, "#172333", 0, 1.78, -0.34);
  if (a.hat === "cap" || a.hat === "beanie") cube(g, 0.72, 0.16, 0.7, a.hat === "cap" ? "#e4edf7" : "#e25778", 0, 2.32, 0);
  if (a.hat === "crown") {
    cube(g, 0.5, 0.13, 0.5, "#f2c94c", 0, 2.34, 0);
    for (let i = -1; i <= 1; i++) cube(g, 0.09, 0.2, 0.09, "#ffdc70", i * 0.18, 2.5, 0);
  }
  if (a.hat === "headphones") {
    cube(g, 0.08, 0.38, 0.12, "#263c55", -0.38, 2, 0);
    cube(g, 0.08, 0.38, 0.12, "#263c55", 0.38, 2, 0);
  }
  return g;
}
function setOwnAvatar(a) {
  ownAvatar = a;
  if (playerMesh) scene.remove(playerMesh);
  playerMesh = createAvatar(a);
  playerMesh.position.set(ownPosition.x, 0, ownPosition.z);
  scene.add(playerMesh);
  syncProfile().catch(() => {});
}
let playerMesh = null;
async function ensureFirebase() {
  if (!isFirebaseConfigured()) throw new Error("Konfigurasi Firebase belum lengkap.");
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    onValue(ref(db, ".info/serverTimeOffset"), (s) => { serverOffset = Number(s.val() || 0); });
  }
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = auth.currentUser.uid;
  connection("Firebase Spark terhubung", true);
}
function stopListeners() {
  if (stateUnsubscribe) stateUnsubscribe();
  if (playersUnsubscribe) playersUnsubscribe();
  stateUnsubscribe = playersUnsubscribe = null;
  Object.values(remotePlayers).forEach((p) => scene.remove(p.mesh));
  remotePlayers = {};
}
function dbPath(path) { return ref(db, path); }

async function syncProfile() {
  if (!db || !roomPin || !uid) return;
  await update(dbPath(`rooms/${roomPin}/players/${uid}`), {
    name: $("name").value.trim().slice(0, 18) || "Pemain",
    avatar: ownAvatar
  });
}
function updateRemoteAvatar(id, data) {
  const signature = JSON.stringify(data.avatar || {});
  let entry = remotePlayers[id];
  if (!entry || entry.signature !== signature) {
    if (entry) scene.remove(entry.mesh);
    entry = { mesh: createAvatar(data.avatar || {}), signature };
    remotePlayers[id] = entry;
    scene.add(entry.mesh);
  }
  entry.mesh.position.set(Number(data.x || 0), 0, Number(data.z || 0));
}
function renderPlayers(players) {
  playerData = players || {};
  const entries = Object.entries(playerData);
  $("playerCount").textContent = String(entries.length);
  $("players").textContent = entries.length + " pemain";
  $("roster").replaceChildren();
  entries.forEach(([playerId, person]) => {
    const chip = document.createElement("span");
    chip.textContent = (person.name || "Pemain") + (playerId === uid ? " (Kamu)" : "");
    $("roster").appendChild(chip);
    if (playerId !== uid) updateRemoteAvatar(playerId, person);
  });
  Object.keys(remotePlayers).forEach((id) => {
    if (!playerData[id]) { scene.remove(remotePlayers[id].mesh); delete remotePlayers[id]; }
  });
  const me = playerData[uid];
  if (me) {
    $("score").textContent = String(Number(me.score || 0));
    $("streak").textContent = String(Number(me.streak || 0));
    if (activeState?.phase === "reveal") settleMyScore(activeState).catch(console.warn);
  }
}
function lobbyFromState(state) {
  $("roomPin").textContent = roomPin;
  $("quizName").textContent = state.title || "QuizVerse Quiz";
  $("questionCount").textContent = Number(state.totalQuestions || 0) + " pertanyaan";
  $("roomLabel").textContent = "ROOM " + roomPin;
  $("hostNote").textContent = isHost ? "Kamu adalah host. Mulai saat pemain siap." : "Menunggu host memulai permainan...";
  $("startGame").classList.toggle("hidden", !isHost || state.phase !== "lobby");
}
function subscribeRoom() {
  stopListeners();
  stateUnsubscribe = onValue(dbPath(`rooms/${roomPin}/public`), (snap) => {
    activeState = snap.val();
    if (!activeState) return;
    lobbyFromState(activeState);
    if (activeState.phase === "lobby") {
      showScreen("lobbyScreen");
    } else if (activeState.phase === "question") {
      if (lastQuestionIndex !== Number(activeState.questionIndex)) {
        lastQuestionIndex = Number(activeState.questionIndex);
        localAnswerRound = -1;
        answerBusy = false;
        ownPosition = { x: 0, z: 0 };
        if (playerMesh) playerMesh.position.set(0, 0, 0);
        renderQuestion(activeState);
      }
      showScreen("hud");
    } else if (activeState.phase === "reveal") {
      showScreen("hud");
      $("feedback").textContent = "Jawaban benar: " + String.fromCharCode(65 + Number(activeState.correctOption)) +
        (activeState.explanation ? " · " + activeState.explanation : "");
      $("answers").querySelectorAll("span").forEach((el, index) => {
        el.style.borderColor = index === Number(activeState.correctOption) ? "#79e8b8" : "#25425c";
        el.style.background = index === Number(activeState.correctOption) ? "#154b43" : "#102238";
      });
      settleMyScore(activeState).catch((error) => console.warn("Settle score:", error));
    } else if (activeState.phase === "finished") {
      renderPodium(activeState.podium || []);
      showScreen("endScreen");
    }
  }, (error) => connection("Database: " + error.message, false));

  playersUnsubscribe = onValue(dbPath(`rooms/${roomPin}/players`), (snap) => {
    renderPlayers(snap.val());
  });
}
async function enterLobby() {
  subscribeRoom();
  await onDisconnect(dbPath(`rooms/${roomPin}/players/${uid}/connected`)).set(false);
  showScreen("lobbyScreen");
}

function publicQuestion(q, index, total, duration, title) {
  return {
    phase: "question",
    questionIndex: index,
    totalQuestions: total,
    durationSeconds: duration,
    question: { id: q.id || "q" + index, category: q.category || "Umum", question: q.question, options: q.options },
    deadlineAt: Math.round(serverNow() + duration * 1000),
    title,
    correctOption: null,
    explanation: null,
    revealEndsAt: null
  };
}
function renderQuestion(state) {
  const q = state.question;
  $("category").textContent = String(q.category || "PERTANYAAN").toUpperCase();
  $("question").textContent = q.question || "Pertanyaan";
  $("answers").replaceChildren();
  (q.options || []).forEach((option, index) => {
    const item = document.createElement("span");
    item.textContent = String.fromCharCode(65 + index) + " · " + option;
    item.style.borderBottom = "3px solid " + COLORS[index];
    $("answers").appendChild(item);
  });
  $("roundLabel").textContent = "SOAL " + (Number(state.questionIndex) + 1) + "/" + Number(state.totalQuestions);
  $("feedback").textContent = "Berlari ke platform dengan warna jawabanmu.";
  $("bar").style.width = "100%";
}

async function makeRoom() {
  try {
    if (!questionBank?.questions?.length) throw new Error("Pilih file bank soal JSON terlebih dahulu.");
    await ensureFirebase();
    status("Membuat room...");
    let pin = "";
    for (let i = 0; i < 20; i++) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await get(dbPath(`rooms/${candidate}/meta`));
      if (!existing.exists()) { pin = candidate; break; }
    }
    if (!pin) throw new Error("Tidak berhasil membuat PIN. Coba lagi.");

    roomPin = pin;
    isHost = true;
    ownPosition = { x: 0, z: 0 };
    const title = $("quizTitle").value.trim() || questionBank.title || "QuizVerse Challenge";
    const duration = Math.max(10, Math.min(30, Number($("duration").value || questionBank.durationSeconds || 15)));
    questionBank.questions = questionBank.questions.map((q, index) => ({
      id: String(q.id || "q" + index),
      category: String(q.category || "Umum"),
      question: String(q.question || ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      answerIndex: Number(q.answerIndex),
      explanation: String(q.explanation || "")
    }));

    await set(dbPath(`rooms/${pin}/meta`), {
      hostUid: uid, title, status: "lobby", createdAt: serverNow(), maxPlayers: 40
    });
    const privateQuestions = {};
    questionBank.questions.forEach((q, index) => {
      privateQuestions["q" + index] = { answerIndex: q.answerIndex, explanation: q.explanation };
    });
    await set(dbPath(`answerKeys/${pin}/questions`), privateQuestions);
    await set(dbPath(`rooms/${pin}/public`), {
      phase: "lobby", questionIndex: -1, totalQuestions: questionBank.questions.length,
      durationSeconds: duration, question: { category: "", question: "", options: [] },
      title, deadlineAt: 0
    });
    await createOwnPlayer();
    setOwnAvatar(appearance());
    await enterLobby();
    connection("Host room " + pin, true);
    status("Room siap. Bagikan PIN kepada pemain.");
  } catch (error) {
    status(explainError(error), true);
  }
}

async function createOwnPlayer() {
  const playerRef = dbPath(`rooms/${roomPin}/players/${uid}`);
  const profile = {
    name: $("name").value.trim().slice(0, 18) || (isHost ? "Host" : "Pemain"),
    avatar: appearance(),
    connected: true
  };
  const existing = await get(playerRef);
  if (existing.exists()) {
    // Rejoining preserves the score and scoring cursor; only refresh the profile.
    await update(playerRef, profile);
  } else {
    await set(playerRef, {
      uid, ...profile, x: 0, z: 0, score: 0, streak: 0,
      lastScoredQuestionIndex: -1
    });
  }
}
async function joinRoom() {
  try {
    const pin = $("pin").value.trim();
    if (!/^\d{6}$/.test(pin)) throw new Error("Room PIN harus terdiri dari 6 digit.");
    await ensureFirebase();
    const metaSnap = await get(dbPath(`rooms/${pin}/meta`));
    const meta = metaSnap.val();
    const existingPlayer = await get(dbPath(`rooms/${pin}/players/${uid}`));
    if (!meta || !["lobby", "playing"].includes(meta.status) || (meta.status === "playing" && !existingPlayer.exists())) {
      throw new Error("Room tidak ditemukan, sudah selesai, atau permainan sudah dimulai.");
    }
    roomPin = pin;
    isHost = false;
    ownPosition = { x: 0, z: 0 };
    await createOwnPlayer();
    setOwnAvatar(appearance());
    await enterLobby();
    connection("Bergabung ke room " + roomPin, true);
  } catch (error) {
    status(explainError(error), true);
  }
}
async function startGame() {
  if (!isHost || !questionBank || !roomPin) return;
  try {
    const q = questionBank.questions[0];
    const duration = Number($("duration").value || questionBank.durationSeconds || 15);
    await update(dbPath(`rooms/${roomPin}/meta`), { status: "playing" });
    await set(dbPath(`rooms/${roomPin}/public`), publicQuestion(q, 0, questionBank.questions.length, duration, $("quizTitle").value));
  } catch (error) {
    status(explainError(error), true);
  }
}
async function submitPlatformAnswer(index) {
  if (!roomPin || !activeState || activeState.phase !== "question" || answerBusy) return;
  answerBusy = true;
  localAnswerRound = Number(activeState.questionIndex);
  $("feedback").textContent = "Jawaban terkirim. Menunggu waktu habis...";
  try {
    await set(dbPath(`submissions/${roomPin}/current/${uid}`), {
      questionIndex: localAnswerRound,
      answerIndex: index
    });
    $("feedback").textContent = "Jawaban terkirim. Tunggu pengungkapan hasil.";
  } catch (error) {
    answerBusy = false;
    $("feedback").textContent = explainError(error);
  }
}
async function settleMyScore(state) {
  const round = Number(state.questionIndex);
  if (!db || !roomPin || !uid || scoreBusyRound === round) return;
  const own = playerData[uid];
  if (!own || Number(own.lastScoredQuestionIndex ?? -1) >= round) return;
  scoreBusyRound = round;
  try {
    const answerSnap = await get(dbPath(`submissions/${roomPin}/current/${uid}`));
    const answer = answerSnap.val();
    const hasThisAnswer = answer && Number(answer.questionIndex) === round;
    const correct = Boolean(hasThisAnswer && Number(answer.answerIndex) === Number(state.correctOption));
    const nextScore = Number(own.score || 0) + (correct ? 100 : 0);
    const nextStreak = correct ? Number(own.streak || 0) + 1 : 0;
    await update(dbPath(`rooms/${roomPin}/players/${uid}`), {
      score: nextScore,
      streak: nextStreak,
      lastScoredQuestionIndex: round
    });
    $("feedback").textContent = correct ? "Benar! +100 poin." : "Ronde selesai.";
  } catch (error) {
    scoreBusyRound = -1;
    console.warn("Score update denied:", error);
  }
}
function renderPodium(podium) {
  $("podium").replaceChildren();
  const medals = ["🏆", "🥈", "🥉"];
  if (!podium.length) {
    const p = document.createElement("p"); p.textContent = "Permainan selesai."; $("podium").appendChild(p); return;
  }
  podium.forEach((p, i) => {
    const row = document.createElement("div"); row.className = "podium-item";
    const rank = document.createElement("div"); rank.className = "podium-rank"; rank.textContent = medals[i] || String(i + 1);
    const name = document.createElement("div"); name.className = "podium-name"; name.textContent = p.name || "Pemain";
    const score = document.createElement("div"); score.className = "podium-score"; score.textContent = Number(p.score || 0) + " pts";
    row.append(rank, name, score); $("podium").appendChild(row);
  });
}

// Host's browser is the free-tier round coordinator. Database Rules reject early,
// out-of-order, non-host, and incorrect answer-key transitions.
async function hostAdvance() {
  if (!isHost || !questionBank || !activeState || hostTransitionBusy) return;
  const now = serverNow();
  const round = Number(activeState.questionIndex);
  try {
    if (activeState.phase === "question" && now >= Number(activeState.deadlineAt)) {
      hostTransitionBusy = true;
      const q = questionBank.questions[round];
      await update(dbPath(`rooms/${roomPin}/public`), {
        phase: "reveal",
        correctOption: Number(q.answerIndex),
        explanation: String(q.explanation || ""),
        revealEndsAt: Math.round(now + 3500)
      });
    } else if (activeState.phase === "reveal" && now >= Number(activeState.revealEndsAt)) {
      hostTransitionBusy = true;
      const nextIndex = round + 1;
      if (nextIndex >= questionBank.questions.length) {
        const podium = Object.values(playerData)
          .map((p) => ({ name: p.name || "Pemain", score: Number(p.score || 0) }))
          .sort((a, b) => b.score - a.score).slice(0, 3);
        await update(dbPath(`rooms/${roomPin}/public`), {
          phase: "finished", podium, finishedAt: Math.round(now)
        });
        await update(dbPath(`rooms/${roomPin}/meta`), { status: "finished" });
      } else {
        const q = questionBank.questions[nextIndex];
        const duration = Number($("duration").value || questionBank.durationSeconds || 15);
        await update(dbPath(`rooms/${roomPin}/public`), publicQuestion(q, nextIndex, questionBank.questions.length, duration, $("quizTitle").value));
      }
    }
  } catch (error) {
    console.warn("Host round transition:", error);
    status(explainError(error), true);
  } finally {
    hostTransitionBusy = false;
  }
}

// -------------------- UI setup --------------------
$("chooseHost").addEventListener("click", () => {
  $("hostFields").classList.remove("hidden");
  $("playerFields").classList.add("hidden");
  $("setupEyebrow").textContent = "HOST CONTROL";
  $("setupTitle").textContent = "Buat arena kuis.";
  showScreen("setupScreen");
  status("Pilih bank soal JSON dari perangkatmu.");
});
$("choosePlayer").addEventListener("click", () => {
  $("playerFields").classList.remove("hidden");
  $("hostFields").classList.add("hidden");
  $("setupEyebrow").textContent = "PLAYER SETUP";
  $("setupTitle").textContent = "Siapkan avatarmu.";
  showScreen("setupScreen");
  status("Masukkan PIN yang diberikan host.");
});
$("backRole").addEventListener("click", () => showScreen("roleScreen"));
$("questionFile").addEventListener("change", async (event) => {
  questionBank = null;
  const file = event.target.files?.[0];
  if (!file) { $("fileStatus").textContent = "Belum ada bank soal dipilih."; return; }
  try {
    const parsed = JSON.parse(await file.text());
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions) || !questions.length) throw new Error("Properti questions tidak ditemukan.");
    if (questions.length > 50) throw new Error("Maksimal 50 pertanyaan per room.");
    questionBank = {
      title: String(parsed.title || $("quizTitle").value || "QuizVerse Challenge"),
      durationSeconds: Number(parsed.durationSeconds || 15),
      questions
    };
    $("fileStatus").textContent = "✓ " + file.name + " · " + questions.length + " soal siap divalidasi.";
  } catch (error) {
    $("fileStatus").textContent = "File tidak valid: " + error.message;
  }
});
$("createRoom").addEventListener("click", makeRoom);
$("joinRoom").addEventListener("click", joinRoom);
$("startGame").addEventListener("click", startGame);
$("copyPin").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomPin);
    $("copyPin").textContent = "Tersalin";
    setTimeout(() => $("copyPin").textContent = "Salin", 1200);
  } catch { $("copyPin").textContent = roomPin; }
});
$("returnHome").addEventListener("click", () => {
  stopListeners();
  roomPin = ""; isHost = false; questionBank = null; activeState = null;
  localAnswerRound = -1; scoreBusyRound = -1; hostTransitionBusy = false;
  ownPosition = { x: 0, z: 0 };
  if (playerMesh) playerMesh.position.set(0, 0, 0);
  showScreen("roleScreen");
});
["hair", "hairColor", "face", "skin", "shirt", "shirtColor", "pants", "pantsColor", "hat"].forEach((id) => {
  $(id).addEventListener("change", () => setOwnAvatar(appearance()));
});
$("name").addEventListener("change", () => syncProfile().catch((e) => status(explainError(e), true)));

// -------------------- Movement controls --------------------
function moveInput() {
  const x = (moveKeys.d || moveKeys.ArrowRight ? 1 : 0) - (moveKeys.a || moveKeys.ArrowLeft ? 1 : 0) + joystick.x;
  const z = (moveKeys.s || moveKeys.ArrowDown ? 1 : 0) - (moveKeys.w || moveKeys.ArrowUp ? 1 : 0) + joystick.y;
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len } : { x, z };
}
function movePlayer(dt) {
  if (!playerMesh || activeState?.phase !== "question") return;
  const input = moveInput();
  const speed = 7.2;
  ownPosition.x = THREE.MathUtils.clamp(ownPosition.x + input.x * speed * dt, -21, 21);
  ownPosition.z = THREE.MathUtils.clamp(ownPosition.z + input.z * speed * dt, -21, 21);
  playerMesh.position.x = ownPosition.x;
  playerMesh.position.z = ownPosition.z;
  if (Math.abs(input.x) + Math.abs(input.z) > 0.04) playerMesh.rotation.y = Math.atan2(input.x, input.z);
  if (jumpVelocity !== 0 || !grounded) {
    playerMesh.position.y += jumpVelocity * dt;
    jumpVelocity -= 22 * dt;
    if (playerMesh.position.y <= 0) { playerMesh.position.y = 0; jumpVelocity = 0; grounded = true; }
  }

  if (!answerBusy) {
    for (const pad of pads) {
      if (Math.hypot(ownPosition.x - pad.x, ownPosition.z - pad.z) <= 3.15) {
        submitPlatformAnswer(pad.index);
        break;
      }
    }
  }
  const now = performance.now();
  if (db && roomPin && now - lastPositionWrite > 200) {
    lastPositionWrite = now;
    update(dbPath(`rooms/${roomPin}/players/${uid}`), { x: ownPosition.x, z: ownPosition.z })
      .catch((error) => console.warn("Position sync:", error));
  }
}
function jump() {
  if (grounded && playerMesh) { grounded = false; jumpVelocity = 8.5; }
}
addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  moveKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = true;
  if (event.key === " ") jump();
});
addEventListener("keyup", (event) => {
  moveKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false;
});
$("jump").addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });
const stick = $("stick");
stick.addEventListener("pointerdown", (event) => { stick.setPointerCapture(event.pointerId); updateJoystick(event); });
stick.addEventListener("pointermove", (event) => { if (stick.hasPointerCapture(event.pointerId)) updateJoystick(event); });
stick.addEventListener("pointerup", () => { joystick = { x: 0, y: 0 }; });
stick.addEventListener("pointercancel", () => { joystick = { x: 0, y: 0 }; });
function updateJoystick(event) {
  const r = stick.getBoundingClientRect();
  joystick.x = THREE.MathUtils.clamp((event.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1);
  joystick.y = THREE.MathUtils.clamp((event.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1);
}

// -------------------- Realtime game loop --------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  movePlayer(dt);
  if (activeState?.phase === "question") {
    const left = Math.max(0, (Number(activeState.deadlineAt) - serverNow()) / 1000);
    $("time").textContent = String(Math.ceil(left));
    $("bar").style.width = Math.max(0, left / Number(activeState.durationSeconds || 15) * 100) + "%";
  } else if (activeState?.phase === "reveal") {
    $("time").textContent = "✓";
    $("bar").style.width = "100%";
  }
  if (isHost) hostAdvance();
  if (playerMesh) {
    camera.position.x += (playerMesh.position.x - camera.position.x) * 0.045;
    camera.position.z += (playerMesh.position.z + 19 - camera.position.z) * 0.045;
    camera.lookAt(playerMesh.position.x, 0.7, playerMesh.position.z);
  }
  const t = performance.now() * 0.001;
  pads.forEach((pad, i) => { pad.platform.material.emissiveIntensity = 0.14 + Math.sin(t * 2.2 + i) * 0.07; });
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setOwnAvatar(appearance());
connection("Gratis · Firebase Spark", true);
