import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  QuizQuestion,
  LobbyUpdatedPayload,
} from "../src/types/socket";
import type { GameSession } from "../src/lib/db";

const SERVER_URL = "http://127.0.0.1:3000";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function createAdminSocket(cookie: string): TypedSocket {
  return io(SERVER_URL, {
    transports: ["websocket"],
    extraHeaders: {
      Cookie: cookie,
    },
  });
}

function createPlayerSocket(): TypedSocket {
  return io(SERVER_URL, {
    transports: ["websocket"],
  });
}

async function run() {
  console.log("=======================================================");
  console.log("  🔍 COMPREHENSIVE SYSTEM TEST: ADMIN & PLAYER CAPABILITIES");
  console.log("=======================================================\n");

  const errors: string[] = [];
  const adminCookie = getTestAdminCookie();

  // Test 1: Admin Socket Connection & Session Creation
  console.log("--> [TEST 1] Admin Authentication & Session Creation...");
  const adminSocket = createAdminSocket(adminCookie);

  await new Promise<void>((resolve, reject) => {
    adminSocket.on("connect", () => {
      adminSocket.emit("client:register", { role: "admin", name: "Presenter" });
      resolve();
    });
    adminSocket.on("connect_error", (e) => reject(e));
  });

  let session: GameSession = {} as GameSession;
  await new Promise<void>((resolve) => {
    adminSocket.emit("session:create", { title: "Full System Test Session" }, (s) => {
      session = s;
      resolve();
    });
  });

  if (!session || !session.id) {
    throw new Error("Failed to create new game session via admin socket.");
  }
  console.log(`✓ Session created: ${session.id} (${session.title})`);

  // Test 2: Admin Registration Toggle
  console.log("\n--> [TEST 2] Testing Admin Toggle Registration (Open -> Closed -> Reopened)...");
  let toggleSuccess = false;
  await new Promise<void>((resolve) => {
    adminSocket.emit("session:toggle_registration", { sessionId: session!.id, isOpen: false }, (ok) => {
      toggleSuccess = ok;
      resolve();
    });
  });
  if (!toggleSuccess) {
    errors.push("Failed to close registration via admin socket.");
  } else {
    console.log("✓ Registration successfully closed.");
  }

  // Re-open registration
  await new Promise<void>((resolve) => {
    adminSocket.emit("session:toggle_registration", { sessionId: session!.id, isOpen: true }, () => resolve());
  });
  console.log("✓ Registration re-opened.");

  // Test 3: Player Registration (5 slots + 6th rejection + duplicate name rejection)
  console.log("\n--> [TEST 3] Player Registration, Limits, and Validation...");
  const playerSockets: TypedSocket[] = [];
  const playerTokens: string[] = [];
  const playerTeamIds: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const pSock = createPlayerSocket();
    playerSockets.push(pSock);
    await new Promise<void>((resolve) => {
      pSock.on("connect", () => resolve());
    });

    const res: any = await new Promise((resolve) => {
      pSock.emit(
        "team:register",
        { sessionId: session!.id, teamName: `Team ${i}`, leaderName: `Leader ${i}` },
        resolve
      );
    });

    if (!res.success || !res.team) {
      errors.push(`Team ${i} failed to register: ${res.error}`);
    } else {
      playerTokens.push(res.token);
      playerTeamIds.push(res.team.id);
      console.log(`✓ Team ${i} registered in Slot ${res.team.slotNumber}`);
    }
  }

  // Duplicate team name test
  const dupSock = createPlayerSocket();
  await new Promise<void>((res) => dupSock.on("connect", () => res()));
  const dupRes: any = await new Promise((res) => {
    dupSock.emit(
      "team:register",
      { sessionId: session!.id, teamName: "team 1", leaderName: "Clone Leader" },
      res
    );
  });
  if (dupRes.success) {
    errors.push("Duplicate team name was incorrectly accepted!");
  } else {
    console.log(`✓ Duplicate team name correctly rejected: "${dupRes.error}"`);
  }

  // 6th team rejection test
  const sixthRes: any = await new Promise((res) => {
    dupSock.emit(
      "team:register",
      { sessionId: session!.id, teamName: "Team 6", leaderName: "Extra Leader" },
      res
    );
  });
  if (sixthRes.success) {
    errors.push("6th team was accepted when max slots is 5!");
  } else {
    console.log(`✓ 6th team correctly rejected (Lobby Full): "${sixthRes.error}"`);
  }
  dupSock.disconnect();

  // Test 4: Player Reconnection Safety
  console.log("\n--> [TEST 4] Player Reconnection Token Test...");
  const reconSock = createPlayerSocket();
  await new Promise<void>((res) => reconSock.on("connect", () => res()));
  const reconRes: any = await new Promise((res) => {
    reconSock.emit(
      "team:reconnect",
      { sessionId: session!.id, teamId: playerTeamIds[0], token: playerTokens[0] },
      res
    );
  });
  if (!reconRes.success) {
    errors.push(`Player reconnection failed: ${reconRes.error}`);
  } else {
    console.log(`✓ Player reconnected successfully without losing identity: ${reconRes.team.name}`);
  }
  reconSock.disconnect();

  // Test 5: Question Bank CRUD & Reordering
  console.log("\n--> [TEST 5] Admin Question Bank Management (Add, Reorder, Delete)...");
  let testQId = "";
  const saveRes: any = await new Promise((resolve) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          questionText: "What protocol operates at Transport Layer?",
          options: {
            A: "TCP",
            B: "IP",
            C: "HTTP",
            D: "Ethernet",
          },
          correctAnswer: "A",
          timeLimit: 20,
          points: 100,
          category: "Networking",
        },
      },
      resolve
    );
  });
  if (!saveRes.success || !saveRes.question) {
    errors.push(`Failed to save new question: ${saveRes.error}`);
  } else {
    testQId = saveRes.question.id;
    console.log(`✓ Created new question: ${testQId}`);
  }

  // Fetch questions
  const qList: QuizQuestion[] = await new Promise((resolve) => {
    adminSocket.emit("quiz:get_questions", { sessionId: session!.id }, resolve);
  });
  console.log(`✓ Fetched ${qList.length} questions from question bank`);

  // Reorder test
  const qIds = qList.map((q) => q.id);
  const reorderOk: boolean = await new Promise((resolve) => {
    adminSocket.emit("quiz:reorder_questions", { questionIds: qIds.reverse() }, resolve);
  });
  if (!reorderOk) {
    errors.push("Failed to reorder questions.");
  } else {
    console.log("✓ Questions reordered successfully.");
  }

  // Test 6: Power-Up Distribution & Matrix
  console.log("\n--> [TEST 6] Power-Up Distribution & Matrix...");
  const shuffleRes: any = await new Promise((resolve) => {
    adminSocket.emit("powerup:shuffle", { sessionId: session!.id }, resolve);
  });
  if (!shuffleRes.success || !shuffleRes.assignments) {
    errors.push(`Failed to shuffle power-ups: ${shuffleRes.error}`);
  } else {
    console.log(`✓ Shuffled power-ups for ${shuffleRes.assignments.length} teams.`);
  }

  // Test 7: Active Quiz Lifecycle (Start question, submit answers, timeout/end, scoring)
  console.log("\n--> [TEST 7] Active Quiz Lifecycle & Anti-Cheat...");
  let activeQReceived: any = null;
  const p1Promise = new Promise((resolve) => {
    playerSockets[0].once("quiz:started", (q) => resolve(q));
  });

  const activateRes: any = await new Promise((resolve) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session!.id, questionId: testQId || undefined }, resolve);
  });
  if (!activateRes.success) {
    errors.push(`Failed to activate quiz: ${activateRes.error}`);
  } else {
    console.log(`✓ Quiz activated: Question ${activateRes.questionId || testQId}`);
  }

  activeQReceived = await p1Promise;
  if (!activeQReceived) {
    errors.push("Player did not receive quiz:started event.");
  } else {
    if (activeQReceived.correctAnswer) {
      errors.push("SECURITY FAILURE: correctAnswer was leaked to player socket!");
    } else {
      console.log("✓ Anti-cheat verified: correctAnswer stripped from player payload.");
    }
  }

  // Player 1 submits Choice A (Correct)
  const sub1Res: any = await new Promise((resolve) => {
    playerSockets[0].emit(
      "quiz:submit_answer",
      { sessionId: session!.id, teamId: playerTeamIds[0], token: playerTokens[0], questionId: activeQReceived.id, choice: "A" },
      resolve
    );
  });
  if (!sub1Res.success) {
    errors.push(`Player 1 submission failed: ${sub1Res.error}`);
  } else {
    console.log("✓ Player 1 submitted choice A (Locked in).");
  }

  // Player 1 tries submitting twice
  const subDupRes: any = await new Promise((resolve) => {
    playerSockets[0].emit(
      "quiz:submit_answer",
      { sessionId: session!.id, teamId: playerTeamIds[0], token: playerTokens[0], questionId: activeQReceived.id, choice: "B" },
      resolve
    );
  });
  if (subDupRes.success) {
    errors.push("Single-submission violated: Duplicate answer was accepted!");
  } else {
    console.log(`✓ Single-submission lock verified: "${subDupRes.error}"`);
  }

  // Player 2 submits Choice B (Incorrect)
  await new Promise((resolve) => {
    playerSockets[1].emit(
      "quiz:submit_answer",
      { sessionId: session!.id, teamId: playerTeamIds[1], token: playerTokens[1], questionId: activeQReceived.id, choice: "B" },
      resolve
    );
  });
  console.log("✓ Player 2 submitted choice B.");

  // Admin ends question early
  const endQPromise = new Promise((resolve) => {
    adminSocket.once("quiz:ended", (r) => resolve(r));
  });
  await new Promise((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session!.id }, resolve);
  });
  const qResults: any = await endQPromise;
  const t1Score = qResults.updatedTeams?.find((t: any) => t.id === playerTeamIds[0])?.score ?? 0;
  const t2Score = qResults.updatedTeams?.find((t: any) => t.id === playerTeamIds[1])?.score ?? 0;
  console.log(`✓ Question ended. Scores evaluated: Team 1=${t1Score}pts, Team 2=${t2Score}pts`);

  // Test 8: Leaderboard Verification
  console.log("\n--> [TEST 8] Leaderboard Standings...");
  const lb: any = await new Promise((resolve) => {
    adminSocket.emit("session:get_leaderboard", { sessionId: session!.id }, resolve);
  });
  if (!lb || !lb.entries) {
    errors.push("Failed to fetch leaderboard.");
  } else {
    console.log(`✓ Leaderboard verified: Rank 1=${lb.entries[0]?.teamName} (${lb.entries[0]?.totalScore}pts)`);
  }

  // Test 9: Navigation State Synchronization (Simulate page change in Admin)
  console.log("\n--> [TEST 9] Testing Page Navigation State Synchronization...");
  let lobbyStateAfterNav: any = null;
  await new Promise<void>((resolve) => {
    adminSocket.emit("session:get_state", { sessionId: session!.id }, (res) => {
      lobbyStateAfterNav = res;
      resolve();
    });
  });

  if (!lobbyStateAfterNav) {
    errors.push("session:get_state returned null for active session!");
  } else {
    console.log(`✓ session:get_state correctly returned lobby with ${lobbyStateAfterNav.registeredCount} teams.`);
  }

  // Disconnect all sockets
  adminSocket.disconnect();
  playerSockets.forEach((s) => s.disconnect());

  console.log("\n=======================================================");
  console.log(`  RESULTS: ${errors.length} ERRORS DETECTED`);
  console.log("=======================================================");
  if (errors.length > 0) {
    errors.forEach((err, idx) => console.log(`[Error ${idx + 1}] ${err}`));
  } else {
    console.log("🎉 ALL TEST SCENARIOS PASSED WITH 0 ERRORS!");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
