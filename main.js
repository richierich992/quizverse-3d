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

const PLAYER_ONLY = location.pathname.endsWith("/player.html");
const HOST_DRAFT_KEY = "quizverse-host-draft-v1";
const HOST_SESSION_KEY = "quizverse-host-session-v1";
const CHARACTER_PRESETS = [
  { name:"Nova",role:"SUNSHINE EXPLORER",mark:"✦",avatar:{hair:"curly",hairColor:"#315b78",face:"happy",skin:"#dfaa7e",shirt:"hoodie",shirtColor:"#48c9d5",shirtAccent:"#ffe38a",pants:"jogger",pantsColor:"#536b91",shoes:"sneakers",shoesColor:"#f7fbff",hat:"bunny-ears",hatAccent:"#ff9eb8"} },
  { name:"Kai",role:"CLOUD ADVENTURER",mark:"☁",avatar:{hair:"short",hairColor:"#754c32",face:"smile",skin:"#f3c9a5",shirt:"jacket",shirtColor:"#ffad68",shirtAccent:"#fff0a5",pants:"cargo",pantsColor:"#7e9b73",shoes:"sneakers",shoesColor:"#fff4df",hat:"bear-ears",hatAccent:"#f7b7a5"} },
  { name:"Luna",role:"RAINBOW DREAMER",mark:"✧",avatar:{hair:"long",hairColor:"#463454",face:"happy",skin:"#bd8057",shirt:"hoodie",shirtColor:"#aa91ee",shirtAccent:"#ffd0e9",pants:"jeans",pantsColor:"#668bc0",shoes:"high-top",shoesColor:"#f7eaf5",hat:"bow",hatAccent:"#ff9bc8"} },
  { name:"Rex",role:"HAPPY CHAMPION",mark:"★",avatar:{hair:"curly",hairColor:"#342a35",face:"happy",skin:"#8b563d",shirt:"jersey",shirtColor:"#ff7184",shirtAccent:"#ffe18a",pants:"shorts",pantsColor:"#475b83",shoes:"sneakers",shoesColor:"#f4c542",hat:"cat-ears",hatAccent:"#ffb7c9"} },
  { name:"Mika",role:"COLOUR CREATOR",mark:"❋",avatar:{hair:"bob",hairColor:"#b84962",face:"wink",skin:"#f3c9a5",shirt:"tee",shirtColor:"#62d6a2",shirtAccent:"#fff2a3",pants:"jogger",pantsColor:"#7564a8",shoes:"high-top",shoesColor:"#fff0f6",hat:"flower-clip",hatAccent:"#ffe36e"} },
  { name:"Zed",role:"LITTLE INVENTOR",mark:"◈",avatar:{hair:"sidepart",hairColor:"#ba9251",face:"nerd",skin:"#dfaa7e",shirt:"hoodie",shirtColor:"#ffd16b",shirtAccent:"#ffffff",pants:"cargo",pantsColor:"#53657f",shoes:"sneakers",shoesColor:"#edf5ff",hat:"headphones",hatAccent:"#75dff0"} }
];
const DEFAULT_AVATAR={...CHARACTER_PRESETS[0].avatar};
let selectedAvatar={...DEFAULT_AVATAR},selectedLookName="Nova",activeWardrobeCategory="look";
let previewScene=null,previewCamera=null,previewRenderer=null,previewAvatar=null,previewResizeObserver=null;
const WARDROBE_CATEGORIES=[
 {id:"look",label:"Gaya",icon:"✦",title:"Pilih gaya awal",subtitle:"Mulai dari karakter siap pakai, lalu ubah sesukamu.",groups:[
  {title:"KARAKTER PILIHAN",items:CHARACTER_PRESETS.map(p=>({label:p.name,detail:p.role,icon:p.mark,preset:p}))}
 ]},
 {id:"hair",label:"Rambut",icon:"⌁",title:"Hair studio",subtitle:"Pilih bentuk dan warna rambut.",groups:[
  {title:"MODEL RAMBUT",items:[["Short cut","▰","short"],["Soft tufts","✦","spiky"],["Long","♧","long"],["Bob","◒","bob"],["Ponytail","♢","ponytail"],["Curly","❋","curly"],["Afro","✺","afro"],["Side part","◖","sidepart"],["Botak","○","none"]].map(([label,icon,value])=>({label,icon,patch:{hair:value}}))},
  {title:"WARNA RAMBUT",items:[["Hitam","#252b38"],["Cokelat","#754c32"],["Pirang","#e5bd68"],["Biru","#3988e8"],["Pink","#ed83bd"],["Ungu","#9a79df"],["Silver","#e8e7df"],["Merah","#b84935"]].map(([label,color])=>({label,color,patch:{hairColor:color}}))}
 ]},
 {id:"face",label:"Wajah",icon:"☻",title:"Face & skin",subtitle:"Atur ekspresi dan warna kulit karakter.",groups:[
  {title:"EKSPRESI",items:[["Senyum","☺","smile"],["Super happy","☻","happy"],["Kedip mata","😉","wink"],["Terkejut lucu","○","surprised"],["Kacamata","▣","nerd"]].map(([label,icon,value])=>({label,icon,patch:{face:value}}))},
  {title:"WARNA KULIT",items:[["Fair","#f3c9a5"],["Warm","#dfaa7e"],["Tan","#bd8057"],["Brown","#8b563d"],["Deep","#59382e"]].map(([label,color])=>({label,color,patch:{skin:color}}))}
 ]},
 {id:"top",label:"Atasan",icon:"▣",title:"Upper wear",subtitle:"Kombinasikan model dan warna atasan.",groups:[
  {title:"MODEL ATASAN",items:[["T-shirt","👕","tee"],["Hoodie","🧥","hoodie"],["Jersey","⚽","jersey"],["Jacket","◫","jacket"]].map(([label,icon,value])=>({label,icon,patch:{shirt:value}}))},
  {title:"WARNA ATASAN",items:[["Sky blue","#38bdf8"],["Crimson","#ef5268"],["Emerald","#27bd83"],["Gold","#f0bb3e"],["Purple","#9468df"],["Orange","#f28b42"],["White","#f1f5f9"],["Midnight","#263247"],["Pink","#ed82b7"],["Teal","#168f98"],["Olive","#a6b65b"],["Rust","#a64c38"]].map(([label,color])=>({label,color,patch:{shirtColor:color}}))}
 ]},
 {id:"bottom",label:"Bawahan",icon:"▤",title:"Bottomwear",subtitle:"Pilih celana untuk gaya karaktermu.",groups:[
  {title:"MODEL BAWAHAN",items:[["Jeans","▤","jeans"],["Jogger","▥","jogger"],["Cargo","▦","cargo"],["Shorts","▱","shorts"]].map(([label,icon,value])=>({label,icon,patch:{pants:value}}))},
  {title:"WARNA BAWAHAN",items:[["Denim","#294a70"],["Charcoal","#273344"],["Slate","#65758a"],["Khaki","#b49b68"],["Olive","#566b45"],["Burgundy","#8b4352"],["Ivory","#dce4ed"],["Purple","#514477"]].map(([label,color])=>({label,color,patch:{pantsColor:color}}))}
 ]},
 {id:"shoes",label:"Sepatu",icon:"⌑",title:"Footwear",subtitle:"Lengkapi penampilan dari ujung kepala sampai kaki.",groups:[
  {title:"MODEL SEPATU",items:[["Sneakers","👟","sneakers"],["High top","🥾","high-top"],["Boots","👢","boots"]].map(([label,icon,value])=>({label,icon,patch:{shoes:value}}))},
  {title:"WARNA SEPATU",items:[["Midnight","#202a38"],["White","#f1f5f9"],["Gold","#f4c542"],["Crimson","#ef5268"],["Emerald","#27bd83"],["Purple","#9468df"],["Brown","#754c32"],["Teal","#168f98"]].map(([label,color])=>({label,color,patch:{shoesColor:color}}))}
 ]},
 {id:"accessories",label:"Aksesori",icon:"◇",title:"Accessories",subtitle:"Tambahkan sentuhan terakhir untuk karakter.",groups:[
  {title:"AKSESORI KEPALA",items:[["Tanpa aksesori","○","none"],["Telinga kelinci","🐰","bunny-ears"],["Telinga kucing","🐱","cat-ears"],["Telinga beruang","🐻","bear-ears"],["Pita lucu","🎀","bow"],["Jepit bunga","🌼","flower-clip"],["Baseball cap","🧢","cap"],["Beanie","♧","beanie"],["Crown","♛","crown"],["Headphones","🎧","headphones"]].map(([label,icon,value])=>({label,icon,patch:{hat:value}}))}
 ]}
];
const PAD_POINTS = [
  { x: -7, z: -6 }, { x: 7, z: -6 }, { x: -7, z: 6 }, { x: 7, z: 6 }
];

const ANSWER_BAY_SURFACE_Y = 0.753;
function answerBaySurfaceAt(x, z) {
  const inside = PAD_POINTS.some((point) =>
    Math.abs(x - point.x) <= 3.15 && Math.abs(z - point.z) <= 3.15
  );
  return inside ? ANSWER_BAY_SURFACE_Y : 0;
}

let app = null, auth = null, db = null, uid = "";
let roomPin = "", isHost = false, questionBank = null;
let activeState = null, playerData = {}, remotePlayers = {}, ownAvatar = null;
let ownPosition = { x: 0, z: 0 }, moveKeys = {}, joystick = { x: 0, y: 0 };
let jumpVelocity = 0, grounded = true, serverOffset = 0;
let stateUnsubscribe = null, playersUnsubscribe = null;
let lastQuestionIndex = -1;
let localAnswerRound = -1, localAnswerIndex = -1, answerBusy = false, scoreBusyRound = -1;
let hostTransitionBusy = false, lastPositionWrite = 0, lastStatusMessage = "";
let lastVisualStateKey = "";
const matchVisualEvent = { kind: "", startedAt: 0, duration: 0, x: 0, z: 0, color: "#62dcff" };

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
  const spectatorActive = isHost && id === "hud";
  $("app").classList.toggle("host-spectator", spectatorActive);
  // Host observes the arena; movement and jump controls belong only to Players.
  $("touchControls").classList.toggle("hidden", id !== "hud" || isHost || !matchMedia("(pointer: coarse)").matches);
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
scene.fog = new THREE.Fog("#0a1724", 38, 86);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 13, 20);
camera.lookAt(0, 0.85, 0);
const spectatorFocus = new THREE.Vector3(0, 0, 0);
const spectatorCameraPosition = new THREE.Vector3();
const winnerCameraFocus = new THREE.Vector3(0, 1.62, -17.15);
const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
scene.add(new THREE.HemisphereLight("#d8eaff", "#172432", 1.45));
const sun = new THREE.DirectionalLight("#fff4df", 2.8);
sun.position.set(-12, 22, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 26;
sun.shadow.camera.bottom = -26;
sun.shadow.bias = -0.00018;
scene.add(sun);
const fill = new THREE.PointLight("#67c9ff", 58, 42, 2);
fill.position.set(12, 9, -11);
scene.add(fill);
const warmFill = new THREE.PointLight("#ffbd82", 26, 30, 2);
warmFill.position.set(-14, 7, 8);
scene.add(warmFill);

function createArenaFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#263745";
  ctx.fillRect(0, 0, 512, 512);

  // Large, subtle composite-floor panels instead of a bright editor-style grid.
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = ((x + y) / 128) % 2 ? "#2c3e4c" : "#293b49";
      ctx.fillRect(x + 1, y + 1, 126, 126);
      ctx.strokeStyle = "rgba(190,218,235,0.075)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, 124, 124);
    }
  }

  // Fine, deterministic surface grain keeps the floor from reading as a flat color.
  let seed = 92821;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 15000; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const light = random() > 0.52;
    ctx.fillStyle = light ? "rgba(220,235,245,0.055)" : "rgba(3,10,18,0.08)";
    ctx.fillRect(x, y, 1 + random() * 2, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}
const arenaFloorTexture = createArenaFloorTexture();
const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(25, 25, 0.72, 96),
  new THREE.MeshStandardMaterial({
    color: "#bdc8d1", map: arenaFloorTexture, roughness: 0.84, metalness: 0.12
  })
);
floor.position.y = -0.36;
floor.receiveShadow = true;
scene.add(floor);

// Layered steel plinth makes the arena feel like a physical venue, not a floating disk.
const arenaPlinth = new THREE.Mesh(
  new THREE.CylinderGeometry(25.25, 25.25, 0.48, 96),
  new THREE.MeshStandardMaterial({ color: "#111e2b", roughness: 0.46, metalness: 0.72 })
);
arenaPlinth.position.y = -0.82;
arenaPlinth.receiveShadow = true;
scene.add(arenaPlinth);

const sharedMaterials = new Map();
function mat(color, roughness = 0.72) {
  const key = String(color) + "|" + roughness;
  if (!sharedMaterials.has(key)) {
    sharedMaterials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  }
  return sharedMaterials.get(key);
}
const roundedGeometryCache = new Map();
const sharedAvatarGeometries = new Set();
function roundedBoxGeometry(width, height, depth, radius = 0.16) {
  const key = [width, height, depth, radius].join("|");
  if (roundedGeometryCache.has(key)) return roundedGeometryCache.get(key);
  const r = Math.min(radius, width * 0.46, height * 0.46);
  const halfW = width / 2;
  const halfH = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
  const bevel = Math.min(0.028, r * 0.16, depth * 0.08);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true,
    bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel,
    curveSegments: 5
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  sharedAvatarGeometries.add(geometry);
  roundedGeometryCache.set(key, geometry);
  return geometry;
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

const arenaMaterial = {
  wall: new THREE.MeshStandardMaterial({ color: "#1b2b39", roughness: 0.78, metalness: 0.22 }),
  wallLight: new THREE.MeshStandardMaterial({ color: "#314657", roughness: 0.58, metalness: 0.42 }),
  steel: new THREE.MeshStandardMaterial({ color: "#25394a", roughness: 0.34, metalness: 0.82 }),
  steelDark: new THREE.MeshStandardMaterial({ color: "#101f2c", roughness: 0.48, metalness: 0.72 }),
  seat: new THREE.MeshStandardMaterial({ color: "#263f52", roughness: 0.56, metalness: 0.28 }),
  seatAccent: new THREE.MeshStandardMaterial({ color: "#34566b", roughness: 0.46, metalness: 0.22 }),
  lightCyan: new THREE.MeshStandardMaterial({ color: "#8beaff", emissive: "#29b9e8", emissiveIntensity: 1.6, roughness: 0.28 }),
  lightWarm: new THREE.MeshStandardMaterial({ color: "#ffe1ae", emissive: "#de8b3f", emissiveIntensity: 1.1, roughness: 0.3 })
};

function arenaBox(width, height, depth, material, x, y, z, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  scene.add(mesh);
  return mesh;
}
function arenaBeam(start, end, radius, material) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
    material
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
function arenaRing(radius, tubeRadius, material, y) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 10, 120),
    material
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.receiveShadow = true;
  scene.add(ring);
  return ring;
}
function createArenaScreenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 1024, 320);
  gradient.addColorStop(0, "#0c263b");
  gradient.addColorStop(0.55, "#163d56");
  gradient.addColorStop(1, "#101f39");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = "rgba(123,225,255,.30)";
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 1000, 296);
  ctx.strokeStyle = "rgba(123,225,255,.12)";
  ctx.lineWidth = 2;
  for (let x = 30; x < 1024; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 300); ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#53cfff";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#effaff";
  ctx.font = "800 78px Arial";
  ctx.fillText("QUIZVERSE", 512, 125);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#86dfff";
  ctx.font = "700 24px Arial";
  ctx.letterSpacing = "9px";
  ctx.fillText("LEARNING COMPETITION ARENA", 512, 214);
  ctx.fillStyle = "rgba(218,242,255,.58)";
  ctx.font = "600 15px Arial";
  ctx.fillText("THINK  ·  MOVE  ·  ANSWER", 512, 266);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildArenaArchitecture() {
  // Enclosing walls and a framed end-stage provide real spatial scale.
  arenaBox(50, 11.5, 1.0, arenaMaterial.wall, 0, 5.25, -24.55);
  arenaBox(1.0, 10.5, 48, arenaMaterial.wall, -24.55, 4.9, 0);
  arenaBox(1.0, 10.5, 48, arenaMaterial.wall, 24.55, 4.9, 0);
  arenaBox(50, 0.42, 0.72, arenaMaterial.steel, 0, 10.85, -23.92);
  arenaBox(0.72, 10.2, 0.8, arenaMaterial.steel, -22.8, 5, -23.8);
  arenaBox(0.72, 10.2, 0.8, arenaMaterial.steel, 22.8, 5, -23.8);

  // Repeated wall ribs, acoustic panels and vertical light strips.
  for (let x = -21; x <= 21; x += 3.5) {
    arenaBox(0.16, 9.4, 0.18, arenaMaterial.wallLight, x, 5, -23.92, { castShadow: false });
  }
  for (const x of [-19, -12, 12, 19]) {
    arenaBox(0.10, 8.5, 0.10, arenaMaterial.lightCyan, x, 5.25, -23.78, { castShadow: false, receiveShadow: false });
  }

  // Central illuminated scoreboard / identity screen.
  arenaBox(13.0, 4.0, 0.55, arenaMaterial.steelDark, 0, 6.2, -23.72);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(12.1, 3.22),
    new THREE.MeshBasicMaterial({ map: createArenaScreenTexture(), toneMapped: false })
  );
  screen.position.set(0, 6.2, -23.425);
  scene.add(screen);
  arenaBox(13.5, 0.16, 0.12, arenaMaterial.lightCyan, 0, 8.28, -23.36, { castShadow: false, receiveShadow: false });
  arenaBox(13.5, 0.16, 0.12, arenaMaterial.steel, 0, 4.12, -23.36);

  // Heavy corner pylons and roof trusses establish an indoor venue silhouette.
  for (const side of [-1, 1]) {
    for (const z of [-18, 0, 18]) {
      const x = side * 21.7;
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.36, 10.2, 14),
        arenaMaterial.steel
      );
      column.position.set(x, 5.05, z);
      column.castShadow = true;
      column.receiveShadow = true;
      scene.add(column);
      arenaBox(0.8, 0.32, 0.8, arenaMaterial.steelDark, x, 0.35, z);
      arenaBox(0.34, 7.8, 0.12, arenaMaterial.lightCyan, x, 5.0, z, { castShadow: false, receiveShadow: false });
    }
  }
  for (const z of [-20, -10, 0, 10, 20]) {
    arenaBeam([-21.7, 10.35, z], [21.7, 10.35, z], 0.13, arenaMaterial.steel);
  }
  for (const side of [-1, 1]) {
    arenaBeam([side * 21.7, 10.35, -20], [side * 21.7, 10.35, 20], 0.13, arenaMaterial.steel);
    arenaBeam([side * 21.7, 9.65, -20], [side * 21.7, 9.65, 20], 0.055, arenaMaterial.wallLight);
  }
  arenaRing(19.8, 0.10, arenaMaterial.steel, 10.18);
  arenaRing(18.8, 0.035, arenaMaterial.lightCyan, 10.18);

  // A small, stepped grandstand on each side, facing the answer field.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const x = side * (14.2 + row * 1.28);
      const y = 0.56 + row * 0.42;
      arenaBox(0.94, 0.24, 13.6, arenaMaterial.seat, x, y, 0);
      arenaBox(0.18, 0.62, 13.6, arenaMaterial.seatAccent, x + side * 0.38, y + 0.31, 0);
      arenaBox(0.16, 0.10, 12.8, arenaMaterial.lightCyan, x - side * 0.38, y - 0.04, 0, { castShadow: false, receiveShadow: false });
    }
    for (const z of [-7.2, 7.2]) {
      arenaBox(0.95, 0.85, 0.26, arenaMaterial.steel, side * 18.5, 1.75, z);
    }
  }

  // Curved floor markings and safety lines replace the bright editor grid.
  arenaRing(10.9, 0.028, arenaMaterial.wallLight, 0.012);
  arenaRing(20.8, 0.045, arenaMaterial.steel, 0.014);
  arenaRing(23.65, 0.075, arenaMaterial.lightCyan, 0.018);
  for (const x of [-11.0, 11.0]) {
    arenaBox(0.045, 0.012, 12.5, arenaMaterial.wallLight, x, 0.013, 0, { castShadow: false, receiveShadow: false });
  }

  // Overhead fixtures and soft colored pools of light on the four answer bays.
  const bayLights = ["#f45c78", "#4e9dff", "#f6d16a", "#40d5a0"];
  PAD_POINTS.forEach((point, index) => {
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.52, 0.42, 16),
      arenaMaterial.steelDark
    );
    housing.position.set(point.x, 9.65, point.z);
    housing.castShadow = true;
    scene.add(housing);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.08, 16),
      new THREE.MeshBasicMaterial({ color: bayLights[index] })
    );
    lens.position.set(point.x, 9.40, point.z);
    scene.add(lens);
    const pool = new THREE.PointLight(bayLights[index], 22, 19, 2);
    pool.position.set(point.x, 8.9, point.z);
    scene.add(pool);
  });


  // Decorative hanging banners and compact, stylized crowd silhouettes.
  const bannerColors = ["#49c8ff", "#ffb95e", "#a78bfa", "#42d6a0"];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const z = -15 + k * 15;
      arenaBox(1.05, 3.6, 0.22, arenaMaterial.steelDark, side * 20.25, 7.1, z);
      arenaBox(0.88, 2.95, 0.055, new THREE.MeshStandardMaterial({
        color: bannerColors[(k + (side > 0 ? 1 : 0)) % bannerColors.length],
        roughness: 0.65, metalness: 0.1
      }), side * 20.25, 7.1, z - side * 0.14, { castShadow: false });
      arenaBox(0.88, 0.07, 0.07, arenaMaterial.lightCyan, side * 20.25, 8.66, z, { castShadow: false, receiveShadow: false });
    }
  }
  // Low-poly audience figures: lightweight, decorative silhouettes, not game avatars.
  const crowdPalette = ["#5a7991", "#6d8da5", "#9c7c9f", "#d18a63", "#5eaa9d", "#8798b4"];
  const crowdSeed = (n) => ((n * 37 + 11) % 17) / 17;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const x = side * (14.2 + row * 1.28);
      const y = 0.74 + row * 0.42;
      for (let n = 0; n < 14; n++) {
        const z = -6.1 + n * 0.94;
        const color = crowdPalette[(n + row * 3 + (side > 0 ? 2 : 0)) % crowdPalette.length];
        const torso = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.16, 0.24 + crowdSeed(n + row) * 0.08, 3, 6),
          new THREE.MeshStandardMaterial({ color, roughness: 0.88 })
        );
        torso.position.set(x, y + 0.48, z);
        torso.castShadow = false;
        torso.receiveShadow = false;
        scene.add(torso);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 6),
          new THREE.MeshStandardMaterial({ color: "#d7ad91", roughness: 0.9 })
        );
        head.position.set(x, y + 0.82, z);
        head.castShadow = false;
        head.receiveShadow = false;
        scene.add(head);
      }
    }
  }

  // Four sweeping light beams are translucent and rotate slowly overhead.
  const beamMaterials = ["#f45c78", "#4e9dff", "#f6d16a", "#40d5a0"].map(color =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide })
  );
  const sweepingBeams = [];
  for (let i = 0; i < 4; i++) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 11.8, 18, 1, true),
      beamMaterials[i]
    );
    beam.position.set((i - 1.5) * 6.5, 6.0, -3.0);
    beam.rotation.z = Math.PI;
    beam.rotation.x = 0.18;
    beam.userData.sweepPhase = i * Math.PI * 0.5;
    scene.add(beam);
    sweepingBeams.push(beam);
  }

  // Perimeter LED segments animate as a subtle venue heartbeat.
  const perimeterLEDs = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.07, 0.14),
      new THREE.MeshBasicMaterial({ color: "#57d8ff" })
    );
    led.position.set(Math.cos(a) * 23.45, 0.06, Math.sin(a) * 23.45);
    led.rotation.y = -a;
    led.userData.ledIndex = i;
    scene.add(led);
    perimeterLEDs.push(led);
  }
    // Soft architectural wash lights along the side walls.
  for (const side of [-1, 1]) {
    for (const z of [-12, 12]) {
      const wallLight = new THREE.PointLight("#78d9ff", 18, 14, 2);
      wallLight.position.set(side * 21.5, 7.3, z);
      scene.add(wallLight);
    }
  }
}
buildArenaArchitecture();

const winnerPodiumGroup = new THREE.Group();
winnerPodiumGroup.visible = false;
scene.add(winnerPodiumGroup);
const winnerPodiumSlots = [
  { x: 0, z: -17.15, y: 1.62, color: "#e6b84e", label: "1ST" },
  { x: -3.45, z: -17.15, y: 1.12, color: "#c5d4e2", label: "2ND" },
  { x: 3.45, z: -17.15, y: 0.92, color: "#c58b65", label: "3RD" }
];
winnerPodiumSlots.forEach((slot) => {
  const metal = new THREE.MeshStandardMaterial({
    color: slot.color, roughness: 0.34, metalness: 0.72,
    emissive: slot.color, emissiveIntensity: 0.10
  });
  const pedestal = new THREE.Mesh(
    roundedBoxGeometry(2.85, slot.y, 2.55, 0.22), metal
  );
  pedestal.position.set(slot.x, slot.y / 2, slot.z);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  winnerPodiumGroup.add(pedestal);

  const cap = new THREE.Mesh(
    roundedBoxGeometry(2.9, 0.13, 2.62, 0.12),
    new THREE.MeshStandardMaterial({
      color: slot.color, roughness: 0.26, metalness: 0.58,
      emissive: slot.color, emissiveIntensity: 0.22
    })
  );
  cap.position.set(slot.x, slot.y - 0.10, slot.z);
  cap.castShadow = false;
  winnerPodiumGroup.add(cap);

  const badge = labelSprite(slot.label, slot.color);
  badge.scale.set(1.55, 0.39, 1);
  badge.position.set(slot.x, slot.y + 0.34, slot.z + 1.32);
  winnerPodiumGroup.add(badge);
});

const sweepingBeams = scene.children.filter((obj) => obj.userData.sweepPhase !== undefined);
const perimeterLEDs = scene.children.filter((obj) => obj.userData.ledIndex !== undefined);

const pads = PAD_POINTS.map((p, index) => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    roundedBoxGeometry(7.62, 0.58, 7.62, 0.48),
    arenaMaterial.steelDark
  );
  base.position.y = 0.12;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const lowerTrim = new THREE.Mesh(
    roundedBoxGeometry(7.38, 0.12, 7.38, 0.38),
    arenaMaterial.lightCyan
  );
  lowerTrim.position.y = 0.39;
  lowerTrim.castShadow = false;
  group.add(lowerTrim);

  const platformMaterial = new THREE.MeshStandardMaterial({
    color: COLORS[index],
    roughness: 0.31,
    metalness: 0.18,
    emissive: COLORS[index],
    emissiveIntensity: 0.10
  });
  const platform = new THREE.Mesh(
    roundedBoxGeometry(7.08, 0.30, 7.08, 0.34),
    platformMaterial
  );
  platform.position.y = 0.57;
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  const topInset = new THREE.Mesh(
    roundedBoxGeometry(6.72, 0.035, 6.72, 0.26),
    new THREE.MeshStandardMaterial({ color: COLORS[index], roughness: 0.48, metalness: 0.08 })
  );
  topInset.position.y = 0.735;
  topInset.castShadow = false;
  group.add(topInset);

  // Small illuminated corner studs make each bay read as a built platform.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10),
        arenaMaterial.lightCyan
      );
      stud.position.set(sx * 3.35, 0.78, sz * 3.35);
      group.add(stud);
    }
  }

  const tag = labelSprite(String.fromCharCode(65 + index) + " · " + COLOR_NAMES[index], COLORS[index]);
  tag.position.set(0, 1.48, 0);
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
const matchEventRings = Array.from({ length: 3 }, (_, index) => {
  const material = new THREE.MeshBasicMaterial({
    color: "#62dcff", transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 8, 56), material);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  ring.userData.ringIndex = index;
  ring.renderOrder = 2;
  scene.add(ring);
  return ring;
});
const celebrationPalette = ["#ffffff", "#ffd166", "#65e6c2", "#73d8ff", "#ff8caa", "#b69cff"];
const celebrationGeometry = new THREE.OctahedronGeometry(0.16, 0);
const celebrationParticles = Array.from({ length: 24 }, (_, index) => {
  const material = new THREE.MeshBasicMaterial({
    color: celebrationPalette[index % celebrationPalette.length],
    transparent: true, opacity: 0, depthWrite: false
  });
  const particle = new THREE.Mesh(celebrationGeometry, material);
  particle.visible = false;
  particle.userData.velocity = new THREE.Vector3();
  particle.userData.spin = (index % 2 ? 1 : -1) * (1.8 + (index % 5) * 0.35);
  scene.add(particle);
  return particle;
});

function triggerQuestionStart() {
  winnerPodiumGroup.visible = false;
  if (playerMesh) {
    playerMesh.userData.winnerTarget = null;
    playerMesh.userData.winnerRank = 0;
  }
  Object.entries(remotePlayers).forEach(([id, entry]) => {
    const person = playerData[id] || {};
    const x = Number(person.x || 0);
    const z = Number(person.z || 0);
    entry.mesh.userData.winnerTarget = null;
    entry.mesh.userData.winnerRank = 0;
    entry.targetX = x;
    entry.targetY = answerBaySurfaceAt(x, z);
    entry.targetZ = z;
  });
  matchVisualEvent.kind = "question";
  matchVisualEvent.startedAt = performance.now();
  matchVisualEvent.duration = 1.25;
  matchVisualEvent.x = 0;
  matchVisualEvent.z = 0;
  matchVisualEvent.color = "#73dfff";
  $("app").classList.remove("timer-critical", "answer-revealed");
  $("app").classList.add("question-enter");
  celebrationParticles.forEach((particle) => { particle.visible = false; });
}
function triggerAvatarReaction(mesh, kind, duration = 1.7) {
  if (!mesh?.userData) return;
  mesh.userData.reaction = {
    kind,
    startedAt: performance.now(),
    duration: Math.max(0.35, duration)
  };
}

function triggerAnswerReveal(state) {
  const correctIndex = THREE.MathUtils.clamp(Number(state.correctOption) || 0, 0, 3);
  const point = PAD_POINTS[correctIndex] || { x: 0, z: 0 };
  // Remote avatars only show a shared reveal reaction; their private answer stays private.
  Object.values(remotePlayers).forEach((entry) => triggerAvatarReaction(entry.mesh, "reveal", 1.2));
  if (playerMesh && localAnswerRound === Number(state.questionIndex) && localAnswerIndex >= 0) {
    triggerAvatarReaction(playerMesh, localAnswerIndex === correctIndex ? "correct" : "wrong", 1.85);
  }
  matchVisualEvent.kind = "reveal";
  matchVisualEvent.startedAt = performance.now();
  matchVisualEvent.duration = 1.65;
  matchVisualEvent.x = point.x;
  matchVisualEvent.z = point.z;
  matchVisualEvent.color = COLORS[correctIndex];
  $("app").classList.remove("timer-critical", "question-enter");
  $("app").classList.add("answer-revealed");
  $("answers").querySelectorAll("span").forEach((item, index) => {
    item.classList.toggle("is-correct-answer", index === correctIndex);
  });

  celebrationParticles.forEach((particle, index) => {
    const angle = (index / celebrationParticles.length) * Math.PI * 2;
    const speed = 2.2 + (index % 4) * 0.55;
    particle.position.set(point.x, 1.25 + (index % 3) * 0.16, point.z);
    particle.userData.velocity.set(
      Math.cos(angle) * speed,
      3.1 + (index % 5) * 0.48,
      Math.sin(angle) * speed
    );
    particle.rotation.set(Math.random() * 1.4, Math.random() * 1.4, Math.random() * 1.4);
    particle.material.opacity = 1;
    particle.visible = true;
  });
}
function applyWinnerPlacements(podium = []) {
  if (!Array.isArray(podium) || !podium.length) return;
  winnerPodiumGroup.visible = true;
  const slotByUid = new Map(podium.slice(0, 3).map((person, index) => [String(person.uid || ""), index]));
  const place = (mesh, rankIndex) => {
    const slot = winnerPodiumSlots[rankIndex];
    if (!mesh || !slot) return;
    const approachYaw = Math.atan2(slot.x - mesh.position.x, slot.z - mesh.position.z);
    mesh.userData.winnerRank = rankIndex + 1;
    mesh.userData.winnerMoving = true;
    mesh.userData.winnerTarget = {
      x: slot.x, y: slot.y, z: slot.z, yaw: 0, approachYaw
    };
  };

  if (uid && slotByUid.has(String(uid))) place(playerMesh, slotByUid.get(String(uid)));
  Object.entries(remotePlayers).forEach(([id, entry]) => {
    const rankIndex = slotByUid.get(String(id));
    if (rankIndex === undefined) {
      entry.mesh.userData.winnerRank = 0;
      entry.mesh.userData.winnerMoving = false;
      entry.mesh.userData.winnerTarget = null;
      return;
    }
    place(entry.mesh, rankIndex);
    const slot = winnerPodiumSlots[rankIndex];
    entry.targetX = slot.x;
    entry.targetY = slot.y;
    entry.targetZ = slot.z;
    entry.targetYaw = entry.mesh.userData.winnerTarget.approachYaw;
  });
}

function triggerGameFinish(podium = []) {
  if (playerMesh) triggerAvatarReaction(playerMesh, "victory", 2.25);
  Object.values(remotePlayers).forEach((entry) => triggerAvatarReaction(entry.mesh, "victory", 2.25));
  applyWinnerPlacements(podium);

  matchVisualEvent.kind = "victory";
  matchVisualEvent.startedAt = performance.now();
  matchVisualEvent.duration = 2.25;
  matchVisualEvent.x = 0;
  matchVisualEvent.z = 0;
  matchVisualEvent.color = "#ffd166";
  $("app").classList.remove("timer-critical", "question-enter", "answer-revealed");
  celebrationParticles.forEach((particle, index) => {
    const angle = (index / celebrationParticles.length) * Math.PI * 2;
    const speed = 1.7 + (index % 4) * 0.42;
    particle.position.set(0, 1.7 + (index % 3) * 0.2, 0);
    particle.userData.velocity.set(
      Math.cos(angle) * speed,
      3.0 + (index % 5) * 0.38,
      Math.sin(angle) * speed
    );
    particle.rotation.set(index * 0.17, index * 0.23, index * 0.11);
    particle.material.opacity = 1;
    particle.visible = true;
  });
}

function updateMatchVisualEffects(now, dt) {
  const event = matchVisualEvent;
  const elapsed = event.kind ? (now - event.startedAt) / 1000 : Infinity;
  const active = elapsed >= 0 && elapsed < event.duration;

  matchEventRings.forEach((ring, index) => {
    const localProgress = (elapsed - index * 0.12) / Math.max(0.1, event.duration - 0.12);
    if (!active || localProgress < 0 || localProgress >= 1) {
      ring.visible = false;
      return;
    }
    const progress = THREE.MathUtils.clamp(localProgress, 0, 1);
    const radius = event.kind === "question" ? 1.0 + progress * 13.5 : 0.8 + progress * 5.4;
    ring.position.set(event.x, event.kind === "question" ? 0.045 + index * 0.012 : 0.94 + index * 0.018, event.z);
    ring.scale.setScalar(radius);
    ring.material.color.set(event.color);
    ring.material.opacity = Math.sin(progress * Math.PI) * (event.kind === "question" ? 0.48 : 0.58);
    ring.visible = true;
  });

  celebrationParticles.forEach((particle) => {
    if (!particle.visible) return;
    const velocity = particle.userData.velocity;
    particle.position.addScaledVector(velocity, dt);
    velocity.y -= 6.8 * dt;
    particle.rotation.x += particle.userData.spin * dt;
    particle.rotation.y += particle.userData.spin * 0.72 * dt;
    particle.material.opacity = Math.max(0, 1 - elapsed / event.duration);
    if (elapsed >= event.duration || particle.position.y < 0.15) particle.visible = false;
  });

  if (event.kind && elapsed >= event.duration) {
    event.kind = "";
    $("app").classList.remove("question-enter", "answer-revealed");
  }
}


function appearance() {
  return { ...selectedAvatar };
}
function createAvatar(a = {}) {
  const g = new THREE.Group();
  const skin = a.skin || "#dfaa7e";
  const shirt = a.shirtColor || "#38bdf8";
  const hair = a.hairColor || "#252b38";
  const pants = a.pantsColor || "#294a70";
  const shoeColor = a.shoesColor || "#202a38";
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);

  const sphere = (parent, color, x, y, z, sx, sy, sz, roughness = 0.72) => {
    const mesh = new THREE.Mesh(sphereGeometry, mat(color, roughness));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const roundedBox = (parent, color, w, h, d, radius, x, y, z, roughness = 0.72) => {
    const mesh = new THREE.Mesh(roundedBoxGeometry(w, h, d, radius), mat(color, roughness));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const capsule = (parent, color, radius, length, x, y, z, roughness = 0.72) => {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, length, 5, 14),
      mat(color, roughness)
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (parent, color, w, h, d, x, y, z, roughness = 0.68) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d, 2, 2, 2),
      mat(color, roughness)
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const tube = (parent, points, color, radius = 0.014) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 18, radius, 8, false),
      mat(color, 0.6)
    );
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const torus = (parent, color, radius, tubeRadius, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tubeRadius, 10, 28),
      mat(color, 0.58)
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Proportions: large expressive head, compact torso and articulated limbs.
  // All face details point toward +Z so they remain visible in the arena and preview.
  const torso = new THREE.Group();
  torso.position.set(0, 1.29, 0);
  g.add(torso);

  const torsoBody = capsule(torso, shirt, 0.35, 0.34, 0, 0, 0, 0.84);
  torsoBody.scale.z = 0.88;
  sphere(torso, pants, 0, -0.39, 0, 0.34, 0.20, 0.27);
  torus(torso, a.shirtAccent || "#eaf7ff", 0.19, 0.025, 0, 0.43, 0, Math.PI / 2);

  // Neck and layered collar.
  capsule(g, skin, 0.13, 0.12, 0, 1.75, 0, 0.82);
  sphere(torso, a.shirtAccent || "#eaf7ff", 0, 0.44, 0.18, 0.17, 0.09, 0.12);

  // Outfit construction and recognizable details.
  if (a.shirt === "hoodie") {
    sphere(torso, shirt, 0, 0.20, -0.24, 0.29, 0.30, 0.15);
    box(torso, a.shirtAccent || "#dbeafe", 0.40, 0.17, 0.045, 0, -0.25, 0.315);
    tube(torso, [[-0.055,0.39,0.29],[-0.04,0.16,0.33],[-0.02,-0.06,0.34]], "#f8fafc", 0.012);
    tube(torso, [[0.055,0.39,0.29],[0.04,0.16,0.33],[0.02,-0.06,0.34]], "#f8fafc", 0.012);
    sphere(torso, "#f8fafc", -0.08, 0.02, 0.35, 0.018, 0.025, 0.012);
    sphere(torso, "#f8fafc", 0.08, 0.02, 0.35, 0.018, 0.025, 0.012);
  } else if (a.shirt === "jersey") {
    box(torso, "#f7fbff", 0.075, 0.58, 0.035, 0, 0, 0.315);
    box(torso, a.shirtAccent || "#f6cf58", 0.44, 0.045, 0.035, 0, 0.28, 0.295);
    box(torso, a.shirtAccent || "#f6cf58", 0.44, 0.045, 0.035, 0, -0.29, 0.295);
    sphere(torso, "#ffffff", 0, -0.01, 0.35, 0.075, 0.08, 0.018);
    sphere(torso, a.shirtAccent || "#f6cf58", 0, -0.01, 0.372, 0.035, 0.04, 0.012);
  } else if (a.shirt === "jacket") {
    box(torso, "#f4f7fb", 0.055, 0.66, 0.04, 0, -0.01, 0.315);
    box(torso, a.shirtAccent || "#e8eef5", 0.15, 0.18, 0.035, -0.20, 0.22, 0.29);
    box(torso, a.shirtAccent || "#e8eef5", 0.15, 0.18, 0.035, 0.20, 0.22, 0.29);
    for (let i = 0; i < 3; i++) sphere(torso, "#f9fbff", 0, 0.19 - i * 0.16, 0.35, 0.018, 0.018, 0.012);
  } else {
    sphere(torso, a.shirtAccent || "#f5d25b", 0, -0.01, 0.33, 0.075, 0.075, 0.02);
    sphere(torso, "#ffffff", 0, -0.01, 0.352, 0.026, 0.026, 0.012);
  }
  if (a.shirt === "hoodie") {
    // Kangaroo-pocket seams and soft cuff-like accents.
    tube(torso, [[-0.19,-0.22,0.31],[-0.16,-0.31,0.34],[0.16,-0.31,0.34],[0.19,-0.22,0.31]], a.shirtAccent || "#eaf2fb", 0.012);
  }
  // A small shoulder patch and chest badge give each outfit a team-uniform feel.
  for (const side of [-1, 1]) {
    roundedBox(torso, a.shirtAccent || "#f5d25b", 0.12, 0.20, 0.035, 0.035, side * 0.31, 0.28, 0.302, 0.58);
  }
  roundedBox(torso, "#162b40", 0.38, 0.07, 0.035, 0.025, 0, -0.43, 0.302, 0.6);
  roundedBox(torso, a.shirtAccent || "#f5d25b", 0.09, 0.085, 0.045, 0.02, 0, -0.43, 0.33, 0.42);

  // Articulated arms: shoulder, sleeve, forearm and hand are grouped for animation.
  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.43, 1.48, 0);
    g.add(arm);
    sphere(arm, shirt, 0, -0.02, 0, 0.19, 0.20, 0.19);
    capsule(arm, shirt, 0.145, 0.25, 0, -0.22, 0, 0.78);
    capsule(arm, shirt, 0.125, 0.25, 0, -0.49, 0.025, 0.78);
    torus(arm, a.shirtAccent || "#eaf2fb", 0.122, 0.018, 0, -0.58, 0.025, 0);
    sphere(arm, skin, 0, -0.70, 0.055, 0.145, 0.145, 0.135);
    // Tiny thumb gives the hand a readable silhouette.
    sphere(arm, skin, side * -0.095, -0.69, 0.12, 0.055, 0.075, 0.06);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Legs are separate pivots so walking can have a visible, natural stride.
  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.83, 0);
    g.add(leg);
    capsule(leg, pants, 0.15, a.pants === "shorts" ? 0.20 : 0.29, 0, -0.16, 0, 0.82);
    capsule(leg, pants, 0.125, 0.22, 0, -0.45, 0.015, 0.82);
    if (a.pants === "cargo") {
      box(leg, a.pantsAccent || "#bac8d5", 0.075, 0.16, 0.035, side * 0.13, -0.30, 0.12);
      tube(leg, [[side*0.10,-0.24,0.145],[side*0.17,-0.24,0.145],[side*0.17,-0.37,0.145]], a.pantsAccent || "#bac8d5", 0.008);
    } else if (a.pants === "jeans") {
      tube(leg, [[side*0.105,-0.08,0.12],[side*0.12,-0.38,0.13],[side*0.11,-0.57,0.12]], "#7596bd", 0.009);
    }
    // Layered sneaker/boot: sole, upper, toe and laces.
    sphere(leg, "#f3f6fa", 0, -0.72, 0.085, 0.205, 0.085, 0.30);
    sphere(leg, shoeColor, 0, -0.66, 0.10, 0.19, a.shoes === "boots" ? 0.18 : 0.13, 0.28);
    sphere(leg, a.shoesAccent || "#e9f1fa", 0, -0.70, 0.335, 0.13, 0.055, 0.025);
    for (let i = 0; i < 3; i++) {
      tube(leg, [[-0.075,-0.62-i*0.035,0.30],[0,-0.60-i*0.035,0.32],[0.075,-0.62-i*0.035,0.30]], a.shoesAccent || "#f4f8fc", 0.009);
    }
    if (a.shoes === "high-top" || a.shoes === "boots") {
      torus(leg, a.shoesAccent || "#f4f8fc", 0.13, 0.018, 0, -0.54, 0.06, 0);
    }
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Soft chibi head and friendly face. The face looks toward +Z.
  const head = new THREE.Group();
  head.position.set(0, 2.10, 0);
  g.add(head);
  const headBase = sphere(head, skin, 0, 0, 0, 0.64, 0.68, 0.54, 0.82);

  // Small round ears with warm pink inner detail.
  for (const side of [-1, 1]) {
    sphere(head, skin, side * 0.595, -0.015, -0.005, 0.16, 0.19, 0.12);
    sphere(head, "#e99a91", side * 0.625, -0.025, 0.085, 0.065, 0.095, 0.024);
  }

  const browColor = a.hair && a.hair !== "none" ? hair : "#78534a";
  const eyes = [];
  for (const x of [-0.205, 0.205]) {
    const eye = new THREE.Group();
    eye.position.x = x;
    eye.userData.openScale = a.face === "wink" && x < 0 ? 0.18 : 1;
    eye.scale.y = eye.userData.openScale;
    head.add(eye);

    // Big glossy eyes with two highlights make the expression feel lively.
    sphere(eye, "#ffffff", 0, 0.045, 0.455, 0.15, 0.185, 0.064, 0.3);
    sphere(eye, a.eyeColor || "#55a9db", 0.012, 0.025, 0.514, 0.096, 0.117, 0.036, 0.3);
    sphere(eye, "#182b48", 0.018, 0.018, 0.545, 0.061, 0.079, 0.024, 0.26);
    sphere(eye, "#ffffff", -0.020, 0.073, 0.568, 0.032, 0.037, 0.014, 0.2);
    sphere(eye, "#ffffff", 0.045, -0.020, 0.568, 0.015, 0.018, 0.009, 0.2);
    eyes.push(eye);

    // Gentle curved eyebrows, never angled into an angry expression.
    tube(head, [
      [x - 0.105, 0.265, 0.452],
      [x, 0.298, 0.472],
      [x + 0.105, 0.265, 0.452]
    ], browColor, 0.018);
  }

  // Button nose, blush and a wide friendly smile.
  sphere(head, "#e9a08c", 0, -0.105, 0.505, 0.058, 0.048, 0.034, 0.7);
  sphere(head, "#fff0e8", -0.018, -0.085, 0.535, 0.018, 0.012, 0.008, 0.48);
  sphere(head, "#f28f9e", -0.385, -0.165, 0.425, 0.125, 0.073, 0.022, 0.76);
  sphere(head, "#f28f9e", 0.385, -0.165, 0.425, 0.125, 0.073, 0.022, 0.76);
  sphere(head, "#ffd9cf", -0.392, -0.147, 0.448, 0.030, 0.014, 0.009, 0.55);
  sphere(head, "#ffd9cf", 0.378, -0.147, 0.448, 0.030, 0.014, 0.009, 0.55);
  for (const side of [-1, 1]) {
    sphere(head, "#df7189", side * 0.43, -0.18, 0.444, 0.014, 0.014, 0.008, 0.58);
    sphere(head, "#df7189", side * 0.35, -0.19, 0.445, 0.012, 0.012, 0.008, 0.58);
  }

  if (a.face === "surprised") {
    sphere(head, "#8f465c", 0, -0.285, 0.502, 0.074, 0.086, 0.027, 0.5);
    sphere(head, "#f3a0ad", 0, -0.321, 0.527, 0.040, 0.024, 0.014, 0.5);
  } else {
    tube(head, [
      [-0.16, -0.235, 0.495],
      [-0.10, -0.292, 0.505],
      [0, -0.31, 0.512],
      [0.10, -0.292, 0.505],
      [0.16, -0.235, 0.495]
    ], "#9a5361", 0.022);
    if (a.face === "happy" || a.face === "wink") {
      sphere(head, "#fffaf5", 0, -0.282, 0.527, 0.082, 0.022, 0.010, 0.4);
      sphere(head, "#f39ab0", 0, -0.319, 0.528, 0.047, 0.022, 0.012, 0.5);
    }
  }

  // Round glasses are light and playful, not dark sunglasses.
  if (a.face === "nerd" || a.glasses) {
    const frameColor = "#55aebc";
    for (const x of [-0.19, 0.19]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.014, 8, 28), mat(frameColor, 0.42));
      lens.position.set(x, 0.045, 0.525);
      head.add(lens);
      // Leave the lens open so the big expressive eyes remain visible.
    }
    tube(head, [[-0.05,0.055,0.525],[0,0.075,0.545],[0.05,0.055,0.525]], frameColor, 0.014);
  }

  // Hair is built from soft overlapping curls and rounded locks; no sharp spikes.
  if (a.hair && a.hair !== "none") {
    sphere(head, hair, 0, 0.405, -0.055, 0.535, 0.245, 0.46);
    if (a.hair === "spiky") {
      for (let i = 0; i < 7; i++) {
        const tuft = sphere(
          head, hair, -0.34 + i * 0.113,
          0.49 + (i % 2) * 0.055,
          0.105 + (i % 3) * 0.018,
          0.135, 0.18 + (i % 2) * 0.025, 0.16
        );
        tuft.rotation.z = (i - 3) * -0.12;
      }
      sphere(head, hair, -0.15, 0.30, 0.335, 0.29, 0.13, 0.15);
      sphere(head, hair, 0.13, 0.32, 0.32, 0.27, 0.12, 0.15);
    } else if (a.hair === "short" || a.hair === "sidepart") {
      sphere(head, hair, -0.22, 0.32, 0.31, 0.29, 0.15, 0.19);
      sphere(head, hair, 0.10, 0.35, 0.32, 0.29, 0.13, 0.18);
      if (a.hair === "sidepart") sphere(head, hair, -0.03, 0.43, 0.22, 0.23, 0.12, 0.22);
    } else if (a.hair === "long" || a.hair === "bob") {
      sphere(head, hair, -0.47, -0.10, 0.005, 0.15, 0.43, 0.20);
      sphere(head, hair, 0.47, -0.10, 0.005, 0.15, 0.43, 0.20);
      sphere(head, hair, -0.21, 0.31, 0.30, 0.28, 0.14, 0.18);
      sphere(head, hair, 0.12, 0.33, 0.29, 0.28, 0.13, 0.18);
      if (a.hair === "bob") sphere(head, hair, 0, -0.39, 0.12, 0.45, 0.13, 0.19);
    } else if (a.hair === "ponytail") {
      sphere(head, hair, 0.38, 0.02, -0.38, 0.16, 0.30, 0.15);
      sphere(head, hair, 0.40, -0.22, -0.39, 0.14, 0.16, 0.13);
      sphere(head, hair, -0.18, 0.30, 0.31, 0.27, 0.13, 0.17);
    } else if (a.hair === "curly" || a.hair === "afro") {
      const count = a.hair === "afro" ? 18 : 13;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = a.hair === "afro" ? 0.39 : 0.33;
        const curl = sphere(
          head, hair,
          Math.cos(angle) * radius,
          0.37 + Math.sin(i * 2.1) * 0.055,
          -0.04 + Math.sin(angle) * 0.29,
          0.145, 0.145, 0.145
        );
        curl.rotation.z = Math.sin(angle) * 0.2;
      }
      sphere(head, hair, -0.18, 0.32, 0.30, 0.24, 0.13, 0.17);
      sphere(head, hair, 0.14, 0.34, 0.29, 0.24, 0.12, 0.17);
    }
  }

  // Headwear and accessories.
  if (a.hat === "cap") {
    sphere(head, a.hatColor || "#e4edf7", 0, 0.53, -0.01, 0.55, 0.15, 0.47);
    sphere(head, a.hatColor || "#e4edf7", 0, 0.46, 0.37, 0.43, 0.045, 0.25);
    sphere(head, a.hatAccent || "#f6d365", 0, 0.52, 0.47, 0.085, 0.035, 0.018);
  } else if (a.hat === "beanie") {
    sphere(head, a.hatColor || "#e25778", 0, 0.52, -0.02, 0.53, 0.22, 0.46);
    box(head, a.hatColor || "#e25778", 0.82, 0.085, 0.66, 0, 0.39, 0);
    sphere(head, a.hatAccent || "#f8e7eb", 0, 0.75, -0.02, 0.07, 0.07, 0.07);
  } else if (a.hat === "crown") {
    box(head, "#f2c94c", 0.47, 0.11, 0.33, 0, 0.55, 0);
    for (let i = -1; i <= 1; i++) {
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 8), mat("#ffdc70"));
      point.position.set(i * 0.15, 0.69, 0);
      head.add(point);
    }
  } else if (a.hat === "headphones") {
    const band = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.47,0.12,0), new THREE.Vector3(-0.48,0.42,0),
      new THREE.Vector3(0,0.63,-0.01), new THREE.Vector3(0.48,0.42,0),
      new THREE.Vector3(0.47,0.12,0)
    ]);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(band, 24, 0.043, 8, false), mat("#263c55")));
    sphere(head, "#263c55", -0.50, -0.02, 0.01, 0.105, 0.19, 0.14);
    sphere(head, "#263c55", 0.50, -0.02, 0.01, 0.105, 0.19, 0.14);
    sphere(head, a.hatAccent || "#55dfff", -0.55, -0.02, 0.11, 0.035, 0.075, 0.035);
    sphere(head, a.hatAccent || "#55dfff", 0.55, -0.02, 0.11, 0.035, 0.075, 0.035);
  } else if (a.hat === "bunny-ears") {
    for (const side of [-1, 1]) {
      const tilt = -side * 0.16;
      const ear = sphere(head, a.hatColor || hair, side * 0.25, 0.70, -0.055, 0.135, 0.35, 0.115);
      ear.rotation.z = tilt;
      const inner = sphere(head, a.hatAccent || "#f5a2bd", side * 0.25, 0.70, 0.052, 0.063, 0.255, 0.018);
      inner.rotation.z = tilt;
    }
    sphere(head, a.hatColor || hair, 0, 0.47, 0.22, 0.16, 0.12, 0.11);
  } else if (a.hat === "cat-ears") {
    for (const side of [-1, 1]) {
      const ear = sphere(head, a.hatColor || hair, side * 0.34, 0.61, -0.045, 0.19, 0.23, 0.13);
      ear.rotation.z = -side * 0.28;
      const inner = sphere(head, a.hatAccent || "#f5a2bd", side * 0.34, 0.62, 0.075, 0.085, 0.13, 0.025);
      inner.rotation.z = -side * 0.28;
    }
  } else if (a.hat === "bear-ears") {
    for (const side of [-1, 1]) {
      sphere(head, a.hatColor || hair, side * 0.46, 0.49, -0.075, 0.19, 0.19, 0.14);
      sphere(head, a.hatAccent || "#f5a2bd", side * 0.46, 0.49, 0.055, 0.105, 0.105, 0.025);
    }
  } else if (a.hat === "bow") {
    const bowColor = a.hatAccent || "#ff9bc8";
    const leftLoop = sphere(head, bowColor, -0.43, 0.32, 0.29, 0.17, 0.115, 0.07);
    leftLoop.rotation.z = -0.32;
    const rightLoop = sphere(head, bowColor, -0.27, 0.32, 0.29, 0.17, 0.115, 0.07);
    rightLoop.rotation.z = 0.32;
    sphere(head, "#fff1f6", -0.35, 0.32, 0.355, 0.055, 0.065, 0.025);
  } else if (a.hat === "flower-clip") {
    const petalColor = a.hatAccent || "#ffe36e";
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      sphere(head, petalColor, 0.42 + Math.cos(angle) * 0.105, 0.30 + Math.sin(angle) * 0.105, 0.31, 0.085, 0.085, 0.055);
    }
    sphere(head, "#fff4b8", 0.42, 0.30, 0.38, 0.075, 0.075, 0.035);
  }

  // Small silhouette accents make the avatar read better at game-camera distance.
  sphere(g, a.shirtAccent || "#f5d25b", -0.39, 1.48, 0.15, 0.045, 0.045, 0.035);
  sphere(g, a.shirtAccent || "#f5d25b", 0.39, 1.48, 0.15, 0.045, 0.045, 0.035);

  // Keep only the large silhouette meshes in the shadow pass. Fine face,
  // hair and clothing details remain lit, but do not create dozens of shadow casters.
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
  torsoBody.castShadow = true;
  headBase.castShadow = true;

  g.userData.rig = { torso, head, leftArm, rightArm, leftLeg, rightLeg, eyes };
  g.userData.moving = false;
  return g;
}

function updateLobbySocial() {
  const avatars = [];
  if (playerMesh) avatars.push(playerMesh);
  Object.values(remotePlayers).forEach((entry) => avatars.push(entry.mesh));

  if (activeState?.phase !== "lobby") {
    avatars.forEach((mesh) => { mesh.userData.socialLookYaw = 0; });
    return;
  }
  avatars.forEach((mesh) => {
    let nearest = null;
    let nearestDistance = 12;
    avatars.forEach((other) => {
      if (other === mesh) return;
      const dx = other.position.x - mesh.position.x;
      const dz = other.position.z - mesh.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { dx, dz };
      }
    });
    let desiredYaw = 0;
    if (nearest) {
      desiredYaw = Math.atan2(nearest.dx, nearest.dz) - mesh.rotation.y;
      desiredYaw = Math.atan2(Math.sin(desiredYaw), Math.cos(desiredYaw));
    }
    const currentYaw = Number(mesh.userData.socialLookYaw || 0);
    const yawDelta = Math.atan2(
      Math.sin(desiredYaw - currentYaw),
      Math.cos(desiredYaw - currentYaw)
    );
    mesh.userData.socialLookYaw = currentYaw + yawDelta * 0.075;
  });
}

function avatarGroundHeight(mesh) {
  const winnerTarget = mesh?.userData?.winnerTarget;
  if (winnerTarget) return Number(winnerTarget.y || 0);
  return answerBaySurfaceAt(
    Number(mesh?.position?.x || 0),
    Number(mesh?.position?.z || 0)
  );
}

function animateAvatar(mesh, time, moving = false) {
  const rig = mesh?.userData?.rig;
  if (!rig) return;
  const t = time * 0.001;
  const stride = t * 10.5;
  const walk = moving ? 1 : 0;
  const swing = Math.sin(stride) * walk;
  const groundHeight = avatarGroundHeight(mesh);
  const airborne = mesh.position.y > groundHeight + 0.16;
  rig.leftArm.rotation.x = swing * 0.68 + Math.sin(t * 2.2) * 0.035;
  rig.rightArm.rotation.x = -swing * 0.68 + Math.sin(t * 2.2 + 0.8) * 0.035;
  rig.leftArm.rotation.z = (airborne ? 0.42 : -0.035) - swing * 0.10;
  rig.rightArm.rotation.z = (airborne ? -0.42 : 0.035) + swing * 0.10;
  rig.leftLeg.rotation.x = airborne ? -0.42 : -swing * 0.78;
  rig.rightLeg.rotation.x = airborne ? -0.42 : swing * 0.78;
  rig.torso.position.y = 1.29 + (walk ? Math.abs(Math.sin(stride * 2)) * 0.05 : Math.sin(t * 3.1) * 0.04);
  rig.torso.rotation.z = Math.sin(t * 1.5) * 0.018 + swing * 0.018;
  rig.head.rotation.x = Math.sin(t * 1.35) * 0.025 - Math.abs(swing) * 0.028 + (airborne ? -0.08 : 0);
  const socialEnabled = activeState?.phase === "lobby" && !moving && !airborne;
  const socialOffset = Number(mesh.userData.socialOffset || 0);
  const socialCycle = (time + socialOffset) % 14500;
  const socialWave = socialEnabled && socialCycle < 920
    ? Math.sin((socialCycle / 920) * Math.PI)
    : 0;
  const socialLook = socialEnabled ? Number(mesh.userData.socialLookYaw || 0) : 0;
  rig.head.rotation.y = socialLook * 0.48 + Math.sin(t * 0.72) * 0.035;
  rig.head.rotation.z = Math.sin(t * 1.35) * 0.035 + Math.sin(t * 0.55) * 0.012;
  if (socialWave > 0) {
    rig.rightArm.rotation.z -= 1.02 * socialWave;
    rig.rightArm.rotation.x += Math.sin(t * 17) * 0.24 * socialWave;
    rig.torso.rotation.z -= 0.045 * socialWave;
  }

  const reaction = mesh.userData.reaction;
  if (reaction) {
    const progress = (time - reaction.startedAt) / reaction.duration;
    if (progress >= 1) {
      mesh.userData.reaction = null;
    } else if (progress >= 0) {
      const strength = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1));
      if (reaction.kind === "correct" || reaction.kind === "victory") {
        const bounce = Math.abs(Math.sin(t * 10.5)) * strength;
        rig.leftArm.rotation.z += 0.78 * strength;
        rig.rightArm.rotation.z -= 0.78 * strength;
        rig.leftLeg.rotation.x -= 0.34 * strength;
        rig.rightLeg.rotation.x -= 0.34 * strength;
        rig.torso.position.y += 0.12 * strength + 0.13 * bounce;
        rig.head.rotation.z += Math.sin(t * 7.5) * 0.055 * strength;
      } else if (reaction.kind === "wrong" || reaction.kind === "missed") {
        rig.leftArm.rotation.z -= 0.28 * strength;
        rig.rightArm.rotation.z += 0.28 * strength;
        rig.leftArm.rotation.x += 0.18 * strength;
        rig.rightArm.rotation.x += 0.18 * strength;
        rig.torso.rotation.z += 0.105 * strength;
        rig.head.rotation.x += 0.13 * strength;
        rig.head.rotation.z += 0.12 * strength;
      } else if (reaction.kind === "reveal") {
        rig.head.rotation.x -= 0.095 * strength;
        rig.head.rotation.z += Math.sin(t * 3.2) * 0.035 * strength;
      }
    }
  }

  const winnerRank = mesh.userData.winnerMoving ? 0 : Number(mesh.userData.winnerRank || 0);
  if (winnerRank === 1) {
    rig.leftArm.rotation.z += 0.88;
    rig.rightArm.rotation.z -= 0.88;
    rig.head.rotation.z += Math.sin(t * 2.2) * 0.025;
  } else if (winnerRank === 2) {
    rig.rightArm.rotation.z -= 0.92;
    rig.rightArm.rotation.x += Math.sin(t * 3.1) * 0.12;
    rig.head.rotation.z -= 0.035;
  } else if (winnerRank === 3) {
    rig.leftArm.rotation.z += 0.64;
    rig.rightArm.rotation.z -= 0.64;
    rig.torso.rotation.z += Math.sin(t * 3.8) * 0.035;
  }

  // A quick, staggered blink keeps the faces from looking like static dolls.
  const blinkPhase = (t + (mesh.id % 17) * 0.31) % 5.4;
  let blinkScale = 1;
  if (blinkPhase < 0.07) blinkScale = 1 - (blinkPhase / 0.07) * 0.88;
  else if (blinkPhase < 0.14) blinkScale = 0.12 + ((blinkPhase - 0.07) / 0.07) * 0.88;
  rig.eyes.forEach((eye) => { eye.scale.y = eye.userData.openScale * blinkScale; });
}

function disposeAvatar(mesh) {
  if (!mesh) return;
  const released = new Set();
  mesh.traverse((node) => {
    if (node.geometry && !node.isSprite && !sharedAvatarGeometries.has(node.geometry) && !released.has(node.geometry)) {
      released.add(node.geometry);
      node.geometry.dispose();
    }
    if (node.userData?.isAvatarNameTag && node.material) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
}
function socialOffsetFor(identity) {
  let hash = 2166136261;
  for (const char of String(identity || "player")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 14500;
}
function setAvatarSocialIdentity(mesh, identity) {
  if (!mesh) return;
  mesh.userData.socialOffset = socialOffsetFor(identity);
  mesh.userData.socialLookYaw = 0;
}
function setAvatarNameTag(mesh, name) {
  if (!mesh) return;
  const label = String(name || "Pemain").trim().slice(0, 18) || "Pemain";
  const current = mesh.userData.nameTag;
  if (current?.userData.label === label) return;
  if (current) {
    mesh.remove(current);
    current.material?.map?.dispose();
    current.material?.dispose();
  }
  const tag = labelSprite(label, "#58d6ff");
  tag.scale.set(1.92, 0.48, 1);
  tag.position.set(0, 3.48, 0);
  tag.material.depthTest = false;
  tag.material.depthWrite = false;
  tag.renderOrder = 20;
  tag.userData.label = label;
  tag.userData.isAvatarNameTag = true;
  mesh.add(tag);
  mesh.userData.nameTag = tag;
}
function setOwnAvatar(a) {
  ownAvatar = a;
  if (playerMesh) {
    scene.remove(playerMesh);
    disposeAvatar(playerMesh);
  }
  playerMesh = createAvatar(a);
  setAvatarSocialIdentity(playerMesh, uid || "local-player");
  setAvatarNameTag(playerMesh, $("name")?.value || "Pemain");
  playerMesh.position.set(ownPosition.x, answerBaySurfaceAt(ownPosition.x, ownPosition.z), ownPosition.z);
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
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = auth.currentUser.uid;
  connection("Firebase Spark terhubung", true);
}
function stopListeners() {
  if (stateUnsubscribe) stateUnsubscribe();
  if (playersUnsubscribe) playersUnsubscribe();
  stateUnsubscribe = playersUnsubscribe = null;
  Object.values(remotePlayers).forEach((p) => {
    scene.remove(p.mesh);
    disposeAvatar(p.mesh);
  });
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
  const x = Number(data.x || 0);
  const z = Number(data.z || 0);
  const y = answerBaySurfaceAt(x, z);
  const name = String(data.name || "Pemain");
  let entry = remotePlayers[id];
  if (!entry || entry.signature !== signature) {
    if (entry) {
      scene.remove(entry.mesh);
      disposeAvatar(entry.mesh);
    }
    const mesh = createAvatar(data.avatar || {});
    setAvatarSocialIdentity(mesh, id);
    mesh.position.set(x, y, z);
    setAvatarNameTag(mesh, name);
    entry = {
      mesh, signature, lastMoveAt: 0,
      lastX: x, lastZ: z, targetX: x, targetY: y, targetZ: z,
      targetYaw: 0
    };
    remotePlayers[id] = entry;
    scene.add(entry.mesh);
    if (activeState?.phase === "reveal") triggerAvatarReaction(entry.mesh, "reveal", 1.2);
    else if (activeState?.phase === "finished") triggerAvatarReaction(entry.mesh, "victory", 2.25);
  } else {
    setAvatarNameTag(entry.mesh, name);
  }
  const dx = x - entry.lastX;
  const dz = z - entry.lastZ;
  if (Math.hypot(dx, dz) > 0.035) {
    entry.lastMoveAt = performance.now();
    entry.targetYaw = Math.atan2(dx, dz);
  }
  entry.lastX = x;
  entry.lastZ = z;
  entry.targetX = x;
  entry.targetY = y;
  entry.targetZ = z;
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
    if (!playerData[id]) {
      scene.remove(remotePlayers[id].mesh);
      disposeAvatar(remotePlayers[id].mesh);
      delete remotePlayers[id];
    }
  });
  const me = playerData[uid];
  if (me) {
    $("score").textContent = String(Number(me.score || 0));
    $("streak").textContent = String(Number(me.streak || 0));
    if (activeState?.phase === "reveal") settleMyScore(activeState).catch(console.warn);
  }
  if (activeState?.phase === "reveal") renderRoundLeaderboard();
  if (activeState?.phase === "finished") applyWinnerPlacements(activeState.podium || []);
}
function lobbyFromState(state) {
  $("roomPin").textContent = roomPin;
  $("quizName").textContent = state.title || "QuizVerse Quiz";
  $("questionCount").textContent = Number(state.totalQuestions || 0) + " pertanyaan";
  $("roomLabel").textContent = "ROOM " + roomPin;
  $("hostNote").textContent = isHost ? "Host Console aktif. Bagikan link pemain dan PIN, lalu mulai saat semua siap." : "Menunggu host memulai permainan...";
  $("startGame").classList.toggle("hidden", !isHost || state.phase !== "lobby");
  $("playerInvite").classList.toggle("hidden", !isHost);
  if (isHost) $("playerJoinLink").textContent = playerInviteUrl();
}
function playerInviteUrl() {
  const url = new URL("./player.html", location.href);
  url.searchParams.set("pin", roomPin);
  return url.href;
}
function subscribeRoom() {
  stopListeners();
  // A new room subscription must render its first live question, even after switching rooms.
  lastQuestionIndex = -1;
  lastVisualStateKey = "";
  stateUnsubscribe = onValue(dbPath(`rooms/${roomPin}/public`), (snap) => {
    activeState = snap.val();
    if (!activeState) return;
    const visualStateKey = String(activeState.questionIndex) + ":" + String(activeState.phase);
    const visualPhaseChanged = visualStateKey !== lastVisualStateKey;
    lastVisualStateKey = visualStateKey;
    lobbyFromState(activeState);
    if (activeState.phase === "lobby") {
      showScreen("lobbyScreen");
    } else if (activeState.phase === "question") {
      if (lastQuestionIndex !== Number(activeState.questionIndex)) {
        lastQuestionIndex = Number(activeState.questionIndex);
        localAnswerRound = -1;
        localAnswerIndex = -1;
        answerBusy = false;
        ownPosition = { x: 0, z: 0 };
        if (playerMesh) playerMesh.position.set(0, 0, 0);
        renderQuestion(activeState);
        triggerQuestionStart();
      }
      showScreen("hud");
    } else if (activeState.phase === "reveal") {
      // Rebuild the current question for players reconnecting after the reveal has begun.
      if (lastQuestionIndex !== Number(activeState.questionIndex)) {
        lastQuestionIndex = Number(activeState.questionIndex);
        renderQuestion(activeState);
      }
      showScreen("hud");
      if (visualPhaseChanged) triggerAnswerReveal(activeState);
      $("feedback").textContent = "Jawaban benar: " + String.fromCharCode(65 + Number(activeState.correctOption)) +
        (activeState.explanation ? " · " + activeState.explanation : "");
      renderRoundLeaderboard();
      $("answers").querySelectorAll("span").forEach((el, index) => {
        el.style.borderColor = index === Number(activeState.correctOption) ? "#79e8b8" : "#25425c";
        el.style.background = index === Number(activeState.correctOption) ? "#154b43" : "#102238";
      });
      settleMyScore(activeState).catch((error) => console.warn("Settle score:", error));
    } else if (activeState.phase === "finished") {
      if (visualPhaseChanged) triggerGameFinish(activeState.podium || []);
      $("roundLeaderboard").classList.add("hidden");
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
  // Host is a controller, not a roster player; only Players need a player disconnect hook.
  if (!isHost) await onDisconnect(dbPath(`rooms/${roomPin}/players/${uid}/connected`)).set(false);
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
  $("roundLeaderboard").classList.add("hidden");
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
    const cleaned = validateQuestionBank();
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
    questionBank = cleaned;
    saveHostDraft();
    const title = questionBank.title;
    const duration = questionBank.durationSeconds;

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
    sessionStorage.setItem(HOST_SESSION_KEY, JSON.stringify({ pin }));
    await enterLobby();
    connection("Host room " + pin, true);
    status("Room siap. Bagikan link pemain dan PIN.");
  } catch (error) {
    status(explainError(error), true);
  }
}

function findSpawnPosition(players = {}) {
  const occupied = Object.values(players || {}).map((person) => ({
    x: Number(person?.x || 0),
    z: Number(person?.z || 0)
  }));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 160; i++) {
    const radius = 13 + Math.sqrt(i) * 0.48;
    const angle = i * goldenAngle;
    const candidate = {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius
    };
    const clearPlayers = occupied.every((point) => Math.hypot(point.x - candidate.x, point.z - candidate.z) > 2.2);
    const clearPlatforms = PAD_POINTS.every((point) => Math.hypot(point.x - candidate.x, point.z - candidate.z) > 5.2);
    if (clearPlayers && clearPlatforms) return candidate;
  }
  // The room cap is 40; this fallback is only defensive if stored coordinates are malformed.
  return { x: 0, z: 0 };
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
      uid, ...profile, x: ownPosition.x, z: ownPosition.z, score: 0, streak: 0,
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
    const playersSnap = await get(dbPath(`rooms/${pin}/players`));
    const players = playersSnap.val() || {};
    const existingPlayer = await get(dbPath(`rooms/${pin}/players/${uid}`));
    if (!meta || !["lobby", "playing"].includes(meta.status) || (meta.status === "playing" && !existingPlayer.exists())) {
      throw new Error("Room tidak ditemukan, sudah selesai, atau permainan sudah dimulai.");
    }
    if (!existingPlayer.exists() && Object.keys(players).length >= Number(meta.maxPlayers || 40)) {
      throw new Error("Room sudah penuh (maksimal 40 pemain).");
    }
    roomPin = pin;
    isHost = false;
    const savedProfile = existingPlayer.val() || {};
    ownPosition = existingPlayer.exists()
      ? { x: Number(savedProfile.x || 0), z: Number(savedProfile.z || 0) }
      : findSpawnPosition(players);
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
    localAnswerIndex = Number(index);
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
  if (!own) return;
  const alreadyScored = Number(own.lastScoredQuestionIndex ?? -1) >= round;
  scoreBusyRound = round;
  try {
    const answerSnap = await get(dbPath(`submissions/${roomPin}/current/${uid}`));
    const answer = answerSnap.val();
    const hasThisAnswer = answer && Number(answer.questionIndex) === round;
    const correct = Boolean(hasThisAnswer && Number(answer.answerIndex) === Number(state.correctOption));
    if (playerMesh && (localAnswerRound !== round || localAnswerIndex < 0)) {
      localAnswerRound = round;
      localAnswerIndex = hasThisAnswer ? Number(answer.answerIndex) : -1;
      triggerAvatarReaction(playerMesh, correct ? "correct" : hasThisAnswer ? "wrong" : "missed", 1.85);
    }
    if (alreadyScored) return;
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
function renderRoundLeaderboard() {
  const panel = $("roundLeaderboard");
  const list = $("roundLeaderboardList");
  const rankLabel = $("myRank");
  if (!panel || !list || !rankLabel) return;

  const sorted = Object.entries(playerData || {})
    .map(([id, person]) => ({
      id,
      name: String(person?.name || "Pemain").trim().slice(0, 18) || "Pemain",
      score: Math.max(0, Number(person?.score) || 0)
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const ranking = sorted.map((person, index) => ({
    ...person,
    rank: index > 0 && person.score === sorted[index - 1].score
      ? null
      : index + 1
  }));
  // Competition ranking: tied players share the same position.
  ranking.forEach((person, index) => {
    if (person.rank === null) {
      const previous = ranking[index - 1];
      person.rank = previous.rank;
    }
  });

  const myIndex = ranking.findIndex((person) => person.id === uid);
  rankLabel.textContent = isHost
    ? ranking.length + " PESERTA"
    : myIndex >= 0
      ? "POSISI KAMU #" + ranking[myIndex].rank + " / " + ranking.length
      : "MENUNGGU SKOR";

  list.replaceChildren();
  panel.classList.remove("hidden");
  if (!ranking.length) {
    const empty = document.createElement("p");
    empty.className = "round-rank-empty";
    empty.textContent = "Belum ada pemain di klasemen.";
    list.appendChild(empty);
    return;
  }

  const visible = ranking.slice(0, 5);
  if (!isHost && myIndex >= 5) {
    visible.push(null, ranking[myIndex]);
  }

  visible.forEach((person) => {
    if (!person) {
      const gap = document.createElement("div");
      gap.className = "round-rank-gap";
      gap.textContent = "···";
      gap.setAttribute("aria-hidden", "true");
      list.appendChild(gap);
      return;
    }
    const row = document.createElement("div");
    row.className = "round-rank-entry" + (person.id === uid ? " is-me" : "");
    const rank = document.createElement("span");
    rank.className = "round-rank-number";
    rank.textContent = person.rank === 1 ? "🥇" : person.rank === 2 ? "🥈" : person.rank === 3 ? "🥉" : "#" + person.rank;
    const name = document.createElement("span");
    name.className = "round-rank-name";
    name.textContent = person.name;
    const score = document.createElement("strong");
    score.className = "round-rank-score";
    score.textContent = person.score + " pts";
    row.append(rank, name, score);
    list.appendChild(row);
  });
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
        const podium = Object.entries(playerData)
          .map(([playerUid, p]) => ({ uid: playerUid, name: p.name || "Pemain", score: Number(p.score || 0) }))
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3);
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
function emptyQuestion() {
  return { id: "", category: "Umum", question: "", options: ["", "", "", ""], answerIndex: 0, explanation: "" };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function setDraftStatus(message) {
  const target = $("draftStatus");
  if (target) target.textContent = message;
}
function saveHostDraft() {
  if (!questionBank) return;
  questionBank.title = $("quizTitle").value.trim() || "QuizVerse Challenge";
  questionBank.durationSeconds = Number($("duration").value || 15);
  try {
    sessionStorage.setItem(HOST_DRAFT_KEY, JSON.stringify(questionBank));
    setDraftStatus("✓ Draft tersimpan otomatis di tab Host ini.");
  } catch (error) {
    setDraftStatus("Draft tidak dapat disimpan oleh browser ini: " + error.message);
  }
  $("draftQuestionCount").textContent = questionBank.questions.length + " soal";
}
function renderQuestionEditor() {
  const list = $("questionEditorList");
  if (!list || !questionBank) return;
  list.innerHTML = questionBank.questions.map((q, qi) => {
    const options = (q.options || ["", "", "", ""]).map((value, oi) => `
      <div class="option-edit option-${"ABCD"[oi]}">
        <input type="radio" name="correct-${qi}" value="${oi}" data-question-index="${qi}" data-field="answerIndex" ${Number(q.answerIndex) === oi ? "checked" : ""} aria-label="Tandai opsi ${"ABCD"[oi]} sebagai jawaban benar">
        <span class="option-letter">${"ABCD"[oi]}</span>
        <input type="text" maxlength="180" placeholder="Tulis pilihan ${"ABCD"[oi]}" value="${escapeHtml(value)}" data-question-index="${qi}" data-option-index="${oi}" data-field="option">
      </div>`).join("");
    return `
      <article class="question-editor" data-question-card="${qi}">
        <div class="question-editor-head">
          <strong>PERTANYAAN ${String(qi + 1).padStart(2, "0")}</strong>
          <button type="button" class="remove-question" data-action="remove-question" data-question-index="${qi}" ${questionBank.questions.length === 1 ? "disabled" : ""}>Hapus</button>
        </div>
        <label class="field">Kategori<input type="text" maxlength="40" value="${escapeHtml(q.category)}" data-question-index="${qi}" data-field="category" placeholder="Umum / Sains / Sejarah"></label>
        <label class="field">Teks pertanyaan<textarea rows="2" maxlength="500" data-question-index="${qi}" data-field="question" placeholder="Tulis pertanyaan di sini...">${escapeHtml(q.question)}</textarea></label>
        <div class="options-title">PILIHAN JAWABAN <span>Pilih lingkaran untuk jawaban benar</span></div>
        <div class="editor-options">${options}</div>
        <label class="field explanation-field">Penjelasan setelah jawaban (opsional)<textarea rows="2" maxlength="300" data-question-index="${qi}" data-field="explanation" placeholder="Berikan penjelasan singkat...">${escapeHtml(q.explanation)}</textarea></label>
      </article>`;
  }).join("");
  $("draftQuestionCount").textContent = questionBank.questions.length + " soal";
}
function loadHostDraft() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(HOST_DRAFT_KEY) || "null"); } catch { saved = null; }
  if (saved && Array.isArray(saved.questions)) {
    questionBank = {
      title: String(saved.title || "QuizVerse Challenge"),
      durationSeconds: Number(saved.durationSeconds || 15),
      questions: saved.questions.map((q) => ({
        id: String(q.id || ""), category: String(q.category || "Umum"),
        question: String(q.question || ""),
        options: Array.isArray(q.options) ? [0, 1, 2, 3].map((i) => String(q.options[i] || "")) : ["", "", "", ""],
        answerIndex: Number.isInteger(Number(q.answerIndex)) ? Number(q.answerIndex) : 0,
        explanation: String(q.explanation || "")
      }))
    };
  } else {
    questionBank = { title: "QuizVerse Challenge", durationSeconds: 15, questions: [emptyQuestion()] };
  }
  $("quizTitle").value = questionBank.title;
  $("duration").value = String(questionBank.durationSeconds);
  renderQuestionEditor();
  if (saved) setDraftStatus("✓ Draft sebelumnya dipulihkan dari tab ini.");
}
function validateQuestionBank() {
  if (!questionBank || !Array.isArray(questionBank.questions) || !questionBank.questions.length) {
    throw new Error("Tambahkan minimal satu pertanyaan.");
  }
  if (questionBank.questions.length > 50) throw new Error("Maksimal 50 pertanyaan per room.");
  const questions = questionBank.questions.map((q, index) => {
    const options = Array.isArray(q.options) ? q.options.map((value) => String(value || "").trim()) : [];
    if (!String(q.question || "").trim()) throw new Error("Pertanyaan " + (index + 1) + " belum diisi.");
    if (options.length !== 4 || options.some((value) => !value)) {
      throw new Error("Lengkapi empat pilihan jawaban pada pertanyaan " + (index + 1) + ".");
    }
    const answerIndex = Number(q.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      throw new Error("Pilih jawaban benar pada pertanyaan " + (index + 1) + ".");
    }
    return {
      id: String(q.id || "q" + index), category: String(q.category || "Umum").trim() || "Umum",
      question: String(q.question).trim(), options, answerIndex,
      explanation: String(q.explanation || "").trim()
    };
  });
  return {
    title: $("quizTitle").value.trim() || "QuizVerse Challenge",
    durationSeconds: Math.max(10, Math.min(30, Number($("duration").value || 15))),
    questions
  };
}
function isWardrobeItemSelected(item) {
  if (item.preset) return JSON.stringify(selectedAvatar) === JSON.stringify(item.preset.avatar);
  return Object.entries(item.patch || {}).every(([key,value])=>selectedAvatar[key]===value);
}
function updateAvatarSelectionLabels() {
  $("selectedCharacterLabel").textContent=selectedLookName;
  $("previewCharacterName").textContent=selectedLookName;
  const preset=CHARACTER_PRESETS.find(p=>p.name===selectedLookName);
  $("previewCharacterRole").textContent=preset?.role||"CUSTOM AVATAR";
}
function refreshAvatarAppearance() {
  setOwnAvatar(appearance());
  refreshAvatarPreview();
  updateAvatarSelectionLabels();
  renderWardrobeGrid();
}
function renderWardrobeNav() {
  $("wardrobeNav").innerHTML=WARDROBE_CATEGORIES.map(c=>`
    <button type="button" class="wardrobe-nav-item ${c.id===activeWardrobeCategory?"active":""}" data-wardrobe-category="${c.id}" aria-label="${c.label}" title="${c.label}">
      <span>${c.icon}</span><small>${c.label}</small>
    </button>`).join("");
}
function wardrobeItemArt(item) {
  if (item.preset) {
    const avatar = item.preset.avatar;
    return `<span class="mini-avatar" style="--mini-skin:${avatar.skin};--mini-hair:${avatar.hairColor};--mini-shirt:${avatar.shirtColor};--mini-pants:${avatar.pantsColor}">
      <i class="mini-avatar-hair"></i><i class="mini-avatar-head"></i>
      <i class="mini-avatar-eye mini-eye-left"></i><i class="mini-avatar-eye mini-eye-right"></i>
      <i class="mini-avatar-smile"></i><i class="mini-avatar-body"></i>
      <i class="mini-avatar-arm mini-arm-left"></i><i class="mini-avatar-arm mini-arm-right"></i>
      <i class="mini-avatar-leg mini-leg-left"></i><i class="mini-avatar-leg mini-leg-right"></i>
    </span>`;
  }
  if (item.color) return '<i class="wardrobe-color-chip"></i>';
  const patch = item.patch || {};
  if (patch.face) {
    const expressions = { smile:"☺", happy:"😄", cool:"😎", wink:"😉", surprised:"😮", serious:"😐", nerd:"🤓", sleepy:"😴" };
    return `<b class="wardrobe-feature-icon">${expressions[patch.face] || "☺"}</b>`;
  }
  if (patch.hair) {
    return `<i class="wardrobe-hair-swatch hair-${patch.hair}"></i>`;
  }
  if (patch.shirt) {
    return `<i class="wardrobe-clothes-swatch shirt-swatch"><b></b><b></b></i>`;
  }
  if (patch.pants) {
    return `<i class="wardrobe-clothes-swatch pants-swatch"><b></b><b></b></i>`;
  }
  if (patch.shoes) {
    return `<i class="wardrobe-shoes-swatch"><b></b><b></b></i>`;
  }
  if (patch.hat) return `<b class="wardrobe-feature-icon">${item.icon || "♛"}</b>`;
  return `<b class="wardrobe-feature-icon">${item.icon || "✦"}</b>`;
}
function renderWardrobeGrid() {
  const c=WARDROBE_CATEGORIES.find(x=>x.id===activeWardrobeCategory)||WARDROBE_CATEGORIES[0];
  $("wardrobeTitle").textContent=c.title;
  $("wardrobeSubtitle").textContent=c.subtitle;
  $("wardrobeCount").textContent=String(c.groups.reduce((n,g)=>n+g.items.length,0)).padStart(2,"0")+" ITEMS";
  $("wardrobeGrid").innerHTML=c.groups.map((g,gi)=>`
    <section class="wardrobe-group">
      <header class="wardrobe-group-head"><strong>${g.title}</strong><span>${String(g.items.length).padStart(2,"0")}</span></header>
      <div class="wardrobe-items">${g.items.map((item,ii)=>`
        <button type="button" class="wardrobe-item ${isWardrobeItemSelected(item)?"selected":""}" data-group-index="${gi}" data-item-index="${ii}" aria-pressed="${isWardrobeItemSelected(item)}">
          <span class="wardrobe-item-art ${item.color?"is-color":""}" ${item.color?`style="--item-color:${item.color}"`:""}>
            ${wardrobeItemArt(item)}
          </span><span class="wardrobe-item-label">${escapeHtml(item.label)}</span>${item.detail?`<small>${escapeHtml(item.detail)}</small>`:""}<span class="wardrobe-item-check">✓</span>
        </button>`).join("")}</div>
    </section>`).join("");
}
function selectWardrobeItem(gi,ii) {
  const c=WARDROBE_CATEGORIES.find(x=>x.id===activeWardrobeCategory);
  const item=c?.groups[gi]?.items[ii]; if(!item)return;
  if(item.preset){selectedAvatar={...item.preset.avatar};selectedLookName=item.preset.name;}
  else {Object.assign(selectedAvatar,item.patch||{});selectedLookName="Custom Avatar";}
  refreshAvatarAppearance();
}
function selectWardrobeCategory(id) {
  if(!WARDROBE_CATEGORIES.some(x=>x.id===id))return;
  activeWardrobeCategory=id;renderWardrobeNav();renderWardrobeGrid();
}
function resetWardrobeAvatar() {
  selectedAvatar={...DEFAULT_AVATAR};selectedLookName="Nova";activeWardrobeCategory="look";
  renderWardrobeNav();refreshAvatarAppearance();
}
function setupWardrobeInteractions() {
  $("wardrobeNav").addEventListener("click",e=>{
    const button=e.target.closest("[data-wardrobe-category]");
    if(button)selectWardrobeCategory(button.dataset.wardrobeCategory);
  });
  $("wardrobeGrid").addEventListener("click",e=>{
    const button=e.target.closest("[data-group-index][data-item-index]");
    if(button)selectWardrobeItem(Number(button.dataset.groupIndex),Number(button.dataset.itemIndex));
  });
  $("resetAvatar").addEventListener("click",resetWardrobeAvatar);
}
function resizeAvatarPreview() {
  if (!previewRenderer || !$("avatarPreviewCanvas")) return;
  const canvas = $("avatarPreviewCanvas");
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  previewRenderer.setSize(width, height, false);
  previewCamera.aspect = width / height;
  previewCamera.updateProjectionMatrix();
}
function refreshAvatarPreview() {
  if (!previewScene) return;
  if (previewAvatar) {
    previewScene.remove(previewAvatar);
    disposeAvatar(previewAvatar);
  }
  previewAvatar = createAvatar(appearance());
  previewAvatar.position.y = 0.03;
  previewScene.add(previewAvatar);
}
function initAvatarPreview() {
  if (previewRenderer) {
    refreshAvatarPreview();
    resizeAvatarPreview();
    return;
  }
  const canvas = $("avatarPreviewCanvas");
  try {
    // Dedicated canvas is placed inside the preview panel, above its backdrop.
    // If a browser cannot allocate another WebGL context, the rest of the app remains usable.
    previewRenderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: "low-power"
    });
  } catch (error) {
    console.error("Avatar preview WebGL unavailable:", error);
    $("avatarPreviewStage").classList.add("preview-unavailable");
    $("avatarPreviewStage").dataset.previewError = String(error?.message || error);
    status("Preview 3D tidak tersedia di browser ini. Kamu masih bisa memilih avatar.");
    return;
  }
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  previewRenderer.setClearColor(0x07111f, 0);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  previewScene.add(new THREE.HemisphereLight("#d9f4ff", "#26334d", 2.2));
  const keyLight = new THREE.DirectionalLight("#ffffff", 2.6);
  keyLight.position.set(-4, 7, 5);
  previewScene.add(keyLight);
  const rimLight = new THREE.PointLight("#48dfff", 85, 15);
  rimLight.position.set(3.5, 3.5, -2);
  previewScene.add(rimLight);
  const warmLight = new THREE.PointLight("#d18cff", 35, 12);
  warmLight.position.set(-3, 2.3, 1.5);
  previewScene.add(warmLight);

  const backdrop = new THREE.Mesh(
    new THREE.CircleGeometry(3.3, 64),
    new THREE.MeshBasicMaterial({ color:"#174367", transparent:true, opacity:0.38, side:THREE.DoubleSide })
  );
  backdrop.position.set(0, 2.05, -2.5);
  previewScene.add(backdrop);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.45, 0.22, 48),
    new THREE.MeshStandardMaterial({ color:"#183852", metalness:0.6, roughness:0.32, emissive:"#0c2537", emissiveIntensity:0.35 })
  );
  pedestal.position.y = -0.1;
  previewScene.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.36, 0.035, 10, 64),
    new THREE.MeshStandardMaterial({ color:"#63e4ff", emissive:"#1ba6df", emissiveIntensity:1.2, metalness:0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  previewScene.add(ring);

  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 64),
    new THREE.MeshBasicMaterial({ color:"#248cc0", transparent:true, opacity:0.12 })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.025;
  previewScene.add(floorGlow);

  const sparkleMaterial = new THREE.MeshStandardMaterial({ color:"#8cecff", emissive:"#237caf", emissiveIntensity:0.8, metalness:0.25 });
  for (let i = 0; i < 8; i++) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 + (i % 3) * 0.035), sparkleMaterial);
    const angle = i / 8 * Math.PI * 2;
    gem.position.set(Math.cos(angle) * 2.1, 1.1 + (i % 3) * 0.53, -0.45 + Math.sin(angle) * 0.35);
    previewScene.add(gem);
  }
  previewCamera.position.set(4.1, 3.25, 7.1);
  previewCamera.lookAt(0, 1.2, 0);
  refreshAvatarPreview();
  resizeAvatarPreview();

  if (window.ResizeObserver) {
    previewResizeObserver = new ResizeObserver(resizeAvatarPreview);
    previewResizeObserver.observe($("avatarPreviewStage"));
  }
}
function restoreHostSession() {
  const saved = sessionStorage.getItem(HOST_SESSION_KEY);
  if (!saved) return Promise.resolve(false);
  return (async () => {
    const session = JSON.parse(saved);
    if (!/^\d{6}$/.test(String(session.pin || ""))) throw new Error("Data sesi Host tidak valid.");
    await ensureFirebase();
    const pin = String(session.pin);
    const [metaSnap, publicSnap] = await Promise.all([
      get(dbPath(`rooms/${pin}/meta`)), get(dbPath(`rooms/${pin}/public`))
    ]);
    const meta = metaSnap.val();
    const publicState = publicSnap.val();
    if (!meta || meta.hostUid !== uid || !publicState) {
      sessionStorage.removeItem(HOST_SESSION_KEY);
      return false;
    }
    roomPin = pin;
    isHost = true;
    activeState = publicState;
    ownPosition = { x: 0, z: 0 };
    await enterLobby();
    connection("Host room " + pin + " dipulihkan", true);
    status("Sesi Host dipulihkan setelah refresh.");
    return true;
  })();
}

$("chooseHost")?.addEventListener("click", () => {
  $("hostFields").classList.remove("hidden");
  $("playerFields").classList.add("hidden");
  $("setupEyebrow").textContent = "HOST CONSOLE";
  $("setupTitle").textContent = "Buat arena kuis.";
  $("backRole").classList.remove("hidden");
  showScreen("setupScreen");
  status("Susun soal langsung di halaman ini. Draft tersimpan otomatis.");
});
$("backRole").addEventListener("click", () => showScreen("roleScreen"));
$("quizTitle").addEventListener("input", saveHostDraft);
$("duration").addEventListener("change", saveHostDraft);
$("questionEditorList").addEventListener("input", (event) => {
  const target = event.target;
  if (target.type === "radio") return;
  const qi = Number(target.dataset.questionIndex);
  if (!Number.isInteger(qi) || !questionBank?.questions[qi]) return;
  const q = questionBank.questions[qi];
  if (target.dataset.field === "option") q.options[Number(target.dataset.optionIndex)] = target.value;
  else if (target.dataset.field) q[target.dataset.field] = target.value;
  saveHostDraft();
});
$("questionEditorList").addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.field !== "answerIndex") return;
  const qi = Number(target.dataset.questionIndex);
  if (!Number.isInteger(qi) || !questionBank?.questions[qi]) return;
  questionBank.questions[qi].answerIndex = Number(target.value);
  saveHostDraft();
});
$("questionEditorList").addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="remove-question"]');
  if (!button || !questionBank) return;
  const qi = Number(button.dataset.questionIndex);
  questionBank.questions.splice(qi, 1);
  if (!questionBank.questions.length) questionBank.questions.push(emptyQuestion());
  saveHostDraft();
  renderQuestionEditor();
});
$("addQuestion").addEventListener("click", () => {
  if (questionBank.questions.length >= 50) {
    status("Maksimal 50 pertanyaan per room.", true);
    return;
  }
  questionBank.questions.push(emptyQuestion());
  saveHostDraft();
  renderQuestionEditor();
  $("questionEditorList").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
$("questionFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions) || !questions.length) throw new Error("Properti questions tidak ditemukan.");
    if (questions.length > 50) throw new Error("Maksimal 50 pertanyaan per room.");
    questionBank = {
      title: String(parsed.title || $("quizTitle").value || "QuizVerse Challenge"),
      durationSeconds: Number(parsed.durationSeconds || $("duration").value || 15),
      questions: questions.map((q) => ({
        id: String(q.id || ""), category: String(q.category || "Umum"),
        question: String(q.question || ""),
        options: Array.isArray(q.options) ? [0, 1, 2, 3].map((i) => String(q.options[i] || "")) : ["", "", "", ""],
        answerIndex: Number(q.answerIndex || 0), explanation: String(q.explanation || "")
      }))
    };
    $("quizTitle").value = questionBank.title;
    $("duration").value = String(questionBank.durationSeconds);
    renderQuestionEditor();
    saveHostDraft();
    $("fileStatus").textContent = "✓ " + file.name + " · " + questions.length + " soal berhasil diimpor.";
    status("Bank soal berhasil diimpor. Kamu masih bisa mengeditnya.");
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
    setTimeout(() => $("copyPin").textContent = "Salin PIN", 1200);
  } catch { $("copyPin").textContent = roomPin; }
});
$("copyPlayerLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(playerInviteUrl());
    $("copyPlayerLink").textContent = "Link tersalin";
    setTimeout(() => $("copyPlayerLink").textContent = "Salin link pemain", 1400);
  } catch {
    $("playerJoinLink").textContent = playerInviteUrl();
  }
});
$("clearDraft").addEventListener("click", () => {
  if (!confirm("Hapus semua pertanyaan draft dan tutup Host Console?")) return;
  sessionStorage.removeItem(HOST_DRAFT_KEY);
  sessionStorage.removeItem(HOST_SESSION_KEY);
  questionBank = { title: "QuizVerse Challenge", durationSeconds: 15, questions: [emptyQuestion()] };
  $("quizTitle").value = questionBank.title;
  $("duration").value = "15";
  renderQuestionEditor();
  setDraftStatus("Draft dihapus. Tutup tab Host untuk mengakhiri sesi.");
  showScreen("roleScreen");
});
$("returnHome").addEventListener("click", () => {
  stopListeners();
  if (isHost) {
    sessionStorage.removeItem(HOST_SESSION_KEY);
    sessionStorage.removeItem(HOST_DRAFT_KEY);
  }
  roomPin = ""; isHost = false; questionBank = null; activeState = null;
  lastQuestionIndex = -1;
  localAnswerRound = -1; scoreBusyRound = -1; hostTransitionBusy = false;
  ownPosition = { x: 0, z: 0 };
  if (playerMesh) playerMesh.position.set(0, 0, 0);
  if (PLAYER_ONLY) {
    isHost = false;
    roomPin = "";
    showScreen("setupScreen");
    status("Masukkan PIN untuk bergabung lagi.");
  } else {
    showScreen("roleScreen");
  }
});
$("name").addEventListener("change", () => {
  if (playerMesh) setAvatarNameTag(playerMesh, $("name").value);
  syncProfile().catch((e) => status(explainError(e), true));
});

function initializePlayerEntry() {
  $("roleScreen").classList.add("hidden");
  $("setupScreen").classList.add("player-studio-shell");
  $("backRole").classList.add("hidden");
  $("setupEyebrow").classList.add("hidden");
  $("setupTitle").classList.add("hidden");
  $("hostFields").classList.add("hidden");
  $("playerFields").classList.remove("hidden");
  const pin = new URLSearchParams(location.search).get("pin") || "";
  if (/^\d{6}$/.test(pin)) $("pin").value = pin;
  showScreen("setupScreen");
  setupWardrobeInteractions();
  renderWardrobeNav();
  renderWardrobeGrid();
  updateAvatarSelectionLabels();
  setOwnAvatar(appearance());
  initAvatarPreview();
  status("Pilih outfit, isi nama dan PIN, lalu simpan karakter untuk masuk arena.");
}

// Load draft on each Host-page refresh. sessionStorage survives reloads and is
// scoped to the tab, so a fresh tab or a closed tab starts a clean draft.
loadHostDraft();
if (PLAYER_ONLY) {
  initializePlayerEntry();
} else {
  $("choosePlayer")?.classList.add("hidden");
  restoreHostSession().catch((error) => {
    console.warn("Restore Host session:", error);
    status("Draft aman, tetapi sesi room tidak dapat dipulihkan: " + explainError(error), true);
  });
}

// -------------------- Movement controls --------------------
function moveInput() {
  const x = (moveKeys.d || moveKeys.ArrowRight ? 1 : 0) - (moveKeys.a || moveKeys.ArrowLeft ? 1 : 0) + joystick.x;
  const z = (moveKeys.s || moveKeys.ArrowDown ? 1 : 0) - (moveKeys.w || moveKeys.ArrowUp ? 1 : 0) + joystick.y;
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len } : { x, z };
}
function movePlayer(dt) {
  if (!playerMesh) return;
  if (activeState?.phase !== "question") {
    playerMesh.userData.moving = false;
    return;
  }
  const input = moveInput();
  playerMesh.userData.moving = Math.abs(input.x) + Math.abs(input.z) > 0.04;
  const speed = 7.2;
  ownPosition.x = THREE.MathUtils.clamp(ownPosition.x + input.x * speed * dt, -21, 21);
  ownPosition.z = THREE.MathUtils.clamp(ownPosition.z + input.z * speed * dt, -21, 21);
  playerMesh.position.x = ownPosition.x;
  playerMesh.position.z = ownPosition.z;
  if (Math.abs(input.x) + Math.abs(input.z) > 0.04) playerMesh.rotation.y = Math.atan2(input.x, input.z);
  // Answer bays are raised podiums. Keep players standing on their top surface
  // while they are inside the answer area, then return to the main floor.
  const groundHeight = answerBaySurfaceAt(ownPosition.x, ownPosition.z);

  if (jumpVelocity !== 0 || !grounded) {
    playerMesh.position.y += jumpVelocity * dt;
    jumpVelocity -= 22 * dt;
    if (playerMesh.position.y <= groundHeight) {
      playerMesh.position.y = groundHeight;
      jumpVelocity = 0;
      grounded = true;
    }
  } else {
    playerMesh.position.y = groundHeight;
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

// Host has no avatar: use a smooth in-arena spectator camera that follows the
// live group of participants without switching to a top-down overview.
function updateWinnerCamera(dt) {
  // Fit all three podiums even on tall, narrow phone screens.
  const verticalHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const horizontalHalfFovTangent = verticalHalfFov * Math.max(0.35, Number(camera.aspect) || 1);
  const frameDistance = THREE.MathUtils.clamp(
    5.2 / Math.max(0.12, horizontalHalfFovTangent),
    13.2,
    25
  );
  const cameraHeight = winnerCameraFocus.y + Math.min(7.6, frameDistance * 0.42);
  const desiredCamera = spectatorCameraPosition.set(
    0,
    cameraHeight,
    winnerCameraFocus.z + frameDistance
  );
  const blend = 1 - Math.exp(-2.5 * dt);
  camera.position.lerp(desiredCamera, blend);
  camera.lookAt(winnerCameraFocus);
}

function updateHostSpectatorCamera(dt) {
  const entries = Object.values(remotePlayers);
  let focusX = 0, focusZ = 0, spread = 0;

  if (entries.length) {
    entries.forEach((entry) => {
      focusX += Number(entry.targetX || 0);
      focusZ += Number(entry.targetZ || 0);
    });
    focusX /= entries.length;
    focusZ /= entries.length;
    entries.forEach((entry) => {
      spread = Math.max(spread, Math.hypot(
        Number(entry.targetX || 0) - focusX,
        Number(entry.targetZ || 0) - focusZ
      ));
    });
  }

  const focusBlend = 1 - Math.exp(-1.8 * dt);
  spectatorFocus.x += (focusX - spectatorFocus.x) * focusBlend;
  spectatorFocus.z += (focusZ - spectatorFocus.z) * focusBlend;

  // Pull back slightly when the group spreads across several answer platforms.
  const distance = THREE.MathUtils.clamp(18.5 + spread * 0.22, 18.5, 23.5);
  const desiredCamera = spectatorCameraPosition.set(
    THREE.MathUtils.clamp(spectatorFocus.x * 0.28, -18.5, 18.5),
    9.2 + Math.min(1.8, spread * 0.07),
    THREE.MathUtils.clamp(spectatorFocus.z + distance, -19.5, 19.5)
  );
  const cameraBlend = 1 - Math.exp(-2.2 * dt);
  camera.position.lerp(desiredCamera, cameraBlend);
  camera.lookAt(spectatorFocus.x, 0.85, spectatorFocus.z);
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
    $("app").classList.toggle("timer-critical", left > 0 && left <= 5);
  } else if (activeState?.phase === "reveal") {
    $("app").classList.remove("timer-critical");
    $("time").textContent = "✓";
    $("bar").style.width = "100%";
  }
  if (isHost) hostAdvance();
  if (activeState?.phase === "finished") {
    updateWinnerCamera(dt);
  } else if (isHost) {
    updateHostSpectatorCamera(dt);
  } else if (playerMesh) {
    camera.position.x += (playerMesh.position.x - camera.position.x) * 0.045;
    camera.position.z += (playerMesh.position.z + 19 - camera.position.z) * 0.045;
    camera.lookAt(playerMesh.position.x, 0.7, playerMesh.position.z);
  }
  const now = performance.now();
  updateLobbySocial();
  let localWinnerWalking = false;
  if (playerMesh?.userData.winnerTarget) {
    const target = playerMesh.userData.winnerTarget;
    const remaining = Math.hypot(
      target.x - playerMesh.position.x,
      target.y - playerMesh.position.y,
      target.z - playerMesh.position.z
    );
    localWinnerWalking = remaining > 0.12;
    playerMesh.userData.winnerMoving = localWinnerWalking;
    const winnerBlend = 1 - Math.exp(-2.6 * dt);
    playerMesh.position.x += (target.x - playerMesh.position.x) * winnerBlend;
    playerMesh.position.y += (target.y - playerMesh.position.y) * winnerBlend;
    playerMesh.position.z += (target.z - playerMesh.position.z) * winnerBlend;
    const desiredYaw = localWinnerWalking ? target.approachYaw : target.yaw;
    const yawDelta = Math.atan2(
      Math.sin(desiredYaw - playerMesh.rotation.y),
      Math.cos(desiredYaw - playerMesh.rotation.y)
    );
    playerMesh.rotation.y += yawDelta * (1 - Math.exp(-12 * dt));
    if (remaining < 0.006) {
      playerMesh.position.set(target.x, target.y, target.z);
      playerMesh.userData.winnerMoving = false;
      localWinnerWalking = false;
    }
  }
  if (playerMesh) {
    animateAvatar(playerMesh, now, Boolean(playerMesh.userData.moving) || localWinnerWalking);
  }
  const remoteBlend = 1 - Math.exp(-16 * dt);
  Object.values(remotePlayers).forEach((entry) => {
    const targetY = Number(entry.targetY || 0);
    const dx = entry.targetX - entry.mesh.position.x;
    const dy = targetY - entry.mesh.position.y;
    const dz = entry.targetZ - entry.mesh.position.z;
    const remaining = Math.hypot(dx, dy, dz);
    const winnerTarget = entry.mesh.userData.winnerTarget;
    const winnerWalking = Boolean(winnerTarget && remaining > 0.12);
    entry.mesh.userData.winnerMoving = winnerWalking;
    const positionBlend = winnerTarget ? 1 - Math.exp(-2.6 * dt) : remoteBlend;
    entry.mesh.position.x += dx * positionBlend;
    entry.mesh.position.y += dy * positionBlend;
    entry.mesh.position.z += dz * positionBlend;
    if (remaining < 0.006) {
      entry.mesh.position.set(entry.targetX, targetY, entry.targetZ);
      entry.mesh.userData.winnerMoving = false;
    }
    const desiredYaw = winnerTarget
      ? (winnerWalking ? winnerTarget.approachYaw : winnerTarget.yaw)
      : entry.targetYaw;
    const yawDelta = Math.atan2(
      Math.sin(desiredYaw - entry.mesh.rotation.y),
      Math.cos(desiredYaw - entry.mesh.rotation.y)
    );
    entry.mesh.rotation.y += yawDelta * (1 - Math.exp(-12 * dt));
    const distanceToTarget = Math.hypot(dx, dz);
    const moving = winnerWalking || (distanceToTarget > 0.025 && now - Number(entry.lastMoveAt || 0) < 600);
    animateAvatar(entry.mesh, now, moving);
  });
  const t = now * 0.001;
  pads.forEach((pad, i) => { pad.platform.material.emissiveIntensity = 0.14 + Math.sin(t * 2.2 + i) * 0.07; });
  sweepingBeams.forEach((beam, i) => {
    beam.rotation.z = Math.PI + Math.sin(t * 0.34 + beam.userData.sweepPhase) * 0.42;
    beam.rotation.y = Math.sin(t * 0.26 + beam.userData.sweepPhase) * 0.48;
    beam.material.opacity = 0.035 + (Math.sin(t * 0.9 + i) + 1) * 0.018;
  });
  perimeterLEDs.forEach((led) => {
    const pulse = (Math.sin(t * 2.1 - led.userData.ledIndex * 0.42) + 1) * 0.5;
    led.material.color.setRGB(0.18 + pulse * 0.22, 0.55 + pulse * 0.38, 0.82 + pulse * 0.18);
  });
  updateMatchVisualEffects(now, dt);
  renderer.render(scene, camera);
  if (previewRenderer && previewScene) {
    if (previewAvatar) {
      animateAvatar(previewAvatar, now, false);
      previewAvatar.rotation.y = Math.sin(now * 0.00035) * 0.16;
    }
    previewRenderer.render(previewScene, previewCamera);
  }
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  resizeAvatarPreview();
});
connection("Aplikasi siap · Firebase Spark", true);
