import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const player = readFileSync(new URL("../player.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

assert.match(index, /id="chooseHost"/, "Host entry remains available");
assert.doesNotMatch(index, /id="choosePlayer"/, "Host page must not expose a Player/Host role switch");
assert.match(index, /id="questionEditorList"/, "Host has an inline question editor");
assert.match(index, /id="addQuestion"/, "Host can add questions");
assert.match(index, /id="clearDraft"/, "Host can explicitly clear a draft");
assert.match(player, /id="joinRoom"/, "Player page offers joining");
assert.doesNotMatch(player, /id="chooseHost"/, "Player page contains no Host control");
assert.match(main, /location\.pathname\.endsWith\("\/player\.html"\)/, "Player route is selected by its dedicated URL");
assert.match(main, /if \(PLAYER_ONLY\) \{\s*initializePlayerEntry\(\)/, "Player route opens directly into join setup");
assert.match(player, /player.html|Player Join/, "Separate Player page exists");
assert.match(player, /id="wardrobeNav"/, "Player has a category rail");
assert.match(player, /id="wardrobeGrid"/, "Player has an outfit item grid");
assert.match(player, /id="avatarPreviewCanvas"/, "Player has a dedicated 3D preview canvas");
assert.match(player, /id="resetAvatar"/, "Player can reset avatar");
assert.match(main, /HOST_DRAFT_KEY/);
assert.match(main, /sessionStorage\.setItem\(HOST_DRAFT_KEY/);
assert.match(main, /sessionStorage\.removeItem\(HOST_DRAFT_KEY/);
assert.match(main, /restoreHostSession/);
assert.match(main, /await auth\.authStateReady\(\)/, "Host refresh waits for Firebase to restore the anonymous identity");
assert.match(main, /HOST_SESSION_KEY/);
const makeRoomBlock = main.slice(main.indexOf("async function makeRoom"), main.indexOf("async function createOwnPlayer"));
assert.doesNotMatch(makeRoomBlock, /createOwnPlayer|setOwnAvatar/, "Host is not created as a named/avatar player");
assert.match(main, /sessionStorage\.setItem\(HOST_SESSION_KEY/, "Host room can resume after refresh");
assert.match(main, /function validateQuestionBank/);
assert.match(main, /function renderWardrobeGrid/);
assert.match(main, /function renderWardrobeNav/);
assert.match(main, /function initAvatarPreview/);
assert.match(main, /previewRenderer\.render\(previewScene, previewCamera\)/, "Dedicated avatar WebGL renderer draws the preview");
assert.match(main, /previewRenderer = new THREE\.WebGLRenderer/, "Avatar preview has a renderer inside its visible UI panel");
assert.match(main, /catch \(error\) \{[\s\S]*?Preview 3D tidak tersedia/, "Preview failure is handled without stopping the app");
assert.match(main, /function resetWardrobeAvatar/);
assert.match(main, /shoesColor/);
assert.match(main, /WARDROBE_CATEGORIES/, "Wardrobe category data is available");
assert.match(main, /data-wardrobe-category/, "Wardrobe navigation renders category controls");
assert.match(main, /data-group-index/, "Wardrobe tiles can be selected");
assert.match(main, /playerInviteUrl/);

const playerIds = new Set([...player.matchAll(/\\bid="([^"]+)"/g)].map((match) => match[1]));
const eagerBindings = [...main.matchAll(/\\$\\("([^"]+)"\\)\\.addEventListener/g)].map((match) => match[1]);
for (const id of eagerBindings) {
  assert.ok(playerIds.has(id), `Player HTML must contain element #${id} for its event binding`);
}
assert.doesNotMatch(main, /\\$\\("chooseHost"\\)\\.addEventListener/, "Player route must not bind the removed Host button");

assert.doesNotMatch(main, /\$\("chooseHost"\)\.addEventListener/, "Player route must not bind removed Host button");
assert.doesNotMatch(main, /\$\("choosePlayer"\)\.addEventListener/, "Player route must not bind removed role switch");
assert.match(player, /reportBootError/, "Player page reports JavaScript boot errors visibly");
assert.match(main, /connection\("Aplikasi siap · Firebase Spark", true\)/, "Successful module initialization clears loading status");
assert.match(css, /\.wardrobe-rail/);
assert.match(css, /\.wardrobe-items/);
assert.match(css, /#avatarPreviewCanvas/);
console.log("PASS: separate Host/Player entry, session draft persistence, inline question builder, and 3D avatar wardrobe.");

assert.match(main, /All face details point toward \+Z/, "Avatar face orientation is explicit");
assert.match(main, /const eyes = \[\]/, "Avatar eyes are grouped for facial animation");
assert.match(main, /g\.userData\.rig = \{ torso, head, leftArm, rightArm, leftLeg, rightLeg, eyes \}/, "Avatar exposes articulated body and facial rig");
assert.match(main, /function animateAvatar\(mesh, time, moving = false\)/, "Avatar has a shared animation controller");
assert.match(main, /const blinkPhase =/, "Avatar performs staggered idle blinking");
assert.match(main, /rig\.leftLeg\.rotation\.x/, "Avatar has an animated walking cycle");
assert.match(main, /entry\.mesh\.rotation\.y = Math\.atan2\(dx, dz\)/, "Remote players face their movement direction");
assert.match(main, /const sharedMaterials = new Map\(\)/, "Avatar materials are shared to reduce rendering overhead");
const previewRefresh = main.slice(main.indexOf("function refreshAvatarPreview"), main.indexOf("function initAvatarPreview"));
assert.match(previewRefresh, /if \(node\.geometry\) node\.geometry\.dispose\(\)/, "Replaced preview geometry is released");
assert.doesNotMatch(previewRefresh, /node\.material\.dispose\(\)/, "Shared cached materials are not destroyed when changing wardrobes");
assert.match(css, /border-radius:17px/, "Wardrobe cards use softer rounded styling");

assert.match(main, /function wardrobeItemArt\(item\)/, "Wardrobe catalog uses visual item thumbnails");
assert.match(main, /mini-avatar-head/, "Preset character tiles show miniature avatar previews");
assert.match(css, /\.mini-avatar-head/, "Mini avatar thumbnails have visible facial detail");
assert.match(main, /animateAvatar\(previewAvatar, now, false\)/, "Live avatar preview animates while idle");
assert.match(main, /Object\.values\(remotePlayers\)\.forEach/, "Remote avatars receive independent animation updates");
