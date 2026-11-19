import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const COLORS = ["#f34f68", "#328df4", "#f4c542", "#27c88b"];
const COLOR_NAMES = ["MERAH", "BIRU", "KUNING", "HIJAU"];
const PAD_POINTS = [
  { x: -7, z: -6 }, { x: 7, z: -6 }, { x: -7, z: 6 }, { x: 7, z: 6 }
];

let firebaseApp = null, auth = null, db = null, functions = null, uid = "";
let roomPin = "", isHost = false, setupMode = "player", questionBank = null;
let ownPlayer = null, activeState = null, lastQuestionIndex = -2, lastAdvanceKey = "";
let hasAnswered = false, lastPositionWrite = 0, lastHudPhase = "";
let stateUnsubscribe = null, playersUnsubscribe = null, remotePlayers = {};
let moveKeys = {}, joystick = { x: 0, y: 0 }, jumpVelocity = 0, grounded = true;
let currentPosition = { x: 0, z: 0 }, currentAvatar = {};
let lastError = "";

// ---------- Three.js world ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#07111f");
scene.fog = new THREE.Fog("#07111f", 30, 78);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 13, 20);
const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight("#bfeaff", "#19283d", 1.9));
const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
keyLight.position.set(-10, 20, 12);
keyLight.castShadow = true;
scene.add(keyLight);
const fillLight = new THREE.PointLight("#3dbcf5", 75, 35);
fillLight.position.set(10, 8, -10);
scene.add(fillLight);

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

function material(color, roughness = 0.72, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function cube(parent, w, h, d, color, x, y, z, roughness = 0.72) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, roughness));
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
  ctx.fillStyle = "#071522";
  ctx.globalAlpha = 0.88;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 112, 24); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 112, 24); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}
const pads = [];
PAD_POINTS.forEach((point, index) => {
  const group = new THREE.Group();
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.42, 7.1),
    new THREE.MeshStandardMaterial({
      color: COLORS[index], roughness: 0.42, metalness: 0.08,
      emissive: COLORS[index], emissiveIntensity: 0.18
    })
  );
  platform.position.y = 0.18;
  platform.receiveShadow = true;
  platform.castShadow = true;
  group.add(platform);
  const label = labelSprite(String.fromCharCode(65 + index) + "  " + COLOR_NAMES[index], COLORS[index]);
  label.position.set(0, 1.0, 0);
  group.add(label);
  group.position.set(point.x, 0, point.z);
  scene.add(group);
  pads.push({ ...point, group, platform, index });
});
for (let i = 0; i < 10; i++) {
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28 + (i % 3) * 0.08),
    new THREE.MeshStandardMaterial({ color: i % 2 ? "#41c8ff" : "#9b83ff", emissive: "#2368a2", emissiveIntensity: 0.6, metalness: 0.3 })
  );
  const angle = i / 10 * Math.PI * 2;
  crystal.position.set(Math.cos(angle) * 19, 1.2 + (i % 3) * 0.3, Math.sin(angle) * 19);
  scene.add(crystal);
}

function getAppearance() {
  const value = (id) => $(id).value;
  return {
    hair: value("hair"), hairColor: value("hairColor"), face: value("face"),
    skin: value("skin"), shirt: value("shirt"), shirtColor: value("shirtColor"),
    pants: value("pants"), pantsColor: value("pantsColor"), hat: value("hat")
  };
}
function avatarSignature(avatar) { return JSON.stringify(avatar || {}); }

function createAvatar(appearance) {
  const a = appearance || {};
  const g = new THREE.Group();
  const skin = a.skin || "#dfaa7e";
  const shirtColor = a.shirtColor || "#38bdf8";
  const hairColor = a.hairColor || "#252b38";
  const pantsColor = a.pantsColor || "#294a70";
  const dark = "#202a38";

  // Body and head: deliberately blocky, with slightly varied clothing silhouettes.
  cube(g, 0.86, 0.86, 0.46, shirtColor, 0, 1.1, 0);
  cube(g, 0.62, 0.62, 0.62, skin, 0, 1.88, 0);
  cube(g, 0.25, 0.77, 0.3, shirtColor, -0.57, 1.1, 0);
  cube(g, 0.25, 0.77, 0.3, shirtColor, 0.57, 1.1, 0);
  cube(g, 0.33, a.pants === "shorts" ? 0.52 : 0.72, 0.36, pantsColor, -0.22, 0.39, 0);
  cube(g, 0.33, a.pants === "shorts" ? 0.52 : 0.72, 0.36, pantsColor, 0.22, 0.39, 0);
  cube(g, 0.34, 0.19, 0.46, dark, -0.22, 0.055, 0.01);
  cube(g, 0.34, 0.19, 0.46, dark, 0.22, 0.055, 0.01);

  if (a.shirt === "hoodie") {
    cube(g, 0.48, 0.17, 0.18, shirtColor, 0, 1.57, 0.2);
    cube(g, 0.1, 0.28, 0.06, "#d8e4ef", 0, 1.17, -0.245);
  } else if (a.shirt === "jersey") {
    cube(g, 0.18, 0.12, 0.035, "#f4f8ff", 0, 1.28, -0.245);
  } else if (a.shirt === "jacket") {
    cube(g, 0.09, 0.85, 0.035, "#dce7f2", 0, 1.1, -0.245);
    cube(g, 0.28, 0.15, 0.04, dark, -0.24, 1.38, -0.25);
    cube(g, 0.28, 0.15, 0.04, dark, 0.24, 1.38, -0.25);
  }
  if (a.pants === "cargo") {
    cube(g, 0.13, 0.23, 0.08, "#a9b6c2", -0.39, 0.57, 0.2);
    cube(g, 0.13, 0.23, 0.08, "#a9b6c2", 0.39, 0.57, 0.2);
  }
  if (a.pants === "jogger") {
    cube(g, 0.34, 0.1, 0.38, dark, -0.22, 0.12, 0);
    cube(g, 0.34, 0.1, 0.38, dark, 0.22, 0.12, 0);
  }

  // Hair silhouettes.
  if (a.hair && a.hair !== "none") {
    cube(g, 0.68, 0.16, 0.68, hairColor, 0, 2.22, 0);
    if (a.hair === "spiky") {
      for (let i = 0; i < 5; i++) cube(g, 0.13, 0.3, 0.14, hairColor, -0.25 + i * 0.125, 2.43, 0);
    } else if (a.hair === "long" || a.hair === "bob") {
      cube(g, 0.17, a.hair === "bob" ? 0.44 : 0.66, 0.59, hairColor, -0.3, 1.91, 0);
      cube(g, 0.17, a.hair === "bob" ? 0.44 : 0.66, 0.59, hairColor, 0.3, 1.91, 0);
      if (a.hair === "bob") cube(g, 0.66, 0.16, 0.2, hairColor, 0, 1.64, 0.08);
    } else if (a.hair === "ponytail") {
      cube(g, 0.2, 0.64, 0.2, hairColor, 0.32, 1.83, 0.3);
    } else if (a.hair === "curly" || a.hair === "afro") {
      const count = a.hair === "afro" ? 12 : 7;
      for (let i = 0; i < count; i++) {
        const x = -0.3 + (i % 4) * 0.2;
        const z = -0.22 + Math.floor(i / 4) * 0.22;
        cube(g, 0.2, 0.2, 0.2, hairColor, x, 2.27 + (a.hair === "afro" ? 0.08 : 0), z);
      }
    } else if (a.hair === "sidepart") {
      cube(g, 0.38, 0.13, 0.48, hairColor, -0.13, 2.31, -0.03);
    }
  }

  // Facial expressions are built from visible block shapes, not external images.
  const eyeMat = material("#172333");
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.035), eyeMat);
  eyeL.position.set(-0.14, 1.96, -0.33); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.14; g.add(eyeR);
  if (a.face === "cool" || a.face === "nerd") {
    cube(g, 0.25, 0.075, 0.045, "#192c43", 0, 1.96, -0.355);
    if (a.face === "nerd") {
      cube(g, 0.2, 0.035, 0.035, "#d9edff", 0, 1.92, -0.38);
    }
  }
  if (a.face === "surprised") cube(g, 0.095, 0.12, 0.04, "#6f2732", 0, 1.77, -0.34);
  else if (a.face === "serious") cube(g, 0.2, 0.035, 0.035, "#172333", 0, 1.77, -0.34);
  else if (a.face === "wink") cube(g, 0.12, 0.035, 0.035, "#172333", 0.13, 1.78, -0.34);
  else cube(g, a.face === "happy" ? 0.22 : 0.16, 0.035, 0.035, "#172333", 0, 1.78, -0.34);

  // Accessories.
  if (a.hat === "cap") {
    cube(g, 0.72, 0.16, 0.7, "#e4edf7", 0, 2.32, 0);
    cube(g, 0.48, 0.06, 0.34, "#e4edf7", 0, 2.27, -0.32);
  } else if (a.hat === "beanie") {
    cube(g, 0.7, 0.23, 0.68, "#e25778", 0, 2.32, 0);
  } else if (a.hat === "crown") {
    cube(g, 0.5, 0.13, 0.5, "#f2c94c", 0, 2.34, 0);
    for (let i = -1; i <= 1; i++) cube(g, 0.09, 0.2, 0.09, "#ffdc70", i * 0.18, 2.5, 0);
  } else if (a.hat === "headphones") {
    cube(g, 0.08, 0.38, 0.12, "#263c55", -0.38, 2.0, 0);
    cube(g, 0.08, 0.38, 0.12, "#263c55", 0.38, 2.0, 0);
    cube(g, 0.08, 0.12, 0.12, "#5ad9ff", -0.38, 1.98, -0.08);
    cube(g, 0.08, 0.12, 0.12, "#5ad9ff", 0.38, 1.98, -0.08);
  }
  g.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
  return g;
}

function setOwnAvatar(appearance) {
  currentAvatar = appearance;
  if (ownPlayer) scene.remove(ownPlayer);
  ownPlayer = createAvatar(appearance);
  ownPlayer.position.set(currentPosition.x, 0, currentPosition.z);
  scene.add(ownPlayer);
  syncPlayerProfile().catch(() => {});
}
async function syncPlayerProfile() {
  if (!db || !roomPin || !uid) return;
  await update(ref(db, `rooms/${roomPin}/players/${uid}`), {
    name: $("name").value.trim().slice(0, 18) || "Pemain",
    avatar: currentAvatar
  });
}

// ---------- Screen and Firebase helpers ----------
function showScreen(id) {
  ["roleScreen", "setupScreen", "lobbyScreen", "hud", "endScreen"].forEach((screenId) => {
    $(screenId).classList.toggle("hidden", screenId !== id);
  });
  $("touchControls").classList.toggle("hidden", id !== "hud" || !matchMedia("(pointer: coarse)").matches);
}
function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").style.color = isError ? "#ff9baa" : "";
}
function setConnection(message, good = false) {
  $("connection").textContent = (good ? "● " : "● ") + message;
  $("connection").style.color = good ? "#68e7ba" : "#f4c982";
}
function firebaseError(error) {
  const code = error?.code || "";
  if (code.includes("functions/not-found")) return "Room tidak ditemukan atau sudah dimulai.";
  if (code.includes("functions/permission-denied")) return "Akses ditolak. Pastikan kamu sudah bergabung ke room.";
  if (code.includes("functions/failed-precondition")) return error.message || "Aksi tidak dapat dilakukan saat ini.";
  if (code.includes("functions/unauthenticated")) return "Login anonim belum aktif. Periksa Firebase Authentication.";
  if (code.includes("functions/deadline-exceeded")) return "Waktu menjawab sudah habis.";
  if (code.includes("functions/already-exists")) return "Jawabanmu sudah tercatat.";
  if (code.includes("functions/internal") || code.includes("functions/unavailable")) return "Backend belum aktif atau belum berhasil di-deploy. Cek Cloud Functions.";
  return error?.message || "Terjadi kesalahan. Coba lagi.";
}
async function ensureFirebase() {
  if (!isFirebaseConfigured()) throw new Error("Konfigurasi Firebase belum lengkap.");
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getDatabase(firebaseApp);
    functions = getFunctions(firebaseApp, "us-central1");
  }
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = auth.currentUser.uid;
  setConnection("Firebase terhubung", true);
}
function callable(name) {
  return httpsCallable(functions, name);
}
function cleanupSubscriptions() {
  if (stateUnsubscribe) stateUnsubscribe();
  if (playersUnsubscribe) playersUnsubscribe();
  stateUnsubscribe = null;
  playersUnsubscribe = null;
  Object.values(remotePlayers).forEach((entry) => scene.remove(entry.mesh));
  remotePlayers = {};
}
function subscribeRoom() {
  cleanupSubscriptions();
  stateUnsubscribe = onValue(ref(db, `rooms/${roomPin}/public`), (snapshot) => {
    activeState = snapshot.val();
    if (!activeState) return;
    updateLobbyFromState(activeState);
    if (activeState.phase === "lobby") {
      showScreen("lobbyScreen");
      lastHudPhase = "lobby";
    } else if (activeState.phase === "question") {
      showScreen("hud");
      if (lastQuestionIndex !== Number(activeState.questionIndex)) {
        lastQuestionIndex = Number(activeState.questionIndex);
        hasAnswered = false;
        lastAdvanceKey = "";
        renderQuestion(activeState);
      }
      if (lastHudPhase !== "question") {
        $("feedback").textContent = "Berlari ke platform dengan warna jawabanmu.";
      }
      lastHudPhase = "question";
    } else if (activeState.phase === "reveal") {
      showScreen("hud");
      $("feedback").textContent = "Jawaban benar: " + String.fromCharCode(65 + Number(activeState.correctOption)) +
        (activeState.explanation ? " · " + activeState.explanation : "");
      $("answers").querySelectorAll("span").forEach((node, index) => {
        node.style.borderColor = index === Number(activeState.correctOption) ? "#79e8b8" : "#25425c";
        node.style.background = index === Number(activeState.correctOption) ? "#154b43" : "#102238";
      });
      lastHudPhase = "reveal";
    } else if (activeState.phase === "finished") {
      renderPodium(activeState.podium || []);
      showScreen("endScreen");
      lastHudPhase = "finished";
    }
  }, (error) => setConnection("Database: " + error.message, false));

  playersUnsubscribe = onValue(ref(db, `rooms/${roomPin}/players`), (snapshot) => {
    const players = snapshot.val() || {};
    renderPlayers(players);
    const own = players[uid];
    if (own) {
      $("score").textContent = Number(own.score || 0);
      $("streak").textContent = Number(own.streak || 0);
      if (own.hasAnswered && activeState?.phase === "question") hasAnswered = true;
    }
  });
}
function updateLobbyFromState(state) {
  $("roomPin").textContent = roomPin;
  $("quizName").textContent = state.title || "QuizVerse Quiz";
  $("questionCount").textContent = (state.totalQuestions || 0) + " pertanyaan";
  $("roomLabel").textContent = "ROOM " + roomPin;
  $("roundLabel").textContent = "SOAL " + Math.max(1, Number(state.questionIndex || 0) + 1) + "/" + (state.totalQuestions || 0);
  $("hostNote").textContent = isHost ? "Kamu adalah host. Mulai saat semua pemain siap." : "Menunggu host memulai permainan...";
  $("startGame").classList.toggle("hidden", !isHost || state.phase !== "lobby");
}
function renderPlayers(players) {
  const entries = Object.entries(players);
  $("playerCount").textContent = String(entries.length);
  $("players").textContent = entries.length + " pemain";
  $("roster").replaceChildren();
  entries.forEach(([playerId, data]) => {
    const badge = document.createElement("span");
    badge.textContent = (data.name || "Pemain") + (playerId === uid ? " (Kamu)" : "");
    $("roster").appendChild(badge);
    if (playerId !== uid) updateRemoteAvatar(playerId, data);
  });
  Object.keys(remotePlayers).forEach((id) => {
    if (!players[id]) { scene.remove(remotePlayers[id].mesh); delete remotePlayers[id]; }
  });
  if (!ownPlayer && currentAvatar) setOwnAvatar(currentAvatar);
}
function updateRemoteAvatar(id, data) {
  const signature = avatarSignature(data.avatar);
  let entry = remotePlayers[id];
  if (!entry || entry.signature !== signature) {
    if (entry) scene.remove(entry.mesh);
    entry = { mesh: createAvatar(data.avatar || {}), signature };
    remotePlayers[id] = entry;
    scene.add(entry.mesh);
  }
  entry.mesh.position.set(Number(data.x || 0), 0, Number(data.z || 0));
}

async function enterLobby() {
  subscribeRoom();
  await onDisconnect(ref(db, `rooms/${roomPin}/players/${uid}`)).update({ connected: false });
  $("roomPin").textContent = roomPin;
  showScreen("lobbyScreen");
}

// ---------- Host and player flows ----------
$("chooseHost").addEventListener("click", () => {
  setupMode = "host";
  $("hostFields").classList.remove("hidden");
  $("playerFields").classList.add("hidden");
  $("setupEyebrow").textContent = "HOST CONTROL";
  $("setupTitle").textContent = "Buat arena kuis.";
  showScreen("setupScreen");
  $("status").textContent = "Pilih bank soal JSON dari perangkatmu.";
});
$("choosePlayer").addEventListener("click", () => {
  setupMode = "player";
  $("playerFields").classList.remove("hidden");
  $("hostFields").classList.add("hidden");
  $("setupEyebrow").textContent = "PLAYER SETUP";
  $("setupTitle").textContent = "Siapkan avatarmu.";
  showScreen("setupScreen");
  $("status").textContent = "Masukkan PIN dari host untuk bergabung.";
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
    questionBank = {
      title: String(parsed.title || $("quizTitle").value || "QuizVerse Quiz"),
      durationSeconds: Number(parsed.durationSeconds || $("duration").value || 15),
      questions
    };
    $("fileStatus").textContent = "✓ " + file.name + " · " + questions.length + " pertanyaan siap diperiksa backend.";
  } catch (error) {
    $("fileStatus").textContent = "File tidak valid: " + error.message;
  }
});

$("createRoom").addEventListener("click", async () => {
  try {
    if (!questionBank) throw new Error("Pilih file bank soal JSON terlebih dahulu.");
    setStatus("Menghubungkan ke Firebase dan membuat room...");
    await ensureFirebase();
    const result = await callable("createRoom")({
      name: $("name").value.trim() || "Host",
      avatar: getAppearance(),
      title: $("quizTitle").value.trim() || questionBank.title,
      durationSeconds: Number($("duration").value || questionBank.durationSeconds || 15),
      questions: questionBank.questions
    });
    roomPin = result.data.roomPin;
    isHost = true;
    currentAvatar = getAppearance();
    currentPosition = { x: 0, z: 0 };
    setOwnAvatar(currentAvatar);
    await enterLobby();
    setConnection("Room " + roomPin + " aktif", true);
  } catch (error) {
    setStatus(firebaseError(error), true);
  }
});

$("joinRoom").addEventListener("click", async () => {
  try {
    const pin = $("pin").value.trim();
    if (!/^\d{6}$/.test(pin)) throw new Error("Room PIN harus terdiri dari 6 digit.");
    setStatus("Memeriksa Room PIN...");
    await ensureFirebase();
    currentAvatar = getAppearance();
    const result = await callable("joinRoom")({
      roomPin: pin,
      name: $("name").value.trim() || "Pemain",
      avatar: currentAvatar
    });
    roomPin = result.data.roomPin;
    isHost = false;
    currentPosition = { x: 0, z: 0 };
    setOwnAvatar(currentAvatar);
    await enterLobby();
    setConnection("Bergabung ke room " + roomPin, true);
  } catch (error) {
    setStatus(firebaseError(error), true);
  }
});

$("startGame").addEventListener("click", async () => {
  try {
    $("startGame").disabled = true;
    await callable("startGame")({ roomPin });
  } catch (error) {
    setStatus(firebaseError(error), true);
  } finally {
    $("startGame").disabled = false;
  }
});
$("copyPin").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomPin);
    $("copyPin").textContent = "Tersalin";
    setTimeout(() => $("copyPin").textContent = "Salin", 1300);
  } catch { $("copyPin").textContent = roomPin; }
});
$("returnHome").addEventListener("click", () => {
  cleanupSubscriptions();
  roomPin = ""; isHost = false; activeState = null;
  hasAnswered = false; lastQuestionIndex = -2; lastAdvanceKey = "";
  currentPosition = { x: 0, z: 0 };
  if (ownPlayer) { ownPlayer.position.set(0, 0, 0); }
  showScreen("roleScreen");
});

// ---------- Question, scoring feedback and platform play ----------
function renderQuestion(state) {
  const q = state.question;
  if (!q) return;
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
  $("score").textContent = "0";
  $("bar").style.width = "100%";
  hasAnswered = false;
  if (ownPlayer) ownPlayer.position.set(0, 0, 0);
  currentPosition = { x: 0, z: 0 };
}
async function submitPlatformAnswer(index) {
  if (!activeState || activeState.phase !== "question" || hasAnswered) return;
  hasAnswered = true;
  $("feedback").textContent = "Jawaban terkirim. Menunggu hasil...";
  try {
    await callable("submitAnswer")({ roomPin, answerIndex: index });
  } catch (error) {
    const message = firebaseError(error);
    $("feedback").textContent = message;
    if (error?.code?.includes("already-exists")) hasAnswered = true;
    else if (error?.code?.includes("deadline-exceeded")) hasAnswered = true;
    else hasAnswered = false;
  }
}
async function requestAdvance() {
  if (!roomPin || !activeState) return;
  const key = activeState.phase + ":" + activeState.questionIndex;
  if (lastAdvanceKey === key) return;
  lastAdvanceKey = key;
  try {
    const result = await callable("advanceGame")({ roomPin });
    if (!result.data?.advanced) lastAdvanceKey = "";
  } catch (error) {
    if (!error?.code?.includes("deadline-exceeded")) console.warn("advanceGame:", error);
    lastAdvanceKey = "";
  }
}
function renderPodium(podium) {
  $("podium").replaceChildren();
  const icons = ["🏆", "🥈", "🥉"];
  if (!podium.length) {
    const note = document.createElement("p");
    note.textContent = "Permainan selesai.";
    $("podium").appendChild(note);
    return;
  }
  podium.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "podium-item";
    const rank = document.createElement("div"); rank.className = "podium-rank"; rank.textContent = icons[index] || String(index + 1);
    const name = document.createElement("div"); name.className = "podium-name"; name.textContent = player.name || "Pemain";
    const score = document.createElement("div"); score.className = "podium-score"; score.textContent = Number(player.score || 0) + " pts";
    row.append(rank, name, score);
    $("podium").appendChild(row);
  });
}

// ---------- Controls and game loop ----------
function movementInput() {
  const x = (moveKeys.d || moveKeys.ArrowRight ? 1 : 0) - (moveKeys.a || moveKeys.ArrowLeft ? 1 : 0) + joystick.x;
  const z = (moveKeys.s || moveKeys.ArrowDown ? 1 : 0) - (moveKeys.w || moveKeys.ArrowUp ? 1 : 0) + joystick.y;
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length } : { x, z };
}
async function movePlayer(dt) {
  if (!ownPlayer || !activeState || activeState.phase === "lobby" || activeState.phase === "finished") return;
  const input = movementInput();
  const speed = 7.2;
  currentPosition.x = THREE.MathUtils.clamp(currentPosition.x + input.x * speed * dt, -21, 21);
  currentPosition.z = THREE.MathUtils.clamp(currentPosition.z + input.z * speed * dt, -21, 21);
  ownPlayer.position.x = currentPosition.x;
  ownPlayer.position.z = currentPosition.z;
  if (Math.abs(input.x) + Math.abs(input.z) > 0.04) ownPlayer.rotation.y = Math.atan2(input.x, input.z);

  if (jumpVelocity !== 0 || !grounded) {
    ownPlayer.position.y += jumpVelocity * dt;
    jumpVelocity -= 22 * dt;
    if (ownPlayer.position.y <= 0) {
      ownPlayer.position.y = 0; jumpVelocity = 0; grounded = true;
    }
  }

  if (activeState.phase === "question" && !hasAnswered) {
    for (const pad of pads) {
      const distance = Math.hypot(currentPosition.x - pad.x, currentPosition.z - pad.z);
      if (distance <= 3.15) {
        await submitPlatformAnswer(pad.index);
        break;
      }
    }
  }

  const now = performance.now();
  if (db && roomPin && now - lastPositionWrite > 110) {
    lastPositionWrite = now;
    update(ref(db, `rooms/${roomPin}/players/${uid}`), {
      x: currentPosition.x, z: currentPosition.z
    }).catch((error) => console.warn("Position sync:", error));
  }
}
function jump() {
  if (grounded && ownPlayer) { grounded = false; jumpVelocity = 8.5; }
}
addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  moveKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = true;
  if (event.key === " ") jump();
});
addEventListener("keyup", (event) => { moveKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
$("jump").addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });

const stick = $("stick");
stick.addEventListener("pointerdown", (event) => { stick.setPointerCapture(event.pointerId); updateJoystick(event); });
stick.addEventListener("pointermove", (event) => { if (stick.hasPointerCapture(event.pointerId)) updateJoystick(event); });
stick.addEventListener("pointerup", resetJoystick);
stick.addEventListener("pointercancel", resetJoystick);
function updateJoystick(event) {
  const rect = stick.getBoundingClientRect();
  joystick.x = THREE.MathUtils.clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1);
  joystick.y = THREE.MathUtils.clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1);
}
function resetJoystick() { joystick = { x: 0, y: 0 }; }

["hair", "hairColor", "face", "skin", "shirt", "shirtColor", "pants", "pantsColor", "hat"].forEach((id) => {
  $(id).addEventListener("change", () => setOwnAvatar(getAppearance()));
});
$("name").addEventListener("change", () => syncPlayerProfile().catch(() => {}));

const clock = new THREE.Clock();
async function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  if (activeState?.phase === "question" || activeState?.phase === "reveal") {
    const deadline = activeState.phase === "question" ? Number(activeState.deadlineAt) : Number(activeState.revealEndsAt);
    const seconds = Math.max(0, (deadline - Date.now()) / 1000);
    if (activeState.phase === "question") {
      $("time").textContent = String(Math.ceil(seconds));
      $("bar").style.width = Math.max(0, seconds / Number(activeState.durationSeconds || 15) * 100) + "%";
    } else {
      $("time").textContent = "✓";
      $("bar").style.width = "100%";
    }
    if (seconds <= 0) requestAdvance();
  }
  if (ownPlayer) {
    await movePlayer(dt);
    camera.position.x += (ownPlayer.position.x - camera.position.x) * 0.045;
    camera.position.z += (ownPlayer.position.z + 19 - camera.position.z) * 0.045;
    camera.lookAt(ownPlayer.position.x, 0.7, ownPlayer.position.z);
  }
  const t = performance.now() * 0.001;
  pads.forEach((pad, index) => {
    pad.platform.material.emissiveIntensity = 0.14 + Math.sin(t * 2.2 + index) * 0.07;
  });
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
currentAvatar = getAppearance();
setOwnAvatar(currentAvatar);
setConnection("Siap masuk ke arena");
