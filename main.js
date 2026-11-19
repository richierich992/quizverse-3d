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
  { name:"Nova",role:"NEON RUNNER",mark:"⚡",avatar:{hair:"spiky",hairColor:"#18263c",face:"cool",skin:"#dfaa7e",shirt:"jersey",shirtColor:"#1ebad6",pants:"jogger",pantsColor:"#243b59",shoes:"sneakers",shoesColor:"#202a38",hat:"headphones"} },
  { name:"Kai",role:"SKY EXPLORER",mark:"✦",avatar:{hair:"short",hairColor:"#754c32",face:"happy",skin:"#f3c9a5",shirt:"jacket",shirtColor:"#ef9b45",pants:"cargo",pantsColor:"#566b45",shoes:"boots",shoesColor:"#5b392b",hat:"cap"} },
  { name:"Luna",role:"STAR SCHOLAR",mark:"✧",avatar:{hair:"long",hairColor:"#252b38",face:"smile",skin:"#bd8057",shirt:"hoodie",shirtColor:"#9b78e8",pants:"jeans",pantsColor:"#294a70",shoes:"high-top",shoesColor:"#e8e7df",hat:"none"} },
  { name:"Rex",role:"ARENA CHAMP",mark:"★",avatar:{hair:"afro",hairColor:"#252b38",face:"happy",skin:"#8b563d",shirt:"jersey",shirtColor:"#e94e69",pants:"shorts",pantsColor:"#273344",shoes:"sneakers",shoesColor:"#f4c542",hat:"none"} },
  { name:"Mika",role:"CREATIVE MAKER",mark:"❋",avatar:{hair:"bob",hairColor:"#b84935",face:"wink",skin:"#f3c9a5",shirt:"tee",shirtColor:"#27bd83",pants:"jogger",pantsColor:"#514477",shoes:"high-top",shoesColor:"#27bd83",hat:"beanie"} },
  { name:"Zed",role:"TECH PILOT",mark:"◈",avatar:{hair:"sidepart",hairColor:"#e5bd68",face:"nerd",skin:"#dfaa7e",shirt:"hoodie",shirtColor:"#f0bb3e",pants:"cargo",pantsColor:"#263247",shoes:"boots",shoesColor:"#263247",hat:"headphones"} }
];
const DEFAULT_AVATAR={...CHARACTER_PRESETS[0].avatar};
let selectedAvatar={...DEFAULT_AVATAR},selectedLookName="Nova",activeWardrobeCategory="look";
let previewScene=null,previewCamera=null,previewRenderer=null,previewAvatar=null,previewResizeObserver=null;
const WARDROBE_CATEGORIES=[
 {id:"look",label:"Gaya",icon:"✦",title:"Pilih gaya awal",subtitle:"Mulai dari karakter siap pakai, lalu ubah sesukamu.",groups:[
  {title:"KARAKTER PILIHAN",items:CHARACTER_PRESETS.map(p=>({label:p.name,detail:p.role,icon:p.mark,preset:p}))}
 ]},
 {id:"hair",label:"Rambut",icon:"⌁",title:"Hair studio",subtitle:"Pilih bentuk dan warna rambut.",groups:[
  {title:"MODEL RAMBUT",items:[["Short cut","▰","short"],["Spiky","✦","spiky"],["Long","♧","long"],["Bob","◒","bob"],["Ponytail","♢","ponytail"],["Curly","❋","curly"],["Afro","✺","afro"],["Side part","◖","sidepart"],["Botak","○","none"]].map(([label,icon,value])=>({label,icon,patch:{hair:value}}))},
  {title:"WARNA RAMBUT",items:[["Hitam","#252b38"],["Cokelat","#754c32"],["Pirang","#e5bd68"],["Biru","#3988e8"],["Pink","#ed83bd"],["Ungu","#9a79df"],["Silver","#e8e7df"],["Merah","#b84935"]].map(([label,color])=>({label,color,patch:{hairColor:color}}))}
 ]},
 {id:"face",label:"Wajah",icon:"☻",title:"Face & skin",subtitle:"Atur ekspresi dan warna kulit karakter.",groups:[
  {title:"EKSPRESI",items:[["Friendly","☺","smile"],["Happy","☻","happy"],["Cool","◉","cool"],["Wink","😉","wink"],["Surprised","○","surprised"],["Serious","▰","serious"],["Nerd","▣","nerd"],["Sleepy","◡","sleepy"]].map(([label,icon,value])=>({label,icon,patch:{face:value}}))},
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
  {title:"AKSESORI KEPALA",items:[["Tanpa aksesori","○","none"],["Baseball cap","🧢","cap"],["Beanie","♧","beanie"],["Crown","♛","crown"],["Headphones","🎧","headphones"]].map(([label,icon,value])=>({label,icon,patch:{hat:value}}))}
 ]}
];
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
  return { ...selectedAvatar };
}
function createAvatar(a = {}) {
  const g = new THREE.Group();
  const skin = a.skin || "#dfaa7e";
  const shirt = a.shirtColor || "#38bdf8";
  const hair = a.hairColor || "#252b38";
  const pants = a.pantsColor || "#294a70";
  const shoeColor = a.shoesColor || "#202a38";

  const orb = (color, x, y, z, sx, sy, sz, roughness = 0.76) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 18),
      mat(color, roughness)
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const softBox = (w, h, d, color, x, y, z, radius = 0.04) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d, 2, 2, 2),
      mat(color)
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const tube = (points, color, radius = 0.018) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, radius, 8, false),
      mat(color)
    );
    g.add(mesh);
    return mesh;
  };

  // Rounded, compact body proportions inspired by playful classroom-game avatars.
  // The character faces +Z. All facial details are deliberately placed on +Z.
  orb(shirt, 0, 1.12, 0, 0.47, 0.55, 0.34);
  orb(skin, 0, 1.61, 0, 0.19, 0.20, 0.19); // neck
  orb(shirt, -0.48, 1.20, 0, 0.18, 0.27, 0.18);
  orb(shirt, 0.48, 1.20, 0, 0.18, 0.27, 0.18);

  // Hands
  orb(skin, -0.50, 0.88, 0.045, 0.15, 0.16, 0.15);
  orb(skin, 0.50, 0.88, 0.045, 0.15, 0.16, 0.15);

  // Legs, shoes and a slightly oversized head.
  const legHeight = a.pants === "shorts" ? 0.40 : 0.48;
  const legColor = pants;
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, legHeight, 5, 12), mat(legColor));
  leftLeg.position.set(-0.21, 0.43, 0);
  leftLeg.castShadow = true;
  g.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.21;
  g.add(rightLeg);

  orb(shoeColor, -0.22, 0.13, 0.13, 0.23, a.shoes === "boots" ? 0.18 : 0.13, 0.34);
  orb(shoeColor, 0.22, 0.13, 0.13, 0.23, a.shoes === "boots" ? 0.18 : 0.13, 0.34);
  if (a.shoes === "high-top") {
    orb("#f4f8ff", -0.22, 0.25, 0.12, 0.17, 0.035, 0.19);
    orb("#f4f8ff", 0.22, 0.25, 0.12, 0.17, 0.035, 0.19);
  }

  // Outfit details on the front side (+Z).
  if (a.shirt === "hoodie") {
    orb(shirt, 0, 1.48, -0.23, 0.30, 0.25, 0.15);
    tube([[-0.045,1.40,0.324],[0,1.30,0.346],[0.045,1.40,0.324]], "#eaf7ff", 0.012);
    orb("#eaf7ff", -0.07, 1.04, 0.32, 0.025, 0.045, 0.014);
    orb("#eaf7ff", 0.07, 1.04, 0.32, 0.025, 0.045, 0.014);
  } else if (a.shirt === "jersey") {
    softBox(0.12, 0.32, 0.025, "#f5f8ff", 0, 1.17, 0.342);
    orb("#f5d25b", 0, 1.38, 0.344, 0.09, 0.055, 0.018);
  } else if (a.shirt === "jacket") {
    softBox(0.055, 0.66, 0.025, "#f1f5f9", 0, 1.15, 0.342);
    softBox(0.14, 0.20, 0.025, "#ffffff", -0.19, 1.48, 0.30);
    softBox(0.14, 0.20, 0.025, "#ffffff", 0.19, 1.48, 0.30);
  } else {
    orb("#ffffff", 0, 1.16, 0.337, 0.075, 0.075, 0.018);
    orb(a.shirtAccent || "#f5d25b", 0, 1.16, 0.358, 0.035, 0.035, 0.012);
  }

  if (a.pants === "cargo") {
    orb(a.pantsAccent || "#b8c8d5", -0.34, 0.48, 0.15, 0.09, 0.12, 0.035);
    orb(a.pantsAccent || "#b8c8d5", 0.34, 0.48, 0.15, 0.09, 0.12, 0.035);
  }

  // Large soft head with visible cheeks, ears and facial expression.
  orb(skin, 0, 2.02, 0, 0.59, 0.64, 0.51);
  orb(skin, -0.55, 1.99, -0.005, 0.13, 0.17, 0.12);
  orb(skin, 0.55, 1.99, -0.005, 0.13, 0.17, 0.12);

  // Eye whites, irises, pupils and highlights. Camera/front is +Z.
  for (const x of [-0.19, 0.19]) {
    orb("#ffffff", x, 2.08, 0.438, 0.112, 0.135, 0.066, 0.35);
    const irisColor = a.eyeColor || "#4d9de0";
    orb(irisColor, x + 0.012, 2.075, 0.493, 0.066, 0.082, 0.035, 0.38);
    orb("#142239", x + 0.018, 2.075, 0.522, 0.037, 0.052, 0.022, 0.28);
    orb("#ffffff", x - 0.012, 2.112, 0.541, 0.018, 0.023, 0.012, 0.2);
  }

  // Eyebrows vary slightly by expression.
  const browColor = a.hair && a.hair !== "none" ? hair : "#604537";
  for (const x of [-0.19, 0.19]) {
    const brow = orb(browColor, x, 2.27, 0.43, 0.13, 0.035, 0.035);
    brow.rotation.z = (x < 0 ? 1 : -1) * (a.face === "surprised" ? 0.18 : 0.07);
  }

  // Nose and soft blush cheeks.
  orb("#d88f79", 0, 1.94, 0.505, 0.055, 0.06, 0.035);
  orb("#f08d9b", -0.38, 1.88, 0.405, 0.085, 0.045, 0.025);
  orb("#f08d9b", 0.38, 1.88, 0.405, 0.085, 0.045, 0.025);

  if (a.face === "surprised") {
    orb("#54273b", 0, 1.77, 0.49, 0.075, 0.095, 0.035);
    orb("#ee8091", 0, 1.73, 0.523, 0.034, 0.028, 0.012);
  } else if (a.face === "serious") {
    softBox(0.20, 0.026, 0.025, "#613e43", 0, 1.78, 0.49);
  } else if (a.face === "sleepy") {
    softBox(0.18, 0.035, 0.025, "#26364a", 0, 1.79, 0.49);
  } else {
    tube([[-0.13,1.82,0.482],[-0.075,1.77,0.51],[0,1.755,0.518],[0.075,1.77,0.51],[0.13,1.82,0.482]],
      a.face === "cool" ? "#663e4a" : "#8d4c51", 0.019);
  }

  if (a.face === "nerd" || a.glasses) {
    for (const x of [-0.19, 0.19]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24), mat("#26364b"));
      frame.position.set(x, 2.08, 0.50);
      g.add(frame);
    }
    softBox(0.12, 0.025, 0.025, "#26364b", 0, 2.09, 0.51);
  }
  if (a.face === "wink") {
    // Add a cheeky eyelid over the left eye while keeping the other eye open.
    softBox(0.17, 0.035, 0.028, browColor, -0.19, 2.08, 0.525);
  }

  // Hair silhouettes are layered over the crown, never over the eyes.
  if (a.hair && a.hair !== "none") {
    orb(hair, 0, 2.50, -0.045, 0.57, 0.25, 0.49);
    if (a.hair === "spiky") {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 10), mat(hair));
        spike.position.set(-0.34 + i * 0.17, 2.70 + (i % 2) * 0.035, -0.02);
        spike.rotation.z = (i - 2) * -0.15;
        g.add(spike);
      }
    } else if (a.hair === "long" || a.hair === "bob") {
      orb(hair, -0.47, 2.03, 0.015, 0.15, 0.49, 0.24);
      orb(hair, 0.47, 2.03, 0.015, 0.15, 0.49, 0.24);
      if (a.hair === "bob") orb(hair, 0, 1.74, 0.24, 0.48, 0.13, 0.22);
    } else if (a.hair === "ponytail") {
      orb(hair, 0.36, 2.18, -0.40, 0.16, 0.37, 0.15);
      orb(hair, 0.36, 1.90, -0.42, 0.13, 0.18, 0.12);
    } else if (a.hair === "curly" || a.hair === "afro") {
      const count = a.hair === "afro" ? 17 : 10;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = a.hair === "afro" ? 0.42 : 0.35;
        orb(hair, Math.cos(angle) * radius, 2.49 + Math.sin(i * 2.1) * 0.075,
          -0.035 + Math.sin(angle) * 0.31, 0.17, 0.16, 0.16);
      }
    } else if (a.hair === "sidepart") {
      orb(hair, -0.20, 2.57, 0.32, 0.34, 0.13, 0.18);
      orb(hair, 0.12, 2.58, 0.12, 0.29, 0.11, 0.24);
    }
  }

  // Hats and accessories sit above the hair.
  if (a.hat === "cap") {
    orb(a.hatColor || "#e4edf7", 0, 2.65, -0.01, 0.59, 0.16, 0.52);
    orb(a.hatColor || "#e4edf7", 0, 2.59, 0.40, 0.48, 0.055, 0.27);
  } else if (a.hat === "beanie") {
    orb(a.hatColor || "#e25778", 0, 2.62, -0.02, 0.57, 0.22, 0.50);
    softBox(0.86, 0.09, 0.68, a.hatColor || "#e25778", 0, 2.49, 0);
  } else if (a.hat === "crown") {
    softBox(0.48, 0.12, 0.38, "#f2c94c", 0, 2.64, 0);
    for (let i = -1; i <= 1; i++) {
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.20, 8), mat("#ffdc70"));
      point.position.set(i * 0.16, 2.80, 0);
      g.add(point);
    }
  } else if (a.hat === "headphones") {
    const bandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.49,2.17,0), new THREE.Vector3(-0.49,2.55,0),
      new THREE.Vector3(0,2.72,0), new THREE.Vector3(0.49,2.55,0),
      new THREE.Vector3(0.49,2.17,0)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bandCurve,24,0.045,8,false),mat("#263c55")));
    orb("#263c55",-0.52,2.04,0.02,0.10,0.20,0.14);
    orb("#263c55",0.52,2.04,0.02,0.10,0.20,0.14);
    orb(a.hatAccent || "#55dfff",-0.57,2.04,0.12,0.035,0.075,0.035);
    orb(a.hatAccent || "#55dfff",0.57,2.04,0.12,0.035,0.075,0.035);
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
  await auth.authStateReady();
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
            ${item.color?'<i class="wardrobe-color-chip"></i>':`<b>${item.icon||"✦"}</b>`}
          </span><span class="wardrobe-item-label">${item.label}</span>${item.detail?`<small>${item.detail}</small>`:""}<span class="wardrobe-item-check">✓</span>
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
    previewAvatar.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      }
    });
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
$("name").addEventListener("change", () => syncProfile().catch((e) => status(explainError(e), true)));

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
  if (previewRenderer && previewScene) {
    if (previewAvatar) previewAvatar.rotation.y = Math.sin(performance.now() * 0.00035) * 0.16;
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
