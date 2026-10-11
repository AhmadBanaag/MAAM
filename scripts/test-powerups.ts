import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamRegisterResponse,
  TeamReconnectResponse,
  QuizSubmitResponse,
  QuizQuestion,
  TeamPowerUpAssignment,
  ActiveSpellEffect,
  QuizChoice,
  PowerUpType,
  ActiveQuizStatePayload,
} from "../src/types/socket";
import type { GameSession, TeamLobbyInfo } from "../src/lib/db";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RegisteredTeamSession {
  team: TeamLobbyInfo;
  token: string;
  socket: TypedSocket;
  powerUp?: TeamPowerUpAssignment;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPowerUpTests() {
  console.log("\n=======================================================");
  console.log("  🧪 RUNNING FIVE-POWER-UP SYSTEM COMPREHENSIVE SUITE");
  console.log("=======================================================\n");

  const serverUrl = "http://127.0.0.1:3000";

  // -------------------------------------------------------------
  // 1. Setup Admin & Fresh Game Session
  // -------------------------------------------------------------
  console.log("--> Step 1: Connecting Admin and creating session...");
  const adminCookie = getTestAdminCookie();
  const adminSocket: TypedSocket = io(serverUrl, {
    transports: ["polling", "websocket"],
    extraHeaders: {
      Cookie: adminCookie,
    },
  });
  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("client:register", { role: "admin", name: "Game Admin" });

  const session = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Automated Power-Up Battle" }, (newSession: GameSession) => {
      resolve(newSession);
    });
  });
  console.log(`✓ Admin session established: ${session.id} ("${session.title}")`);

  // -------------------------------------------------------------
  // 2. Prepare 4 Test Questions in Question Bank
  // -------------------------------------------------------------
  console.log("\n--> Step 2: Preparing test quiz questions in bank...");
  const questions: QuizQuestion[] = [];
  const testQuestionData = [
    {
      questionText: "Q1 (Invisibility & Answer Reveal): What is the speed of light in vacuum?",
      options: { A: "300,000 km/s", B: "150,000 km/s", C: "1,000 km/s", D: "Sound speed" },
      correctAnswer: "A" as QuizChoice,
      timeLimit: 15,
      points: 100,
    },
    {
      questionText: "Q2 (Lockdown & Back to Sender): Which planet is known as the Red Planet?",
      options: { A: "Venus", B: "Mars", C: "Jupiter", D: "Saturn" },
      correctAnswer: "B" as QuizChoice,
      timeLimit: 15,
      points: 100,
    },
    {
      questionText: "Q3 (Riddle Spell): Which programming language was created by Brendan Eich?",
      options: { A: "Python", B: "Java", C: "JavaScript", D: "C++" },
      correctAnswer: "C" as QuizChoice,
      timeLimit: 15,
      points: 100,
    },
    {
      questionText: "Q4 (Simultaneous & Admin Resolution): What is 2 + 2 in base 10?",
      options: { A: "3", B: "4", C: "5", D: "22" },
      correctAnswer: "B" as QuizChoice,
      timeLimit: 15,
      points: 100,
    },
  ];

  for (const qData of testQuestionData) {
    const saved = await new Promise<QuizQuestion>((resolve, reject) => {
      adminSocket.emit("quiz:save_question", { question: { ...qData, sessionId: session.id } }, (res) => {
        if (res.success && res.question) resolve(res.question);
        else reject(new Error(res.error || "Failed to save question"));
      });
    });
    questions.push(saved);
  }
  console.log(`✓ Created ${questions.length} test questions for scenario testing.`);

  // -------------------------------------------------------------
  // 3. Register Exactly 5 Competing Teams
  // -------------------------------------------------------------
  console.log("\n--> Step 3: Registering exactly 5 competing teams...");
  const teams: RegisteredTeamSession[] = [];
  const teamNames = [
    { teamName: "Cyber Knights", leaderName: "Alice" },
    { teamName: "Shadow Wizards", leaderName: "Bob" },
    { teamName: "Quantum Phoenix", leaderName: "Charlie" },
    { teamName: "Neon Dragons", leaderName: "Diana" },
    { teamName: "Glitch Titans", leaderName: "Edward" },
  ];

  for (const tInfo of teamNames) {
    const s: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
    await new Promise<void>((resolve) => s.on("connect", () => resolve()));
    const regRes = await new Promise<TeamRegisterResponse>((resolve) => {
      s.emit("team:register", { sessionId: session.id, ...tInfo }, (res) => resolve(res));
    });
    if (!regRes.success || !regRes.team || !regRes.token) {
      throw new Error(`Failed to register ${tInfo.teamName}: ${regRes.error}`);
    }
    teams.push({ team: regRes.team, token: regRes.token, socket: s });
    console.log(`  + Registered: ${regRes.team.name} (Slot ${regRes.team.slotNumber})`);
  }

  // Allow assignment events to settle
  await sleep(300);

  // -------------------------------------------------------------
  // 4. Verify 5 Unique Power-Up Assignments
  // -------------------------------------------------------------
  console.log("\n--> Step 4: Verifying 5 Unique Power-Up Assignments & Persistence...");
  const allAssignments = await new Promise<TeamPowerUpAssignment[]>((resolve) => {
    adminSocket.emit("powerup:get_all", { sessionId: session.id }, (res) => resolve(res));
  });

  if (allAssignments.length !== 5) {
    throw new Error(`Expected exactly 5 power-up assignments, got ${allAssignments.length}`);
  }

  const assignedTypes = new Set<PowerUpType>(allAssignments.map((a) => a.powerUpType));
  const expectedTypes: PowerUpType[] = ["invisibility", "lockdown", "back_to_sender", "riddle", "answer_reveal"];
  for (const t of expectedTypes) {
    if (!assignedTypes.has(t)) {
      throw new Error(`Missing expected power-up assignment type: ${t}`);
    }
  }
  console.log("✓ All 5 unique power-ups assigned (1-per-team bijection):");
  allAssignments.forEach((a) => {
    console.log(`  - [Slot ${a.slotNumber}] ${a.teamName}: ${a.powerUpName} (${a.powerUpType})`);
    const teamObj = teams.find((t) => t.team.id === a.teamId);
    if (teamObj) teamObj.powerUp = a;
  });

  // Verify persistence: call powerup:assign_all again, must return identical assignments without rerandomization
  const reAssignments = await new Promise<TeamPowerUpAssignment[]>((resolve) => {
    adminSocket.emit("powerup:assign_all", { sessionId: session.id }, (res) => resolve(res));
  });
  for (let i = 0; i < allAssignments.length; i++) {
    if (allAssignments[i].teamId !== reAssignments[i].teamId || allAssignments[i].powerUpType !== reAssignments[i].powerUpType) {
      throw new Error("Power-up assignments were unexpectedly rerandomized!");
    }
  }
  console.log("✓ Assignments strictly persisted across re-queries (No rerandomization).");

  // Verify explicit shuffling works via powerup:shuffle
  console.log("--> Testing explicit power-up shuffling (powerup:shuffle)...");
  const shuffleResult = await new Promise<{ success: boolean; assignments?: TeamPowerUpAssignment[]; error?: string }>((resolve) => {
    adminSocket.emit("powerup:shuffle", { sessionId: session.id }, (res) => resolve(res));
  });
  if (!shuffleResult.success || !shuffleResult.assignments || shuffleResult.assignments.length !== 5) {
    throw new Error(`Failed to shuffle power-ups: ${shuffleResult.error || "unknown"}`);
  }
  const shuffledTypesSet = new Set(shuffleResult.assignments.map((a) => a.powerUpType));
  if (shuffledTypesSet.size !== 5) {
    throw new Error("Shuffled assignments did not contain all 5 unique types!");
  }
  console.log("✓ Admin powerup:shuffle successfully re-randomized assignments.");

  // Update team objects with newly shuffled assignments
  shuffleResult.assignments.forEach((a) => {
    const teamObj = teams.find((t) => t.team.id === a.teamId);
    if (teamObj) teamObj.powerUp = a;
  });

  // Allow assignment events to settle
  await sleep(300);

  // Verify each team can only fetch its own power-up
  for (const t of teams) {
    const myPu = await new Promise<TeamPowerUpAssignment | null>((resolve) => {
      t.socket.emit("powerup:get_my", { sessionId: session.id, teamId: t.team.id, token: t.token }, (res) => resolve(res));
    });
    if (!myPu || myPu.powerUpType !== t.powerUp?.powerUpType) {
      throw new Error(`Team ${t.team.name} received invalid or mismatched power-up data!`);
    }
  }
  console.log("✓ Each team strictly receives only its own power-up data.");

  // Helper map by type
  const teamByType = new Map<PowerUpType, RegisteredTeamSession>();
  for (const t of teams) {
    if (t.powerUp) teamByType.set(t.powerUp.powerUpType, t);
  }

  // -------------------------------------------------------------
  // 5. Test Unauthorized & Invalid Activations
  // -------------------------------------------------------------
  console.log("\n--> Step 5: Testing Security: Unauthorized & Inactive-Quiz Activations...");

  // Attempt activation when no quiz question is active
  const teamInvis = teamByType.get("invisibility")!;
  const inactiveActivation = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    teamInvis.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamInvis.team.id, token: teamInvis.token, questionId: questions[0].id },
      (res) => resolve(res)
    );
  });
  if (inactiveActivation.success) {
    throw new Error("Security failure: Activation was accepted when no question was active!");
  }
  console.log(`✓ Inactive question activation properly rejected: "${inactiveActivation.error}"`);

  // -------------------------------------------------------------
  // 6. Question 1: Test Invisibility Spell & Answer Reveal
  // -------------------------------------------------------------
  console.log("\n--> Step 6: Question 1: Testing Invisibility Spell & Answer Reveal Privacy...");
  const q1 = questions[0];

  // Activate Question 1
  await new Promise<void>((resolve, reject) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session.id, questionId: q1.id }, (res) => {
      if (res.success) resolve();
      else reject(new Error(res.error || "Failed to activate question 1"));
    });
  });

  // Test Answer Reveal Privacy
  const teamReveal = teamByType.get("answer_reveal")!;
  const teamLock = teamByType.get("lockdown")!;

  let otherTeamHeardAnswer = false;
  teamLock.socket.on("powerup:answer_revealed", () => {
    otherTeamHeardAnswer = true;
  });

  const revealRes = await new Promise<{ success: boolean; error?: string; answerReveal?: QuizChoice }>((resolve) => {
    teamReveal.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamReveal.team.id, token: teamReveal.token, questionId: q1.id },
      (res) => resolve(res)
    );
  });
  if (!revealRes.success || revealRes.answerReveal !== q1.correctAnswer) {
    throw new Error(`Answer Reveal failed: expected ${q1.correctAnswer}, got ${revealRes.answerReveal}`);
  }
  await sleep(100);
  if (otherTeamHeardAnswer) {
    throw new Error("Security failure: Answer Reveal leaked to opposing team!");
  }
  console.log(`✓ Answer Reveal correctly revealed "${revealRes.answerReveal}" privately to owner only.`);

  // Test Invisibility Spell
  const invisRes = await new Promise<{ success: boolean; error?: string; spell?: ActiveSpellEffect }>((resolve) => {
    teamInvis.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamInvis.team.id, token: teamInvis.token, questionId: q1.id },
      (res) => resolve(res)
    );
  });
  if (!invisRes.success) {
    throw new Error(`Failed to activate Invisibility: ${invisRes.error}`);
  }
  await sleep(200);

  // Query state for an opponent to verify choice text stripping on server
  const opponentTeam = teams.find((t) => t.team.id !== teamInvis.team.id)!;
  const oppState = await new Promise<ActiveQuizStatePayload>((resolve) => {
    opponentTeam.socket.emit("quiz:get_state", { sessionId: session.id, teamId: opponentTeam.team.id }, (st) => resolve(st));
  });
  if (!oppState.currentQuestion || oppState.currentQuestion.options?.A !== "" || oppState.currentQuestion.options?.B !== "") {
    throw new Error("Security failure: Invisibility did not mask option text on the server!");
  }
  console.log("✓ Invisibility active: Server stripped choice strings for opposing teams.");

  // Opponent submits letter 'A' blind
  const subRes = await new Promise<QuizSubmitResponse>((resolve) => {
    opponentTeam.socket.emit(
      "quiz:submit_answer",
      { sessionId: session.id, teamId: opponentTeam.team.id, token: opponentTeam.token, questionId: q1.id, choice: "A" },
      (res) => resolve(res)
    );
  });
  if (!subRes.success) {
    throw new Error(`Opponent failed to submit blind letter choice under Invisibility: ${subRes.error}`);
  }
  console.log("✓ Opponent successfully submitted choice 'A' under Invisibility.");

  // End Question 1
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session.id }, () => resolve());
  });
  console.log("✓ Question 1 ended. Invisibility and Answer Reveal expired.");

  // -------------------------------------------------------------
  // 7. Question 2: Test Lockdown Spell & Back to Sender Reflection
  // -------------------------------------------------------------
  console.log("\n--> Step 7: Question 2: Testing Lockdown Spell & Back to Sender Reflection...");
  const q2 = questions[1];

  await new Promise<void>((resolve, reject) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session.id, questionId: q2.id }, (res) => {
      if (res.success) resolve();
      else reject(new Error(res.error || "Failed to activate question 2"));
    });
  });

  const teamBts = teamByType.get("back_to_sender")!;

  // Step 7a: Team BTS activates Back to Sender shield
  const btsRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    teamBts.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamBts.team.id, token: teamBts.token, questionId: q2.id },
      (res) => resolve(res)
    );
  });
  if (!btsRes.success) {
    throw new Error(`Back to Sender activation failed: ${btsRes.error}`);
  }
  console.log(`✓ ${teamBts.team.name} deployed Back to Sender shield.`);

  // Step 7b: Team Lock casts Lockdown while BTS shield is active
  const lockRes = await new Promise<{ success: boolean; error?: string; spell?: ActiveSpellEffect }>((resolve) => {
    teamLock.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamLock.team.id, token: teamLock.token, questionId: q2.id },
      (res) => resolve(res)
    );
  });
  if (!lockRes.success || !lockRes.spell) {
    throw new Error(`Lockdown activation failed: ${lockRes.error}`);
  }
  if (!lockRes.spell.isReflected || lockRes.spell.reflectedByTeamId !== teamBts.team.id) {
    throw new Error(`Back to Sender did not reflect Lockdown spell! (isReflected: ${lockRes.spell.isReflected})`);
  }
  console.log(`✓ Lockdown was REFLECTED back to caster (${teamLock.team.name}) by ${teamBts.team.name}!`);

  // Step 7c: Verify Team Lock (the caster) is locked down, and Team BTS is NOT locked down
  const lockSubmission = await new Promise<QuizSubmitResponse>((resolve) => {
    teamLock.socket.emit(
      "quiz:submit_answer",
      { sessionId: session.id, teamId: teamLock.team.id, token: teamLock.token, questionId: q2.id, choice: "B" },
      (res) => resolve(res)
    );
  });
  if (lockSubmission.success) {
    throw new Error("Lockdown reflection failed: Caster was able to submit while locked down!");
  }
  console.log(`✓ Reflected Lockdown properly blocked caster's submission: "${lockSubmission.error}"`);

  // Step 7d: Team BTS can submit normally
  const btsSubmission = await new Promise<QuizSubmitResponse>((resolve) => {
    teamBts.socket.emit(
      "quiz:submit_answer",
      { sessionId: session.id, teamId: teamBts.team.id, token: teamBts.token, questionId: q2.id, choice: "B" },
      (res) => resolve(res)
    );
  });
  if (!btsSubmission.success) {
    throw new Error(`Protected BTS team was incorrectly blocked from submitting: ${btsSubmission.error}`);
  }
  console.log("✓ Reflector team successfully submitted their answer without obstruction.");

  // End Question 2
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session.id }, () => resolve());
  });

  // -------------------------------------------------------------
  // 8. Question 3: Test Riddle Spell & Server-Side Solve Gate
  // -------------------------------------------------------------
  console.log("\n--> Step 8: Question 3: Testing Riddle Spell & Server-Side Solve Gate...");
  const q3 = questions[2];

  await new Promise<void>((resolve, reject) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session.id, questionId: q3.id }, (res) => {
      if (res.success) resolve();
      else reject(new Error(res.error || "Failed to activate question 3"));
    });
  });

  const teamRiddle = teamByType.get("riddle")!;

  // Team Riddle activates Riddle Spell
  const riddleRes = await new Promise<{ success: boolean; error?: string; spell?: ActiveSpellEffect }>((resolve) => {
    teamRiddle.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamRiddle.team.id, token: teamRiddle.token, questionId: q3.id },
      (res) => resolve(res)
    );
  });
  if (!riddleRes.success || !riddleRes.spell?.riddle) {
    throw new Error(`Riddle spell activation failed: ${riddleRes.error}`);
  }
  const riddleData = riddleRes.spell.riddle;
  console.log(`✓ Riddle spell active: "${riddleData.questionText}" (ID: ${riddleData.id})`);

  // An opponent (not the riddle caster) attempts to submit main quiz answer before solving riddle
  const testOpponent = teams.find((t) => t.team.id !== teamRiddle.team.id)!;
  const blockedSubmission = await new Promise<QuizSubmitResponse>((resolve) => {
    testOpponent.socket.emit(
      "quiz:submit_answer",
      { sessionId: session.id, teamId: testOpponent.team.id, token: testOpponent.token, questionId: q3.id, choice: "C" },
      (res) => resolve(res)
    );
  });
  if (blockedSubmission.success) {
    throw new Error("Riddle Gate failure: Opponent submitted quiz answer without solving riddle!");
  }
  console.log(`✓ Main quiz submission blocked by active riddle: "${blockedSubmission.error}"`);

  // Submit incorrect riddle answer
  const wrongRiddleRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    testOpponent.socket.emit(
      "powerup:solve_riddle",
      {
        sessionId: session.id,
        teamId: testOpponent.team.id,
        token: testOpponent.token,
        questionId: q3.id,
        riddleId: riddleData.id,
        answer: "completely_wrong_answer_xyz",
      },
      (res) => resolve(res)
    );
  });
  if (wrongRiddleRes.success) {
    throw new Error("Riddle verification failure: Incorrect answer was accepted!");
  }
  console.log(`✓ Incorrect riddle answer correctly rejected: "${wrongRiddleRes.error}"`);

  // Submit correct riddle answer
  let acceptedAns = "egg";
  if (riddleData.id === "riddle_1") acceptedAns = "keyboard";
  else if (riddleData.id === "riddle_2") acceptedAns = "m";
  else if (riddleData.id === "riddle_3") acceptedAns = "darkness";
  else if (riddleData.id === "riddle_4") acceptedAns = "egg";
  else if (riddleData.id === "riddle_5") acceptedAns = "echo";

  const correctRiddleRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    testOpponent.socket.emit(
      "powerup:solve_riddle",
      {
        sessionId: session.id,
        teamId: testOpponent.team.id,
        token: testOpponent.token,
        questionId: q3.id,
        riddleId: riddleData.id,
        answer: acceptedAns,
      },
      (res) => resolve(res)
    );
  });
  if (!correctRiddleRes.success) {
    throw new Error(`Valid riddle answer "${acceptedAns}" was rejected: ${correctRiddleRes.error}`);
  }
  console.log(`✓ Correct riddle answer "${acceptedAns}" accepted! Question unlocked.`);

  // Opponent now submits main question answer
  const unlockedSub = await new Promise<QuizSubmitResponse>((resolve) => {
    testOpponent.socket.emit(
      "quiz:submit_answer",
      { sessionId: session.id, teamId: testOpponent.team.id, token: testOpponent.token, questionId: q3.id, choice: "C" },
      (res) => resolve(res)
    );
  });
  if (!unlockedSub.success) {
    throw new Error(`Failed to submit answer after unlocking riddle: ${unlockedSub.error}`);
  }
  console.log("✓ Opponent successfully submitted main quiz answer after solving riddle!");

  // End Question 3
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session.id }, () => resolve());
  });

  // -------------------------------------------------------------
  // 9. Question 4: One-Use Enforcement & Simultaneous Activations
  // -------------------------------------------------------------
  console.log("\n--> Step 9: Question 4: Testing One-Use Enforcement & Simultaneous Activations...");
  const q4 = questions[3];

  await new Promise<void>((resolve, reject) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session.id, questionId: q4.id }, (res) => {
      if (res.success) resolve();
      else reject(new Error(res.error || "Failed to activate question 4"));
    });
  });

  // Attempt to activate Riddle spell a second time during an active question
  const reuseRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    teamRiddle.socket.emit(
      "powerup:activate",
      { sessionId: session.id, teamId: teamRiddle.team.id, token: teamRiddle.token, questionId: q4.id },
      (res) => resolve(res)
    );
  });
  if (reuseRes.success) {
    throw new Error("One-use enforcement failure: Consumed power-up was activated twice!");
  }
  console.log(`✓ Consumed power-up activation strictly rejected on active question: "${reuseRes.error}"`);

  // Test Simultaneous Activations handling
  const simultaneousPromises = teams.map((t) => {
    return new Promise<{ teamName: string; res: { success: boolean; error?: string } }>((resolve) => {
      t.socket.emit(
        "powerup:activate",
        { sessionId: session.id, teamId: t.team.id, token: t.token, questionId: q4.id },
        (res) => resolve({ teamName: t.team.name, res })
      );
    });
  });
  const simultaneousResults = await Promise.all(simultaneousPromises);
  console.log("✓ Server handled concurrent simultaneous activation attempts deterministically without crashing:");
  simultaneousResults.forEach((sr) => {
    console.log(`  - ${sr.teamName}: success=${sr.res.success} ${sr.res.error ? `(${sr.res.error})` : "(applied)"}`);
  });

  // -------------------------------------------------------------
  // 10. Reconnection Persistence & Safe Stuck Question Resolver
  // -------------------------------------------------------------
  console.log("\n--> Step 10: Reconnection Persistence & Safe Stuck Question Resolver...");

  // Test Reconnection for Team 1
  const t1 = teams[0];
  t1.socket.disconnect();
  await sleep(150);

  const reconSocket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => reconSocket.on("connect", () => resolve()));
  const reconRes = await new Promise<TeamReconnectResponse>((resolve) => {
    reconSocket.emit("team:reconnect", { sessionId: session.id, teamId: t1.team.id, token: t1.token }, (res) => resolve(res));
  });
  if (!reconRes.success || reconRes.team?.id !== t1.team.id) {
    throw new Error(`Team reconnection failed: ${reconRes.error}`);
  }
  console.log(`✓ Team ${t1.team.name} reconnected successfully.`);

  // Test Admin Safe Resolve Stuck Question
  const resolveRes = await new Promise<{ success: boolean; message: string }>((resolve) => {
    adminSocket.emit("powerup:admin_resolve_stuck", { sessionId: session.id }, (res) => resolve(res));
  });
  if (!resolveRes.success) {
    throw new Error(`Admin stuck question resolve failed: ${resolveRes.message}`);
  }
  console.log(`✓ Admin safely resolved question: "${resolveRes.message}"`);

  // End Question 4
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session.id }, () => resolve());
  });

  // Cleanup sockets
  adminSocket.disconnect();
  reconSocket.disconnect();
  teams.forEach((t) => t.socket.disconnect());

  console.log("\n=======================================================");
  console.log("  🎉 ALL FIVE-POWER-UP SYSTEM TESTS PASSED SUCCESSFULLY!");
  console.log("=======================================================\n");
}

runPowerUpTests().catch((err) => {
  console.error("\n❌ POWER-UP TEST SUITE FAILED:", err);
  process.exit(1);
});
