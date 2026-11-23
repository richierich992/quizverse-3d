import assert from "node:assert/strict";
import { buildSingleEliminationBracket } from "../tournament.js";

const entrants = (count) => Array.from({ length: count }, (_, index) => ({
  partyCode: "CODE" + String(index + 1).padStart(2, "0"),
  name: "Party " + (index + 1)
}));
const match = (bracket, id) => Object.values(bracket.rounds)
  .flatMap((round) => Object.values(round.matches))
  .find((item) => item.id === id);

{
  const bracket = buildSingleEliminationBracket(entrants(2));
  assert.equal(bracket.bracketSize, 2);
  assert.equal(bracket.roundCount, 1);
  assert.equal(bracket.rounds.round1.label, "FINAL");
  assert.equal(bracket.currentMatchId, "r1m1");
  assert.equal(match(bracket, "r1m1").status, "ready");
}

{
  const bracket = buildSingleEliminationBracket(entrants(3));
  assert.equal(bracket.bracketSize, 4);
  assert.equal(match(bracket, "r1m2").status, "ready");
  assert.equal(match(bracket, "r2m1").status, "bye");
  assert.equal(match(bracket, "r2m1").winnerPartyCode, "CODE03");
  assert.equal(bracket.currentMatchId, "r1m1");
  const afterFirstRound = buildSingleEliminationBracket(entrants(3), {
    r1m1: "CODE02",
    r1m2: "CODE03"
  });
  assert.equal(match(afterFirstRound, "r2m1").status, "ready");
  assert.equal(match(afterFirstRound, "r2m1").partyA, "CODE02");
  assert.equal(match(afterFirstRound, "r2m1").partyB, "CODE03");
  const champion = buildSingleEliminationBracket(entrants(3), {
    r1m1: "CODE02",
    r1m2: "CODE03",
    r2m1: "CODE03"
  });
  assert.equal(champion.championPartyCode, "CODE03");
  assert.equal(champion.currentMatchId, "");
}

{
  const bracket = buildSingleEliminationBracket(entrants(5));
  assert.equal(bracket.bracketSize, 8);
  assert.equal(bracket.roundCount, 3);
  assert.equal(match(bracket, "r1m3").status, "bye");
  assert.equal(match(bracket, "r1m4").status, "empty");
  assert.equal(match(bracket, "r2m2").status, "bye");
  assert.equal(match(bracket, "r2m2").winnerPartyCode, "CODE05");
  assert.equal(bracket.currentMatchId, "r1m1");
}

{
  const list = entrants(8);
  let results = {};
  const firstRound = buildSingleEliminationBracket(list, results);
  for (const id of ["r1m1", "r1m2", "r1m3", "r1m4"]) {
    const item = match(firstRound, id);
    results[id] = item.partyA;
  }
  const secondRound = buildSingleEliminationBracket(list, results);
  for (const id of ["r2m1", "r2m2"]) {
    const item = match(secondRound, id);
    results[id] = item.partyB;
  }
  const finalReady = buildSingleEliminationBracket(list, results);
  assert.equal(match(finalReady, "r3m1").status, "ready");
  results.r3m1 = match(finalReady, "r3m1").partyA;
  const completed = buildSingleEliminationBracket(list, results);
  assert.equal(completed.championPartyCode, results.r3m1);
  assert.equal(completed.currentMatchId, "");
}

assert.throws(() => buildSingleEliminationBracket(entrants(1)), /Minimal dua party/);
assert.throws(() => buildSingleEliminationBracket(entrants(17)), /maksimal 16 party/);
assert.equal(buildSingleEliminationBracket([
  { partyCode: "ABC234" },
  { partyCode: "ABC234" },
  { partyCode: "DEF567" }
]).bracketSize, 2);

console.log("PASS: single-elimination bracket, bye propagation, winner advancement, final champion, and party limits.");
