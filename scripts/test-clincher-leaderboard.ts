import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamRegisterResponse,
  QuizQuestion,
  FinalLeaderboardPayload,
  ClincherStatePayload,
  ClincherRoundResult,
  LeaderboardEntry,
} from "../src/types/socket";
import type { GameSession } from "../src/lib/db";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runClincherAndLeaderboardTests() {
  console.log("\n==================================================================");
  console.log("  🧪 RUNNING COMPREHENSIVE LEADERBOARD & CLINCHER TEST SUITE");
  console.log("==================================================================\n");

  const serverUrl = "http://127.0.0.1:3000";

  // Setup Admin Socket
  const adminCookie = getTestAdminCookie();
  const adminSocket: TypedSocket = io(serverUrl, {
    transports: ["polling", "websocket"],
    extraHeaders: {
      Cookie: adminCookie,
    },
  });
  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("client:register", { role: "admin", name: "Lead Presenter" });

  // -------------------------------------------------------------
  // TEST PART 1: UNIQUE WINNER & ENDING GAME WITHOUT TIE
  // -------------------------------------------------------------
  console.log("--> [TEST 1] Game Completion & Unique Winner (No Tie)...");

  const session1 = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Session 1 - Unique Winner Test" }, (res) => resolve(res));
  });
  console.log(`✓ Created Session 1: ${session1.id}`);

  // Create Question for Session 1
  const q1 = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session1.id,
          questionText: "What layer is IP in the OSI Model?",
          options: { A: "Application", B: "Network", C: "Data Link", D: "Physical" },
          correctAnswer: "B",
          timeLimit: 10,
          points: 100,
        },
      },
      (res) => (res.success && res.question ? resolve(res.question) : reject(new Error(res.error)))
    );
  });

  // Register Team 1 (Alpha) and Team 2 (Beta)
  const p1Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => p1Socket.on("connect", () => resolve()));
  const p1Reg = await new Promise<TeamRegisterResponse>((resolve) => {
    p1Socket.emit("team:register", { sessionId: session1.id, teamName: "Alpha Solvers", leaderName: "Ada" }, resolve);
  });
  assert(!!p1Reg.success && !!p1Reg.team, "Alpha registration failed");

  const p2Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => p2Socket.on("connect", () => resolve()));
  const p2Reg = await new Promise<TeamRegisterResponse>((resolve) => {
    p2Socket.emit("team:register", { sessionId: session1.id, teamName: "Beta Coders", leaderName: "Bob" }, resolve);
  });
  assert(!!p2Reg.success && !!p2Reg.team, "Beta registration failed");

  // Activate Question
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session1.id, questionId: q1.id }, () => resolve());
  });

  // Alpha answers CORRECT (B), Beta answers INCORRECT (A)
  await new Promise<void>((resolve) => {
    p1Socket.emit(
      "quiz:submit_answer",
      { sessionId: session1.id, teamId: p1Reg.team!.id, token: p1Reg.token!, questionId: q1.id, choice: "B" },
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    p2Socket.emit(
      "quiz:submit_answer",
      { sessionId: session1.id, teamId: p2Reg.team!.id, token: p2Reg.token!, questionId: q1.id, choice: "A" },
      () => resolve()
    );
  });

  // End Question
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session1.id }, () => resolve());
  });

  // Fetch Leaderboard
  const lb1 = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session1.id }, resolve);
  });

  assert(lb1.entries.length === 2, "Leaderboard must have 2 teams");
  assert(lb1.hasTieForFirst === false, "Must NOT have tie for first");
  assert(lb1.entries[0].teamName === "Alpha Solvers", "Alpha must be Rank 1");
  assert(lb1.entries[0].rank === 1 && lb1.entries[0].totalScore === 100, "Alpha has 100 pts");
  assert(lb1.entries[0].correctCount === 1, "Alpha has 1 correct answer");
  assert(lb1.entries[1].rank === 2 && lb1.entries[1].totalScore === 0, "Beta has 0 pts");
  assert(lb1.winner?.teamName === "Alpha Solvers", "Winner must be Alpha Solvers");
  console.log(`✓ Leaderboard verified: Rank 1=${lb1.entries[0].teamName} (${lb1.entries[0].totalScore}pts), Rank 2=${lb1.entries[1].teamName} (${lb1.entries[1].totalScore}pts)`);

  // End Presentation Game without tie
  const endRes1 = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:end_game", { sessionId: session1.id }, resolve);
  });
  assert(endRes1.isFinished === true, "Session must be marked finished");
  assert(endRes1.winner?.teamName === "Alpha Solvers", "Final winner confirmed as Alpha Solvers");
  console.log("✓ Presentation game ended without tie. Winner highlighted correctly.");

  p1Socket.disconnect();
  p2Socket.disconnect();

  // -------------------------------------------------------------
  // TEST PART 2: TIE FOR FIRST PLACE & CLINCHER ROUNDS
  // -------------------------------------------------------------
  console.log("\n--> [TEST 2] Tie for First Place Detection...");

  const session2 = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Session 2 - Clincher Tournament" }, (res) => resolve(res));
  });
  console.log(`✓ Created Session 2: ${session2.id}`);

  // Create Question 1
  const s2q1 = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session2.id,
          questionText: "Which HTTP status code signifies Not Found?",
          options: { A: "200", B: "301", C: "404", D: "500" },
          correctAnswer: "C",
          timeLimit: 10,
          points: 100,
        },
      },
      (res) => (res.success && res.question ? resolve(res.question) : reject(new Error(res.error)))
    );
  });

  // Create Clincher Question 1
  const clincherQ1 = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session2.id,
          questionText: "Clincher 1: What is the port number for HTTPS?",
          options: { A: "80", B: "443", C: "8080", D: "22" },
          correctAnswer: "B",
          timeLimit: 10,
          points: 100,
        },
      },
      (res) => (res.success && res.question ? resolve(res.question) : reject(new Error(res.error)))
    );
  });

  // Create Clincher Question 2
  const clincherQ2 = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session2.id,
          questionText: "Clincher 2: What data structure uses FIFO?",
          options: { A: "Queue", B: "Stack", C: "Tree", D: "Graph" },
          correctAnswer: "A",
          timeLimit: 10,
          points: 100,
        },
      },
      (res) => (res.success && res.question ? resolve(res.question) : reject(new Error(res.error)))
    );
  });

  // Register 3 Teams: Team A, Team B, Team C
  const sockA: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => sockA.on("connect", () => resolve()));
  const regA = await new Promise<TeamRegisterResponse>((resolve) => {
    sockA.emit("team:register", { sessionId: session2.id, teamName: "Cyber Eagles", leaderName: "Alex" }, resolve);
  });

  const sockB: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => sockB.on("connect", () => resolve()));
  const regB = await new Promise<TeamRegisterResponse>((resolve) => {
    sockB.emit("team:register", { sessionId: session2.id, teamName: "Byte Bandits", leaderName: "Bella" }, resolve);
  });

  const sockC: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => sockC.on("connect", () => resolve()));
  const regC = await new Promise<TeamRegisterResponse>((resolve) => {
    sockC.emit("team:register", { sessionId: session2.id, teamName: "Circuit Breakers", leaderName: "Charlie" }, resolve);
  });

  const teamA = regA.team!;
  const teamB = regB.team!;
  const teamC = regC.team!;

  // Run Question 1: Cyber Eagles & Byte Bandits both answer C (Correct, +100), Circuit Breakers answers A (Incorrect, 0)
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session2.id, questionId: s2q1.id }, () => resolve());
  });

  await new Promise<void>((resolve) => {
    sockA.emit("quiz:submit_answer", { sessionId: session2.id, teamId: teamA.id, token: regA.token!, questionId: s2q1.id, choice: "C" }, () => resolve());
  });
  await new Promise<void>((resolve) => {
    sockB.emit("quiz:submit_answer", { sessionId: session2.id, teamId: teamB.id, token: regB.token!, questionId: s2q1.id, choice: "C" }, () => resolve());
  });
  await new Promise<void>((resolve) => {
    sockC.emit("quiz:submit_answer", { sessionId: session2.id, teamId: teamC.id, token: regC.token!, questionId: s2q1.id, choice: "A" }, () => resolve());
  });

  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session2.id }, () => resolve());
  });

  // Verify Leaderboard has a Tie for 1st Place
  const lb2 = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session2.id }, resolve);
  });

  assert(lb2.hasTieForFirst === true, "Must detect tie for 1st place");
  assert(lb2.tiedFirstPlaceTeamIds.length === 2, "2 teams tied for first");
  assert(lb2.tiedFirstPlaceTeamIds.includes(teamA.id), "Team A is tied for first");
  assert(lb2.tiedFirstPlaceTeamIds.includes(teamB.id), "Team B is tied for first");
  assert(!lb2.tiedFirstPlaceTeamIds.includes(teamC.id), "Team C is NOT tied for first");

  const rankA = lb2.entries.find((e) => e.teamId === teamA.id)!;
  const rankB = lb2.entries.find((e) => e.teamId === teamB.id)!;
  const rankC = lb2.entries.find((e) => e.teamId === teamC.id)!;

  assert(rankA.rank === 1 && rankB.rank === 1, "Both tied teams must have rank 1");
  assert(rankA.isTiedForFirst && rankB.isTiedForFirst, "Both marked isTiedForFirst");
  assert(rankC.rank === 3, "Third team must have standard competition rank 3");
  assert(lb2.winner === null, "Winner is undecided until clincher concludes");
  console.log(`✓ Tie for 1st place verified: Team A (Rank 1, 100pts), Team B (Rank 1, 100pts), Team C (Rank 3, 0pts)`);

  // -------------------------------------------------------------
  // TEST PART 3: CLINCHER WITH ZERO CORRECT ANSWERS (0 Correct)
  // -------------------------------------------------------------
  console.log("\n--> [TEST 3] Clincher Round 1: All Answers Incorrect (0 Correct)...");

  // Start Clincher Round 1 with default rules (power-ups disabled)
  const clincherStart1 = await new Promise<{ success: boolean; error?: string; clincher?: ClincherStatePayload }>((resolve) => {
    adminSocket.emit(
      "clincher:start_round",
      {
        sessionId: session2.id,
        questionId: clincherQ1.id,
        timeLimit: 15,
        allowPowerUps: false,
      },
      resolve
    );
  });

  assert(clincherStart1.success === true, "Clincher round 1 start must succeed");
  assert(clincherStart1.clincher?.roundNumber === 1, "Round number must be 1");
  assert(clincherStart1.clincher?.allowPowerUps === false, "Power-ups must be disabled by default");
  assert(clincherStart1.clincher?.contendingTeamIds.length === 2, "Only 2 tied teams in contention");
  assert(!clincherStart1.clincher?.contendingTeamIds.includes(teamC.id), "Team C excluded from contention");
  console.log(`✓ Clincher Round 1 launched. Contenders: ${clincherStart1.clincher?.contendingTeamIds.length} teams.`);

  // Verify power-up activation is blocked during clincher
  const powerUpAttempt = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    sockA.emit(
      "powerup:activate",
      { sessionId: session2.id, teamId: teamA.id, token: regA.token!, questionId: clincherQ1.id },
      resolve
    );
  });
  assert(powerUpAttempt.success === false, "Power-up during clincher must be rejected");
  assert(Boolean(powerUpAttempt.error?.toLowerCase().includes("disabled during the clincher") || powerUpAttempt.error?.toLowerCase().includes("disabled during this clincher")), "Error must mention power-ups disabled");
  console.log(`✓ Power-up blocked during clincher: "${powerUpAttempt.error}"`);

  // Verify non-contending team C submission is rejected
  const nonContenderSub = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    sockC.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamC.id, token: regC.token!, questionId: clincherQ1.id, choice: "B" },
      resolve
    );
  });
  assert(nonContenderSub.success === false, "Non-contender submission must be rejected");
  console.log(`✓ Non-contender rejected from clincher submission: "${nonContenderSub.error}"`);

  // Both Team A and Team B submit INCORRECT answers (Choice A and Choice C, when correct is B)
  const subA1 = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    sockA.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamA.id, token: regA.token!, questionId: clincherQ1.id, choice: "A" },
      resolve
    );
  });
  assert(subA1.success === true, "Team A clincher submission succeeded");

  const subB1 = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    sockB.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamB.id, token: regB.token!, questionId: clincherQ1.id, choice: "C" },
      resolve
    );
  });
  assert(subB1.success === true, "Team B clincher submission succeeded");

  // Admin ends Round 1
  const endRound1 = await new Promise<{ success: boolean; result?: ClincherRoundResult }>((resolve) => {
    adminSocket.emit("clincher:end_round", { sessionId: session2.id }, resolve);
  });
  assert(endRound1.success === true && !!endRound1.result, "Clincher round 1 ended");
  assert(endRound1.result!.status === "tied", "Outcome must be 'tied' when 0 correct");
  assert(endRound1.result!.survivingTeamIds.length === 2, "Both teams survive for next question");
  console.log(`✓ Clincher Round 1 outcome: ${endRound1.result!.message}`);

  // Verify regular scores remain UNCHANGED!
  const lbAfterR1 = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session2.id }, resolve);
  });
  const scoreA1 = lbAfterR1.entries.find((e) => e.teamId === teamA.id)!.totalScore;
  const scoreB1 = lbAfterR1.entries.find((e) => e.teamId === teamB.id)!.totalScore;
  const scoreC1 = lbAfterR1.entries.find((e) => e.teamId === teamC.id)!.totalScore;
  assert(scoreA1 === 100 && scoreB1 === 100 && scoreC1 === 0, "Ordinary leaderboard scores must be completely unmodified");
  console.log(`✓ Verified ordinary leaderboard scores remain strictly unchanged: A=${scoreA1}, B=${scoreB1}, C=${scoreC1}`);

  // -------------------------------------------------------------
  // TEST PART 4: CLINCHER WITH MULTIPLE CORRECT ANSWERS (Tie Persists)
  // -------------------------------------------------------------
  console.log("\n--> [TEST 4] Clincher Round 2: Multiple Correct Answers (Tie Persists)...");

  // Start Clincher Round 2 with clincherQ2 (correct answer is A)
  const clincherStart2 = await new Promise<{ success: boolean; clincher?: ClincherStatePayload }>((resolve) => {
    adminSocket.emit(
      "clincher:start_round",
      {
        sessionId: session2.id,
        questionId: clincherQ2.id,
        timeLimit: 15,
      },
      resolve
    );
  });
  assert(clincherStart2.success === true, "Clincher round 2 start must succeed");
  assert(clincherStart2.clincher?.roundNumber === 2, "Round number must be 2");

  // Both Team A and Team B submit CORRECT answers (Choice A)
  await new Promise<void>((resolve) => {
    sockA.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamA.id, token: regA.token!, questionId: clincherQ2.id, choice: "A" },
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    sockB.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamB.id, token: regB.token!, questionId: clincherQ2.id, choice: "A" },
      () => resolve()
    );
  });

  // End Round 2
  const endRound2 = await new Promise<{ success: boolean; result?: ClincherRoundResult }>((resolve) => {
    adminSocket.emit("clincher:end_round", { sessionId: session2.id }, resolve);
  });
  assert(endRound2.success === true && !!endRound2.result, "Clincher round 2 ended");
  assert(endRound2.result!.status === "tied", "Outcome must be 'tied' when multiple answer correctly");
  assert(endRound2.result!.survivingTeamIds.length === 2, "Both teams survive to round 3");
  console.log(`✓ Clincher Round 2 outcome: ${endRound2.result!.message}`);

  // Verify regular scores remain UNCHANGED!
  const lbAfterR2 = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session2.id }, resolve);
  });
  const scoreA2 = lbAfterR2.entries.find((e) => e.teamId === teamA.id)!.totalScore;
  const scoreB2 = lbAfterR2.entries.find((e) => e.teamId === teamB.id)!.totalScore;
  assert(scoreA2 === 100 && scoreB2 === 100, "Ordinary leaderboard scores must remain 100 pts");
  console.log("✓ Ordinary scores remained strictly unchanged after multiple correct answers.");

  // -------------------------------------------------------------
  // TEST PART 5: CLINCHER WITH EXACTLY ONE CORRECT -> WINNER CROWNED
  // -------------------------------------------------------------
  console.log("\n--> [TEST 5] Clincher Round 3: Exactly One Team Correct -> Winner Crowned...");

  // Create Clincher Question 3
  const clincherQ3 = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session2.id,
          questionText: "Clincher 3: What protocol resolves IP to MAC address?",
          options: { A: "DNS", B: "ARP", C: "DHCP", D: "ICMP" },
          correctAnswer: "B",
          timeLimit: 15,
          points: 100,
        },
      },
      (res) => (res.success && res.question ? resolve(res.question) : reject(new Error(res.error)))
    );
  });

  // Start Clincher Round 3
  await new Promise<void>((resolve) => {
    adminSocket.emit("clincher:start_round", { sessionId: session2.id, questionId: clincherQ3.id }, () => resolve());
  });

  // Listen for champion crowned event
  const championCrownedPromise = new Promise<{ winner: LeaderboardEntry; leaderboard: FinalLeaderboardPayload }>((resolve) => {
    adminSocket.on("clincher:champion_crowned", resolve);
  });

  // Team A submits CORRECT (B), Team B submits INCORRECT (A)
  await new Promise<void>((resolve) => {
    sockA.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamA.id, token: regA.token!, questionId: clincherQ3.id, choice: "B" },
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    sockB.emit(
      "clincher:submit_answer",
      { sessionId: session2.id, teamId: teamB.id, token: regB.token!, questionId: clincherQ3.id, choice: "A" },
      () => resolve()
    );
  });

  // End Round 3
  const endRound3 = await new Promise<{ success: boolean; result?: ClincherRoundResult }>((resolve) => {
    adminSocket.emit("clincher:end_round", { sessionId: session2.id }, resolve);
  });

  assert(endRound3.success === true && !!endRound3.result, "Clincher round 3 ended");
  assert(endRound3.result!.status === "won", "Round 3 must be won");
  assert(endRound3.result!.winnerTeamId === teamA.id, "Winner must be Team A (Cyber Eagles)");
  console.log(`✓ Clincher Round 3 outcome: ${endRound3.result!.message}`);

  const crownData = await championCrownedPromise;
  assert(crownData.winner.teamName === "Cyber Eagles", "Crowned winner must be Cyber Eagles");
  assert(crownData.winner.isClincherWinner === true, "Winner has isClincherWinner flag");
  console.log(`✓ Champion crowned event verified: 🏆 ${crownData.winner.teamName} 🏆`);

  // Final Leaderboard Verification
  const finalLb = await new Promise<FinalLeaderboardPayload>((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session2.id }, resolve);
  });

  assert(finalLb.winner?.teamName === "Cyber Eagles", "Final winner is Cyber Eagles");
  assert(finalLb.winner?.isClincherWinner === true, "Final winner has isClincherWinner: true");
  assert(finalLb.hasTieForFirst === false, "Tie for first resolved by clincher");
  assert(finalLb.entries[0].teamName === "Cyber Eagles" && finalLb.entries[0].rank === 1, "Rank 1 is Cyber Eagles");
  assert(finalLb.entries[1].teamName === "Byte Bandits" && finalLb.entries[1].rank === 2, "Rank 2 is Byte Bandits");
  assert(finalLb.entries[2].teamName === "Circuit Breakers" && finalLb.entries[2].rank === 3, "Rank 3 is Circuit Breakers");

  // Verify regular scores are STILL preserved!
  assert(finalLb.entries[0].totalScore === 100, "Cyber Eagles regular score is STILL 100 pts");
  assert(finalLb.entries[1].totalScore === 100, "Byte Bandits regular score is STILL 100 pts");
  assert(finalLb.entries[2].totalScore === 0, "Circuit Breakers score is STILL 0 pts");
  console.log(`✓ Final standings with Clincher Winner verified without mutating original points!`);

  // Disconnect sockets
  sockA.disconnect();
  sockB.disconnect();
  sockC.disconnect();
  adminSocket.disconnect();

  console.log("\n==================================================================");
  console.log("  🎉 ALL 6 LEADERBOARD & CLINCHER TEST SCENARIOS PASSED PERFECTLY!");
  console.log("==================================================================\n");
}

runClincherAndLeaderboardTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
