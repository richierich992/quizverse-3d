const MAX_TOURNAMENT_PARTIES = 16;

function normalizeEntrants(entrants) {
  const seen = new Set();
  return (Array.isArray(entrants) ? entrants : [])
    .map((entry) => ({
      ...entry,
      partyCode: String(entry?.partyCode || "").trim().toUpperCase()
    }))
    .filter((entry) => {
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(entry.partyCode) || seen.has(entry.partyCode)) return false;
      seen.add(entry.partyCode);
      return true;
    });
}

function roundLabel(matchCount) {
  if (matchCount === 1) return "FINAL";
  if (matchCount === 2) return "SEMIFINAL";
  if (matchCount === 4) return "PEREMPAT FINAL";
  return "BABAK " + (matchCount * 2);
}

/**
 * Rebuilds a deterministic single-elimination bracket from the locked entrant
 * list and immutable match-result map. Missing seed slots become automatic byes.
 */
export function buildSingleEliminationBracket(entrants, matchResults = {}) {
  const list = normalizeEntrants(entrants);
  if (list.length < 2) throw new RangeError("Minimal dua party diperlukan untuk turnamen.");
  if (list.length > MAX_TOURNAMENT_PARTIES) {
    throw new RangeError("Turnamen maksimal diikuti 16 party.");
  }

  let bracketSize = 2;
  while (bracketSize < list.length) bracketSize *= 2;
  const roundCount = Math.log2(bracketSize);
  let previousWinners = Array.from({ length: bracketSize }, (_, index) => ({
    partyCode: list[index]?.partyCode || null,
    // An unseeded slot is an actual empty slot; a seeded party is ready to compete.
    resolved: !list[index]
  }));
  const rounds = {};

  for (let roundIndex = 1; roundIndex <= roundCount; roundIndex++) {
    const matchCount = bracketSize / (2 ** roundIndex);
    const matches = {};
    const nextWinners = [];

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex++) {
      const id = "r" + roundIndex + "m" + (matchIndex + 1);
      const slotA = previousWinners[matchIndex * 2] || { partyCode: null, resolved: true };
      const slotB = previousWinners[matchIndex * 2 + 1] || { partyCode: null, resolved: true };
      const partyA = slotA.partyCode || null;
      const partyB = slotB.partyCode || null;
      const recordedWinner = String(matchResults?.[id] || "");
      let status = "empty";
      let winnerPartyCode = null;

      if (partyA && partyB) {
        if (recordedWinner === partyA || recordedWinner === partyB) {
          status = "finished";
          winnerPartyCode = recordedWinner;
        } else {
          status = "ready";
        }
      } else if (partyA || partyB) {
        const emptySideResolved = partyA ? slotB.resolved : slotA.resolved;
        if (emptySideResolved) {
          status = "bye";
          winnerPartyCode = partyA || partyB;
        } else {
          status = "waiting";
        }
      } else if (!slotA.resolved || !slotB.resolved) {
        status = "waiting";
      }

      matches["match" + (matchIndex + 1)] = {
        id,
        partyA,
        partyB,
        status,
        winnerPartyCode
      };
      nextWinners.push({
        partyCode: winnerPartyCode,
        resolved: status === "finished" || status === "bye" || status === "empty"
      });
    }

    rounds["round" + roundIndex] = {
      id: "round" + roundIndex,
      label: roundLabel(matchCount),
      matches
    };
    previousWinners = nextWinners;
  }

  let currentMatchId = "";
  for (const round of Object.values(rounds)) {
    for (const match of Object.values(round.matches)) {
      if (match.status === "ready") {
        currentMatchId = match.id;
        break;
      }
    }
    if (currentMatchId) break;
  }

  const finalMatch = Object.values(
    rounds["round" + roundCount]?.matches || {}
  )[0] || null;
  const championPartyCode = finalMatch &&
    (finalMatch.status === "finished" || finalMatch.status === "bye")
    ? finalMatch.winnerPartyCode
    : null;

  return {
    bracketSize,
    roundCount,
    rounds,
    currentMatchId,
    championPartyCode
  };
}
