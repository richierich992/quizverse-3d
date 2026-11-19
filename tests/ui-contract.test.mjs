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
assert.doesNotMatch(player, /id="chooseHost"/, "Player page must not offer Host entry");
assert.match(player, /player.html|Player Join/, "Separate Player page exists");
assert.match(player, /id="characterTrack"/, "Player page has the character carousel");
assert.match(main, /HOST_DRAFT_KEY/);
assert.match(main, /sessionStorage\.setItem\(HOST_DRAFT_KEY/);
assert.match(main, /sessionStorage\.removeItem\(HOST_DRAFT_KEY/);
assert.match(main, /restoreHostSession/);
assert.match(main, /function validateQuestionBank/);
assert.match(main, /function renderCharacterCarousel/);
assert.match(main, /playerInviteUrl/);
assert.match(css, /\.character-track/);
assert.match(css, /scroll-snap-type:x mandatory/);
console.log("PASS: separate Host/Player entry, session draft persistence, inline question builder, and swipe character carousel.");
