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
  const latePlayer = env.authenticatedContext("late-player").database();

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
  await assertSucceeds(set(ref(p1, `${base}/players/player-1`), profile("player-1", "Player 1")));
  await assertSucceeds(set(ref(p2, `${base}/players/player-2`), profile("player-2", "Player 2")));

  await assertFails(get(ref(p1, `answerKeys/${pin}/questions`)));

  const colorRoundRef = `${base}/miniGames/quickColorMatch/round`;
  const colorWinnerRef = `${base}/miniGames/quickColorMatch/winner`;
  const colorRound1 = {
    roundId: 1, phase: "preparing", targetIndex: 2,
    startsAt: Date.now() - 100, endsAt: Date.now() + 5000
  };
  await assertFails(set(ref(p1, colorRoundRef), colorRound1));
  await assertSucceeds(set(ref(host, colorRoundRef), colorRound1));
  await assertFails(set(ref(p1, colorWinnerRef), {
    uid: "player-1", name: "Player 1", roundId: 1, answerIndex: 2
  }));
  await assertSucceeds(set(ref(host, colorWinnerRef), null));
  await assertSucceeds(update(ref(host, colorRoundRef), { phase: "active" }));
  await assertFails(set(ref(p1, colorWinnerRef), {
    uid: "player-1", name: "Player 1", roundId: 1, answerIndex: 1
  }));
  await assertSucceeds(set(ref(p1, colorWinnerRef), {
    uid: "player-1", name: "Player 1", roundId: 1, answerIndex: 2
  }));
  await assertFails(set(ref(p2, colorWinnerRef), {
    uid: "player-2", name: "Player 2", roundId: 1, answerIndex: 2
  }));

  const colorRound2 = {
    roundId: 2, phase: "preparing", targetIndex: 0,
    startsAt: Date.now() - 100, endsAt: Date.now() + 5000
  };
  await assertSucceeds(set(ref(host, colorRoundRef), colorRound2));
  await assertSucceeds(set(ref(host, colorWinnerRef), null));
  await assertSucceeds(update(ref(host, colorRoundRef), { phase: "active" }));
  await assertSucceeds(set(ref(p2, colorWinnerRef), {
    uid: "player-2", name: "Player 2", roundId: 2, answerIndex: 0
  }));
  await assertFails(set(ref(p1, colorWinnerRef), {
    uid: "player-1", name: "Player 1", roundId: 2, answerIndex: 0
  }));

  const colorRound3 = {
    roundId: 3, phase: "preparing", targetIndex: 3,
    startsAt: Date.now() - 1000, endsAt: Date.now() - 100
  };
  await assertSucceeds(set(ref(host, colorRoundRef), colorRound3));
  await assertSucceeds(set(ref(host, colorWinnerRef), null));
  await assertSucceeds(update(ref(host, colorRoundRef), { phase: "active" }));
  await assertFails(set(ref(p1, colorWinnerRef), {
    uid: "player-1", name: "Player 1", roundId: 3, answerIndex: 3
  }));
  await assertFails(set(ref(latePlayer, colorWinnerRef), {
    uid: "late-player", name: "Late Player", roundId: 3, answerIndex: 3
  }));

  const socialBase = `${base}/socialCompetition`;
  const partyCode = "ABC234";
  const partyRef = `${socialBase}/parties/${partyCode}`;
  const pointer1 = `${socialBase}/playerParties/player-1`;
  const pointer2 = `${socialBase}/playerParties/player-2`;
  await assertFails(set(ref(p2, `${partyRef}`), {
    leaderUid: "player-1", teamId: "red", createdAt: Date.now(),
    members: { slot1: { uid: "player-1", name: "Player 1", joinedAt: Date.now() } }
  }));
  await assertSucceeds(set(ref(p1, `${partyRef}`), {
    leaderUid: "player-1", teamId: "red", createdAt: Date.now(),
    members: { slot1: { uid: "player-1", name: "Player 1", joinedAt: Date.now() } }
  }));
  await assertSucceeds(set(ref(p1, pointer1), partyCode));
  await assertSucceeds(update(ref(p2, socialBase), {
    [`parties/${partyCode}/members/slot2`]: { uid: "player-2", name: "Player 2", joinedAt: Date.now() },
    "playerParties/player-2": partyCode
  }));
  await assertFails(set(ref(p2, `${socialBase}/parties/${partyCode}/teamId`), "blue"));
  await assertSucceeds(set(ref(p1, `${socialBase}/parties/${partyCode}/teamId`), "blue"));
  await assertFails(set(ref(p2, `${socialBase}/parties/${partyCode}/members/slot5`), {
    uid: "player-2", name: "Player 2", joinedAt: Date.now()
  }));
  await assertSucceeds(set(ref(p1, `${socialBase}/parties/${partyCode}/leaderUid`), "player-2"));
  await assertSucceeds(update(ref(p1, socialBase), {
    [`parties/${partyCode}/members/slot1`]: null,
    "playerParties/player-1": null
  }));
  await assertSucceeds(set(ref(p2, `${socialBase}/parties/${partyCode}/teamId`), "red"));
  await assertSucceeds(set(ref(p2, `${partyRef}`), null));
  await assertSucceeds(set(ref(p2, pointer2), null));

  const statsPath = `${socialBase}/stats/player-1/matches/session-1`;
  await assertFails(set(ref(p1, statsPath), {
    sessionId: 1, teamId: "red", result: "win", finishedAt: Date.now()
  }));

  const teamBase = `${base}/miniGames/teamColorBattle`;
  const teamSession = `${teamBase}/session`;
  const teamTeams = `${teamBase}/teams`;
  const teamRound = `${teamBase}/round`;
  const teamWinner = `${teamBase}/winners/round1`;
  await assertFails(set(ref(p1, teamSession), {
    sessionId: 1, status: "active", totalRounds: 5, roundId: 0, startedAt: Date.now()
  }));
  await assertSucceeds(set(ref(host, teamSession), {
    sessionId: 1, status: "active", totalRounds: 5, roundId: 0, startedAt: Date.now()
  }));
  await assertSucceeds(set(ref(host, teamTeams), {
    sessionId: 1, members: { "player-1": "red", "player-2": "blue" }
  }));
  const teamRound1 = {
    sessionId: 1, roundId: 1, phase: "preparing", targetIndex: 1,
    startsAt: Date.now() - 100, endsAt: Date.now() + 5000
  };
  await assertSucceeds(update(ref(host, teamSession), { roundId: 1 }));
  await assertSucceeds(set(ref(host, teamRound), teamRound1));
  await assertSucceeds(update(ref(host, teamRound), { phase: "active" }));
  await assertFails(set(ref(p1, teamWinner), {
    sessionId: 1, roundId: 1, uid: "player-1", name: "Player 1", teamId: "red", answerIndex: 0
  }));
  await assertFails(set(ref(p1, teamWinner), {
    sessionId: 1, roundId: 1, uid: "player-1", name: "Player 1", teamId: "blue", answerIndex: 1
  }));
  await assertFails(set(ref(p1, `${teamBase}/winners/round6`), {
    sessionId: 1, roundId: 1, uid: "player-1", name: "Player 1", teamId: "red", answerIndex: 1
  }));
  await assertSucceeds(set(ref(p1, teamWinner), {
    sessionId: 1, roundId: 1, uid: "player-1", name: "Player 1", teamId: "red", answerIndex: 1
  }));
  await assertFails(set(ref(p2, teamWinner), {
    sessionId: 1, roundId: 1, uid: "player-2", name: "Player 2", teamId: "blue", answerIndex: 1
  }));
  const teamWinnerRound2 = `${teamBase}/winners/round2`;
  await assertSucceeds(update(ref(host, teamSession), { roundId: 2 }));
  await assertSucceeds(set(ref(host, teamRound), {
    sessionId: 1, roundId: 2, phase: "preparing", targetIndex: 2,
    startsAt: Date.now() - 1000, endsAt: Date.now() - 500
  }));
  await assertSucceeds(update(ref(host, teamRound), { phase: "active" }));
  await assertFails(set(ref(p2, teamWinnerRound2), {
    sessionId: 1, roundId: 2, uid: "player-2", name: "Player 2", teamId: "blue", answerIndex: 2
  }));
  for (const roundId of [3, 4, 5]) {
    await assertSucceeds(update(ref(host, teamSession), { roundId }));
    await assertSucceeds(set(ref(host, teamRound), {
      sessionId: 1, roundId, phase: "preparing", targetIndex: roundId % 4,
      startsAt: Date.now() - 1000, endsAt: Date.now() - 500
    }));
    await assertSucceeds(update(ref(host, teamRound), { phase: "active" }));
  }
  await assertSucceeds(update(ref(host, teamSession), { status: "finished" }));
  await assertSucceeds(set(ref(host, `${teamBase}/winners`), null));
  await assertSucceeds(set(ref(host, `${socialBase}/stats/player-1/matches/session-1`), {
    sessionId: 1, teamId: "red", result: "win", finishedAt: Date.now()
  }));
  await assertFails(set(ref(host, `${socialBase}/stats/player-1/matches/session-1`), {
    sessionId: 1, teamId: "red", result: "win", finishedAt: Date.now()
  }));
  await assertSucceeds(set(ref(host, teamSession), {
    sessionId: 2, status: "active", totalRounds: 5, roundId: 0, startedAt: Date.now()
  }));
  await assertSucceeds(set(ref(host, teamTeams), {
    sessionId: 2, members: { "player-1": "blue", "player-2": "red" }
  }));
  await assertFails(set(ref(p1, `${teamBase}/winners/round1`), {
    sessionId: 2, roundId: 1, uid: "player-1", name: "Player 1", teamId: "red", answerIndex: 1
  }));

  const deadline0 = Date.now() + 5000;
  await assertSucceeds(set(ref(host, `${base}/public`), questionState(0, {
    id: "q0", category: "Test", question: "Question one?", options: ["A", "B", "C", "D"]
  }, deadline0)));
  await assertSucceeds(update(ref(host, `${base}/meta`), { status: "playing" }));
  await assertFails(set(ref(latePlayer, `${base}/players/late-player`), profile("late-player", "Late Player")));

  const submission1 = `submissions/${pin}/current/player-1`;
  const submission2 = `submissions/${pin}/current/player-2`;
  await assertSucceeds(set(ref(p1, submission1), { questionIndex: 0, answerIndex: 1 }));
  await assertFails(set(ref(p1, submission1), { questionIndex: 0, answerIndex: 0 }));
  await assertSucceeds(get(ref(p1, submission1)));
  await assertFails(get(ref(p1, submission2)));
  await assertFails(update(ref(p1, `${base}/players/player-1`), { score: 999 }));

  await delay(5100);
  // A player who has not answered is blocked after the server deadline,
  // even before the host has switched the public state to reveal.
  await assertFails(set(ref(p2, submission2), { questionIndex: 0, answerIndex: 2 }));
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


  // Tournament Center: only party leaders can register, and only the Host advances results.
  const tournamentPin = "654321";
  const tournamentBase = `rooms/${tournamentPin}`;
  const tournamentSocial = `${tournamentBase}/socialCompetition`;
  await assertSucceeds(set(ref(host, `${tournamentBase}/meta`), {
    hostUid: "host", title: "Tournament Rules", status: "lobby", maxPlayers: 10
  }));
  await assertSucceeds(set(ref(host, `${tournamentBase}/public`), {
    phase: "lobby", questionIndex: -1, totalQuestions: 1, durationSeconds: 10,
    question: { category: "", question: "", options: [] }, title: "Tournament Rules", deadlineAt: 0
  }));
  await assertSucceeds(set(ref(p1, `${tournamentBase}/players/player-1`), profile("player-1", "Player 1")));
  await assertSucceeds(set(ref(p2, `${tournamentBase}/players/player-2`), profile("player-2", "Player 2")));
  await assertSucceeds(set(ref(p1, `${tournamentSocial}/parties/PARY01`), {
    leaderUid: "player-1", teamId: "red", createdAt: Date.now(),
    members: { slot1: { uid: "player-1", name: "Player 1", joinedAt: Date.now() } }
  }));
  await assertSucceeds(set(ref(p1, `${tournamentSocial}/playerParties/player-1`), "PARY01"));
  await assertSucceeds(set(ref(p2, `${tournamentSocial}/parties/PARY02`), {
    leaderUid: "player-2", teamId: "blue", createdAt: Date.now(),
    members: { slot1: { uid: "player-2", name: "Player 2", joinedAt: Date.now() } }
  }));
  await assertSucceeds(set(ref(p2, `${tournamentSocial}/playerParties/player-2`), "PARY02"));

  const tournamentMeta = `${tournamentSocial}/tournament/meta`;
  await assertSucceeds(set(ref(host, tournamentMeta), {
    tournamentId: "cup-1", title: "QuizVerse Cup", phase: "registration",
    createdAt: Date.now(), maxParties: 16
  }));
  const regOne = `${tournamentSocial}/tournament/registrations/cup-1/slot01`;
  const regTwo = `${tournamentSocial}/tournament/registrations/cup-1/slot02`;
  await assertFails(set(ref(p2, regOne), {
    partyCode: "PARY01", leaderUid: "player-1", partyName: "Party One", registeredAt: Date.now()
  }));
  await assertSucceeds(set(ref(p1, regOne), {
    partyCode: "PARY01", leaderUid: "player-1", partyName: "Party One", registeredAt: Date.now()
  }));
  await assertSucceeds(set(ref(p2, regTwo), {
    partyCode: "PARY02", leaderUid: "player-2", partyName: "Party Two", registeredAt: Date.now()
  }));
  await assertSucceeds(update(ref(host, tournamentMeta), { phase: "active", startedAt: Date.now() }));
  await assertFails(set(ref(p1, `${tournamentSocial}/tournament/registrations/cup-1/slot03`), {
    partyCode: "PARY01", leaderUid: "player-1", partyName: "Party One", registeredAt: Date.now()
  }));
  await assertFails(set(ref(p1, `${tournamentSocial}/parties/PARY01/members/slot1`), null));

  const tournamentTeamSession = `${tournamentBase}/miniGames/teamColorBattle/session`;
  const tournamentTeamRound = `${tournamentBase}/miniGames/teamColorBattle/round`;
  await assertSucceeds(set(ref(host, tournamentTeamSession), {
    sessionId: 1, status: "active", totalRounds: 5, roundId: 0, startedAt: Date.now(),
    tournamentId: "cup-1", tournamentMatchId: "r1m1", partyA: "PARY01", partyB: "PARY02"
  }));
  for (let roundId = 1; roundId <= 5; roundId++) {
    await assertSucceeds(update(ref(host, tournamentTeamSession), { roundId }));
    const end = Date.now() - 100;
    await assertSucceeds(set(ref(host, tournamentTeamRound), {
      sessionId: 1, roundId, phase: "preparing", targetIndex: roundId % 4,
      startsAt: end - 1000, endsAt: end
    }));
    await assertSucceeds(update(ref(host, tournamentTeamRound), { phase: "active" }));
  }
  await assertSucceeds(update(ref(host, tournamentTeamSession), { status: "finished", finishedAt: Date.now() }));
  const tournamentResult = `${tournamentSocial}/tournament/results/cup-1/r1m1`;
  const resultRecord = {
    matchId: "r1m1", partyA: "PARY01", partyB: "PARY02",
    winnerPartyCode: "PARY01", winningTeam: "red", teamSessionId: 1, finishedAt: Date.now()
  };
  await assertFails(set(ref(p1, tournamentResult), resultRecord));
  await assertFails(set(ref(host, tournamentResult), { ...resultRecord, winnerPartyCode: "PARY03" }));
  await assertSucceeds(set(ref(host, tournamentResult), resultRecord));
  await assertSucceeds(update(ref(host, tournamentMeta), {
    phase: "completed", completedAt: Date.now(), championPartyCode: "PARY01"
  }));
  console.log("PASS: private keys, one answer per round, mini-game security, party permissions, tournament registrations, and host-only bracket results.");
} finally {
  await env.cleanup();
}
