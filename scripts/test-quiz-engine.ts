import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamRegisterResponse,
  TeamReconnectResponse,
  ClientQuizQuestion,
  QuestionResultsPayload,
  QuizSubmitResponse,
  QuizQuestion,
} from "../src/types/socket";
import type { GameSession } from "../src/lib/db";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function runQuizEngineTests() {
  console.log("\n=======================================================");
  console.log("  🧪 RUNNING REAL-TIME QUIZ ENGINE AUTOMATED TEST SUITE");
  console.log("=======================================================\n");

  const serverUrl = "http://127.0.0.1:3000";

  // 1. Admin Session Setup
  console.log("--> Testing 1: Admin Connection & New Session Setup...");
  const adminCookie = getTestAdminCookie();
  const adminSocket: TypedSocket = io(serverUrl, {
    transports: ["polling", "websocket"],
    extraHeaders: {
      Cookie: adminCookie,
    },
  });
  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("client:register", { role: "admin", name: "Quiz Master" });

  const session = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Automated Quiz Engine Test" }, (newSession: GameSession) => {
      resolve(newSession);
    });
  });
  console.log(`✓ Admin session established: ${session.id} ("${session.title}")`);

  // 2. Question Bank Verification & Custom Question Creation
  console.log("\n--> Testing 2: Question Management & CRUD...");
  const initialQuestions = await new Promise<QuizQuestion[]>((resolve) => {
    adminSocket.emit("quiz:get_questions", { sessionId: session.id }, (qs) => resolve(qs));
  });
  console.log(`✓ Loaded pre-seeded question bank: ${initialQuestions.length} questions available`);

  // Save a short test question with a 3-second timer for expiration testing
  const customQuestion = await new Promise<QuizQuestion>((resolve, reject) => {
    adminSocket.emit(
      "quiz:save_question",
      {
        question: {
          sessionId: session.id,
          questionText: "What protocol operates at the Transport Layer of the OSI Model?",
          options: {
            A: "IP",
            B: "TCP",
            C: "HTTP",
            D: "Ethernet",
          },
          correctAnswer: "B",
          timeLimit: 6, // 6 seconds for testing
          points: 100,
        },
      },
      (res) => {
        if (res.success && res.question) resolve(res.question);
        else reject(new Error(res.error || "Failed to save question"));
      }
    );
  });
  console.log(`✓ Custom question saved: "${customQuestion.questionText}" (ID: ${customQuestion.id}, Answer: [${customQuestion.correctAnswer}])`);

  // 3. Register Two Competing Teams
  console.log("\n--> Testing 3: Registering Competing Teams...");
  const player1Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => player1Socket.on("connect", () => resolve()));
  const p1Reg = await new Promise<TeamRegisterResponse>((resolve) => {
    player1Socket.emit(
      "team:register",
      { sessionId: session.id, teamName: "Alpha Solvers", leaderName: "Ada" },
      (res) => resolve(res)
    );
  });
  if (!p1Reg.success || !p1Reg.team || !p1Reg.token) throw new Error("Team 1 registration failed");
  console.log(`✓ Team 1 registered: "${p1Reg.team.name}" (Slot ${p1Reg.team.slotNumber})`);

  const player2Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => player2Socket.on("connect", () => resolve()));
  const p2Reg = await new Promise<TeamRegisterResponse>((resolve) => {
    player2Socket.emit(
      "team:register",
      { sessionId: session.id, teamName: "Beta Coders", leaderName: "Babbage" },
      (res) => resolve(res)
    );
  });
  if (!p2Reg.success || !p2Reg.team || !p2Reg.token) throw new Error("Team 2 registration failed");
  console.log(`✓ Team 2 registered: "${p2Reg.team.name}" (Slot ${p2Reg.team.slotNumber})`);

  // 4. Activate Surprise Quiz & Verify Zero-Cheat Question Packet
  console.log("\n--> Testing 4: Activating Surprise Quiz & Anti-Cheat Validation...");
  const quizStartedPromiseP1 = new Promise<ClientQuizQuestion>((resolve) => {
    player1Socket.on("quiz:started", (q) => resolve(q));
  });

  const activateRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    adminSocket.emit("quiz:activate_surprise", { sessionId: session.id, questionId: customQuestion.id }, (res) =>
      resolve(res || { success: true })
    );
  });
  if (!activateRes.success) throw new Error(`Failed to activate surprise quiz: ${activateRes.error}`);

  const clientQ = await quizStartedPromiseP1;
  console.log(`✓ Surprise quiz broadcast received by Team 1: "${clientQ.questionText}"`);

  // Verify that the correct answer is NEVER present in the client question packet
  if ("correctAnswer" in clientQ || "correct_answer" in clientQ) {
    throw new Error("SECURITY BREACH: Server sent correct answer to player before question closed!");
  }
  console.log("✓ Anti-Cheat Guarantee verified: Client question packet contains NO correctAnswer property");

  // 5. Simultaneous Submissions from Multiple Teams
  console.log("\n--> Testing 5: Simultaneous Submissions from Multiple Teams...");
  const [sub1, sub2] = await Promise.all([
    new Promise<QuizSubmitResponse>((resolve) => {
      player1Socket.emit(
        "quiz:submit_answer",
        {
          sessionId: session.id,
          teamId: p1Reg.team!.id,
          token: p1Reg.token!,
          questionId: clientQ.id,
          choice: "B", // Correct answer
        },
        (res) => resolve(res)
      );
    }),
    new Promise<QuizSubmitResponse>((resolve) => {
      player2Socket.emit(
        "quiz:submit_answer",
        {
          sessionId: session.id,
          teamId: p2Reg.team!.id,
          token: p2Reg.token!,
          questionId: clientQ.id,
          choice: "A", // Incorrect answer
        },
        (res) => resolve(res)
      );
    }),
  ]);

  if (!sub1.success || sub1.selectedChoice !== "B") {
    throw new Error(`Team 1 submission failed: ${sub1.error}`);
  }
  console.log(`✓ Team 1 successfully submitted choice [${sub1.selectedChoice}]`);

  if (!sub2.success || sub2.selectedChoice !== "A") {
    throw new Error(`Team 2 submission failed: ${sub2.error}`);
  }
  console.log(`✓ Team 2 successfully submitted choice [${sub2.selectedChoice}]`);

  // 6. Prevent Duplicate Submissions for the Same Question
  console.log("\n--> Testing 6: Rejecting Duplicate Answer Submission...");
  const dupSub = await new Promise<QuizSubmitResponse>((resolve) => {
    player1Socket.emit(
      "quiz:submit_answer",
      {
        sessionId: session.id,
        teamId: p1Reg.team!.id,
        token: p1Reg.token!,
        questionId: clientQ.id,
        choice: "C", // Attempt to change answer
      },
      (res) => resolve(res)
    );
  });

  if (dupSub.success) {
    throw new Error("Server allowed duplicate answer submission from Team 1!");
  }
  console.log(`✓ Duplicate submission correctly rejected: "${dupSub.error}"`);

  // 7. Reject Invalid Answer Choices
  console.log("\n--> Testing 7: Rejecting Invalid Choice Format...");
  const invalidSub = await new Promise<QuizSubmitResponse>((resolve) => {
    player1Socket.emit(
      "quiz:submit_answer",
      {
        sessionId: session.id,
        teamId: p1Reg.team!.id,
        token: p1Reg.token!,
        questionId: clientQ.id,
        choice: "Z" as unknown as "A",
      },
      (res) => resolve(res)
    );
  });
  if (invalidSub.success) {
    throw new Error("Server accepted invalid choice 'Z'!");
  }
  console.log(`✓ Invalid choice rejected: "${invalidSub.error}"`);

  // 8. Reconnecting During Active Quiz (Browser Refresh Simulation)
  console.log("\n--> Testing 8: Browser Refresh During Active Quiz...");
  player1Socket.disconnect();
  console.log("✓ Player 1 refreshed page (disconnected)...");

  const reloadedPlayer1: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => reloadedPlayer1.on("connect", () => resolve()));

  const reconnectRes = await new Promise<TeamReconnectResponse>((resolve) => {
    reloadedPlayer1.emit(
      "team:reconnect",
      {
        sessionId: session.id,
        teamId: p1Reg.team!.id,
        token: p1Reg.token!,
      },
      (res) => resolve(res)
    );
  });

  if (!reconnectRes.success || !reconnectRes.team) {
    throw new Error(`Reconnection failed: ${reconnectRes.error}`);
  }
  if (!reconnectRes.hasSubmitted || reconnectRes.submittedChoice !== "B") {
    throw new Error("Reconnection failed to preserve locked-in submission choice [B]!");
  }
  console.log(`✓ Player 1 reconnected: Locked-in choice [${reconnectRes.submittedChoice}] safely restored without resubmission`);

  // 9. Admin Early Close / Question Termination & Score Evaluation
  console.log("\n--> Testing 9: Question Termination & Score Broadcast...");
  const quizEndedPromise = new Promise<QuestionResultsPayload>((resolve) => {
    reloadedPlayer1.on("quiz:ended", (res) => resolve(res));
  });

  // End active question early via Admin
  await new Promise<void>((resolve) => {
    adminSocket.emit("quiz:end_question", { sessionId: session.id }, () => resolve());
  });

  const results = await quizEndedPromise;
  console.log(`✓ Quiz results received: Correct Answer was [${results.correctAnswer}]`);

  const t1Result = results.submissions.find((s) => s.teamId === p1Reg.team!.id);
  const t2Result = results.submissions.find((s) => s.teamId === p2Reg.team!.id);

  if (!t1Result || !t1Result.isCorrect || t1Result.pointsAwarded !== 100) {
    throw new Error("Team 1 score calculation incorrect (expected +100 points)");
  }
  console.log(`✓ Team 1 scored: +${t1Result.pointsAwarded} pts (Correct: ${t1Result.isCorrect})`);

  if (!t2Result || t2Result.isCorrect || t2Result.pointsAwarded !== 0) {
    throw new Error("Team 2 score calculation incorrect (expected +0 points)");
  }
  console.log(`✓ Team 2 scored: +${t2Result.pointsAwarded} pts (Correct: ${t2Result.isCorrect})`);

  // 10. Late Submission Rejection after Question Closes
  console.log("\n--> Testing 10: Rejecting Late Submission on Closed Question...");
  const lateSub = await new Promise<QuizSubmitResponse>((resolve) => {
    player2Socket.emit(
      "quiz:submit_answer",
      {
        sessionId: session.id,
        teamId: p2Reg.team!.id,
        token: p2Reg.token!,
        questionId: clientQ.id,
        choice: "B",
      },
      (res) => resolve(res)
    );
  });

  if (lateSub.success) {
    throw new Error("Server accepted late submission on a closed quiz question!");
  }
  console.log(`✓ Late submission correctly rejected: "${lateSub.error}"`);

  // Clean up sockets
  adminSocket.disconnect();
  player2Socket.disconnect();
  reloadedPlayer1.disconnect();

  console.log("\n=======================================================");
  console.log("  🎉 ALL 10 REAL-TIME QUIZ ENGINE TESTS PASSED!");
  console.log("=======================================================\n");
  process.exit(0);
}

runQuizEngineTests().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Test failure:", msg);
  process.exit(1);
});
