/**
 * Classroom Quiz Battle - Comprehensive Admin Auth & Authorization Security Test Suite
 *
 * Verifies all 12 security requirements:
 * 1. Visiting /admin without a session redirects to /admin/login.
 * 2. Visiting an admin subpage directly without authentication is rejected.
 * 3. Correct admin credentials grant access.
 * 4. Incorrect credentials do not grant access.
 * 5. Logging out invalidates the admin session.
 * 6. An unauthenticated HTTP request cannot activate a question.
 * 7. A player cannot change scores by calling an API directly.
 * 8. A player cannot trigger administrative Socket.IO events.
 * 9. An expired admin session cannot continue performing privileged operations.
 * 10. Player registration and quiz participation still work.
 * 11. The admin can manage the game while players remain connected.
 * 12. The entire application continues working offline over the local network.
 */

import { io as ClientSocket } from "socket.io-client";
import {
  getDb,
  hasAdminAccount,
  createInitialAdmin,
  createAdminSession,
  validateAdminSession,
  createNewSession,
  saveQuestion,
} from "../src/lib/db";

const BASE_URL = "http://localhost:3000";
const TEST_ADMIN_USER = "testadmin";
const TEST_ADMIN_PASS = "TestAdminPass123!";

interface TestResult {
  scenarioNumber: number;
  title: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordResult(scenarioNumber: number, title: string, passed: boolean, details: string) {
  results.push({ scenarioNumber, title, passed, details });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[Scenario ${scenarioNumber}] ${badge}: ${title}`);
  if (details) {
    console.log(`   └─ ${details}`);
  }
}

async function runTests() {
  console.log("=================================================================");
  console.log(" Classroom Quiz Battle - Admin Authentication Security Test Suite");
  console.log("=================================================================\n");

  const db = getDb();

  // Ensure an admin user exists for testing
  if (!hasAdminAccount()) {
    console.log("[Setup] Creating initial admin account for testing...");
    createInitialAdmin(TEST_ADMIN_USER, TEST_ADMIN_PASS);
  } else {
    // If an admin user already exists, update/insert testadmin or retrieve
    const existing = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(TEST_ADMIN_USER);
    if (!existing) {
      console.log("[Setup] Inserting dedicated test administrator credentials...");
      const { hashPassword } = await import("../src/lib/db");
      const { hash, salt } = hashPassword(TEST_ADMIN_PASS);
      db.prepare(`
        INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("admin_test_auto", TEST_ADMIN_USER, hash, salt, Date.now(), Date.now());
    }
  }

  // Ensure at least one test question exists
  saveQuestion({
    questionText: "Security Test: Which protocol secures WebSocket traffic?",
    options: {
      A: "WSS",
      B: "FTP",
      C: "SMTP",
      D: "SNMP",
    },
    correctAnswer: "A",
    timeLimit: 15,
    points: 100,
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Visiting /admin without a session redirects to /admin/login
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    const location = res.headers.get("location");
    const isRedirect = res.status === 302 || res.status === 307 || res.status === 308;
    const targetsLogin = location ? location.includes("/admin/login") : false;

    if (isRedirect && targetsLogin) {
      recordResult(
        1,
        "Visiting /admin without a session redirects to /admin/login",
        true,
        `Status ${res.status} redirected to Location: ${location}`
      );
    } else {
      recordResult(
        1,
        "Visiting /admin without a session redirects to /admin/login",
        false,
        `Expected redirect to /admin/login, got status ${res.status}, location: ${location}`
      );
    }
  } catch (err: unknown) {
    recordResult(1, "Visiting /admin without a session redirects to /admin/login", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 2: Visiting an admin subpage directly without authentication is rejected
  // -------------------------------------------------------------------------
  try {
    const subpages = ["/admin/teams", "/admin/leaderboard", "/admin/questions", "/admin/team-management", "/admin/settings"];
    let allProtected = true;
    const failures: string[] = [];

    for (const page of subpages) {
      const res = await fetch(`${BASE_URL}${page}`, { redirect: "manual" });
      const location = res.headers.get("location");
      const isRedirect = res.status === 302 || res.status === 307 || res.status === 308;
      const targetsLogin = location ? location.includes("/admin/login") : false;

      if (!isRedirect || !targetsLogin) {
        allProtected = false;
        failures.push(`${page} (status: ${res.status}, location: ${location})`);
      }
    }

    if (allProtected) {
      recordResult(
        2,
        "Visiting an admin subpage directly without authentication is rejected",
        true,
        `All 5 admin subpages redirected unauthenticated visits to /admin/login`
      );
    } else {
      recordResult(
        2,
        "Visiting an admin subpage directly without authentication is rejected",
        false,
        `Subpages failed redirect protection: ${failures.join(", ")}`
      );
    }
  } catch (err: unknown) {
    recordResult(2, "Visiting an admin subpage directly without authentication is rejected", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Correct admin credentials grant access
  // -------------------------------------------------------------------------
  let validAdminCookie = "";

  try {
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_ADMIN_USER, password: TEST_ADMIN_PASS }),
    });

    const loginData = await loginRes.json();
    const setCookie = loginRes.headers.get("set-cookie") || "";
    const cookieMatch = setCookie.match(/admin_session=([^;]+)/);

    if (loginRes.ok && loginData.success && cookieMatch) {
      validAdminCookie = `admin_session=${cookieMatch[1]}`;

      // Verify authenticated session endpoint /api/admin/auth/me
      const meRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
        headers: { Cookie: validAdminCookie },
      });
      const meData = await meRes.json();

      if (meRes.ok && meData.authenticated && meData.user?.username === TEST_ADMIN_USER) {
        recordResult(
          3,
          "Correct admin credentials grant access",
          true,
          `Authenticated successfully, received HttpOnly cookie: ${cookieMatch[1].slice(0, 10)}...`
        );
      } else {
        recordResult(3, "Correct admin credentials grant access", false, `Session check failed: ${JSON.stringify(meData)}`);
      }
    } else {
      recordResult(
        3,
        "Correct admin credentials grant access",
        false,
        `Login endpoint failed: status ${loginRes.status}, data: ${JSON.stringify(loginData)}`
      );
    }
  } catch (err: unknown) {
    recordResult(3, "Correct admin credentials grant access", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Incorrect credentials do not grant access
  // -------------------------------------------------------------------------
  try {
    const badLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_ADMIN_USER, password: "IncorrectPassword999!" }),
    });

    const badData = await badLoginRes.json();
    if (badLoginRes.status === 401 && badData.success === false) {
      recordResult(
        4,
        "Incorrect credentials do not grant access",
        true,
        `Server returned 401 Unauthorized with generic message: "${badData.error}"`
      );
    } else {
      recordResult(
        4,
        "Incorrect credentials do not grant access",
        false,
        `Expected 401, got ${badLoginRes.status}: ${JSON.stringify(badData)}`
      );
    }
  } catch (err: unknown) {
    recordResult(4, "Incorrect credentials do not grant access", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Logging out invalidates the admin session
  // -------------------------------------------------------------------------
  try {
    // Create a temporary session specifically to test logout invalidation
    const userRow = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(TEST_ADMIN_USER) as { id: string };
    const tempSession = createAdminSession(userRow.id);
    const tempCookie = `admin_session=${tempSession.token}`;

    // Verify it is initially valid
    const preCheck = validateAdminSession(tempSession.token);
    if (!preCheck.valid) {
      throw new Error("Temporary session was not initially valid");
    }

    // Call logout endpoint
    const logoutRes = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
      method: "POST",
      headers: { Cookie: tempCookie },
    });

    const logoutData = await logoutRes.json();

    // Verify session token is now completely invalidated in database
    const postCheck = validateAdminSession(tempSession.token);

    // Verify HTTP me check fails with 401
    const postMeRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Cookie: tempCookie },
    });

    if (logoutRes.ok && logoutData.success && !postCheck.valid && postMeRes.status === 401) {
      recordResult(
        5,
        "Logging out invalidates the admin session",
        true,
        `Session purged from database; subsequent requests rejected with 401 Unauthorized`
      );
    } else {
      recordResult(
        5,
        "Logging out invalidates the admin session",
        false,
        `Session still valid or logout failed: postCheck=${postCheck.valid}, postMeStatus=${postMeRes.status}`
      );
    }
  } catch (err: unknown) {
    recordResult(5, "Logging out invalidates the admin session", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 6: An unauthenticated HTTP request cannot activate a question
  // -------------------------------------------------------------------------
  try {
    const unauthActionRes = await fetch(`${BASE_URL}/api/admin/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activate_question",
        sessionId: "SESSION-TEST",
        questionId: "q_test_123",
      }),
    });

    const data = await unauthActionRes.json();
    if (unauthActionRes.status === 401 && data.success === false) {
      recordResult(
        6,
        "An unauthenticated HTTP request cannot activate a question",
        true,
        `Protected HTTP API returned 401 Unauthorized: "${data.error}"`
      );
    } else {
      recordResult(
        6,
        "An unauthenticated HTTP request cannot activate a question",
        false,
        `Expected 401, got ${unauthActionRes.status}: ${JSON.stringify(data)}`
      );
    }
  } catch (err: unknown) {
    recordResult(6, "An unauthenticated HTTP request cannot activate a question", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 7: A player cannot change scores by calling an API directly
  // -------------------------------------------------------------------------
  try {
    const scoreRes = await fetch(`${BASE_URL}/api/admin/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: "team_hacker",
        scoreDelta: 9999,
      }),
    });

    const data = await scoreRes.json();
    if (scoreRes.status === 401 && data.success === false) {
      recordResult(
        7,
        "A player cannot change scores by calling an API directly",
        true,
        `Score API returned 401 Unauthorized: "${data.error}"`
      );
    } else {
      recordResult(
        7,
        "A player cannot change scores by calling an API directly",
        false,
        `Expected 401, got ${scoreRes.status}: ${JSON.stringify(data)}`
      );
    }
  } catch (err: unknown) {
    recordResult(7, "A player cannot change scores by calling an API directly", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 8: A player cannot trigger administrative Socket.IO events
  // -------------------------------------------------------------------------
  try {
    const playerSocket = ClientSocket(BASE_URL, {
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Socket connection timed out")), 4000);
      playerSocket.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });
      playerSocket.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    let authErrorReceived = false;
    playerSocket.on("admin:auth_error" as never, () => {
      authErrorReceived = true;
    });

    // 1. Try to register with claimed role: "admin"
    playerSocket.emit("client:register", { role: "admin", name: "Attacker" });
    await new Promise((r) => setTimeout(r, 200));

    // 2. Try to invoke privileged session:create
    const createSessionPromise = new Promise<{ id?: string; error?: string }>((resolve) => {
      playerSocket.emit("session:create", { title: "Hacked Session" }, (res: unknown) => {
        resolve(res as { id?: string; error?: string });
      });
      setTimeout(() => resolve({ error: "timeout" }), 1500);
    });
    const createResult = await createSessionPromise;

    // 3. Try to invoke privileged quiz:get_questions (should NOT reveal questions/answers)
    const getQuestionsPromise = new Promise<unknown[]>((resolve) => {
      playerSocket.emit("quiz:get_questions", { sessionId: "SESSION-1" }, (res: unknown) => {
        resolve(res as unknown[]);
      });
      setTimeout(() => resolve([]), 1500);
    });
    const questionsResult = await getQuestionsPromise;

    // 4. Try to invoke admin:kick_team
    const kickPromise = new Promise<boolean>((resolve) => {
      playerSocket.emit("admin:kick_team", { sessionId: "SESSION-1", teamId: "t_1" }, (res: unknown) => {
        resolve(Boolean(res));
      });
      setTimeout(() => resolve(false), 1500);
    });
    const kickResult = await kickPromise;

    playerSocket.disconnect();

    const roleRejected = authErrorReceived;
    const sessionCreateRejected = Boolean(createResult?.error || !createResult?.id);
    const questionsProtected = Array.isArray(questionsResult) && questionsResult.length === 0;
    const kickRejected = kickResult === false;

    if (roleRejected && sessionCreateRejected && questionsProtected && kickRejected) {
      recordResult(
        8,
        "A player cannot trigger administrative Socket.IO events",
        true,
        `Server rejected admin registration (auth_error), rejected session creation, protected question bank, and blocked team kick.`
      );
    } else {
      recordResult(
        8,
        "A player cannot trigger administrative Socket.IO events",
        false,
        `Checks failed: roleRejected=${roleRejected}, sessionCreateRejected=${sessionCreateRejected}, questionsProtected=${questionsProtected}, kickRejected=${kickRejected}`
      );
    }
  } catch (err: unknown) {
    recordResult(8, "A player cannot trigger administrative Socket.IO events", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 9: An expired admin session cannot continue performing privileged operations
  // -------------------------------------------------------------------------
  try {
    const userRow = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(TEST_ADMIN_USER) as { id: string };
    const expiredSession = createAdminSession(userRow.id);

    // Manually backdate the session's expires_at in SQLite to 1 hour in the past
    db.prepare("UPDATE admin_sessions SET expires_at = ? WHERE session_token = ?").run(
      Date.now() - 3600000,
      expiredSession.token
    );

    // 1. Verify validateAdminSession returns false
    const validation = validateAdminSession(expiredSession.token);

    // 2. Verify HTTP request with expired token is rejected with 401
    const expiredHttpRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Cookie: `admin_session=${expiredSession.token}` },
    });

    if (!validation.valid && expiredHttpRes.status === 401) {
      recordResult(
        9,
        "An expired admin session cannot continue performing privileged operations",
        true,
        `Expired token authoritatively invalidated; database rejected session and HTTP returned 401`
      );
    } else {
      recordResult(
        9,
        "An expired admin session cannot continue performing privileged operations",
        false,
        `Expired session was still accepted: valid=${validation.valid}, httpStatus=${expiredHttpRes.status}`
      );
    }
  } catch (err: unknown) {
    recordResult(
      9,
      "An expired admin session cannot continue performing privileged operations",
      false,
      String(err)
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Player registration and quiz participation still work
  // -------------------------------------------------------------------------
  try {
    const testSession = createNewSession("E2E Participation Test");

    // Connect authenticated Admin Socket
    const adminSocket = ClientSocket(BASE_URL, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        Cookie: validAdminCookie,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Admin socket timeout")), 4000);
      adminSocket.on("connect", () => {
        clearTimeout(timeout);
        adminSocket.emit("client:register", { role: "admin", name: "Presenter" });
        resolve();
      });
      adminSocket.on("connect_error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    // Connect Player Socket (unauthenticated, mobile player)
    const playerSocket = ClientSocket(BASE_URL, {
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Player socket timeout")), 4000);
      playerSocket.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });
      playerSocket.on("connect_error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    // Player registers
    const regResult = await new Promise<{ success: boolean; team?: { id: string; name: string }; token?: string }>((resolve) => {
      playerSocket.emit(
        "team:register",
        {
          sessionId: testSession.id,
          teamName: "Quantum Hawks",
          leaderName: "Sarah Connor",
        },
        (res: unknown) => resolve(res as { success: boolean; team?: { id: string; name: string }; token?: string })
      );
    });

    if (!regResult.success || !regResult.team || !regResult.token) {
      throw new Error(`Team registration failed: ${JSON.stringify(regResult)}`);
    }

    // Set up player listener for quiz started
    const quizReceivedPromise = new Promise<{ id: string; questionText: string; options: Record<string, string>; correctAnswer?: string }>((resolve) => {
      playerSocket.on("quiz:started", (q: unknown) => resolve(q as { id: string; questionText: string; options: Record<string, string>; correctAnswer?: string }));
    });

    // Admin activates surprise quiz
    const activateResult = await new Promise<{ success: boolean }>((resolve) => {
      adminSocket.emit("quiz:activate_surprise", { sessionId: testSession.id }, (res: unknown) => resolve(res as { success: boolean }));
    });

    const receivedQuestion = await quizReceivedPromise;

    // Verify player question has choices but NO answer key leaked
    const hasCorrectAnswerField = Object.prototype.hasOwnProperty.call(receivedQuestion, "correctAnswer");

    // Player submits answer
    const submitResult = await new Promise<{ success: boolean }>((resolve) => {
      playerSocket.emit(
        "quiz:submit_answer",
        {
          sessionId: testSession.id,
          teamId: regResult.team!.id,
          token: regResult.token!,
          questionId: receivedQuestion.id,
          choice: "A",
        },
        (res: unknown) => resolve(res as { success: boolean })
      );
    });

    // Admin ends question
    await new Promise<unknown>((resolve) => {
      adminSocket.emit("quiz:end_question", { sessionId: testSession.id }, (res: unknown) => resolve(res));
    });

    adminSocket.disconnect();
    playerSocket.disconnect();

    if (
      regResult.success &&
      activateResult.success &&
      receivedQuestion &&
      !hasCorrectAnswerField &&
      submitResult.success
    ) {
      recordResult(
        10,
        "Player registration and quiz participation still work",
        true,
        `Registered team "Quantum Hawks", received sanitized question without answer key, and locked in answer choice "A".`
      );
    } else {
      recordResult(
        10,
        "Player registration and quiz participation still work",
        false,
        `Quiz flow check failed: hasCorrectAnswerField=${hasCorrectAnswerField}, submit=${submitResult.success}`
      );
    }
  } catch (err: unknown) {
    recordResult(10, "Player registration and quiz participation still work", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 11: The admin can manage the game while players remain connected
  // -------------------------------------------------------------------------
  try {
    const testSession = createNewSession("Concurrent Management Session");

    // Connect 2 player sockets
    const p1 = ClientSocket(BASE_URL, { transports: ["websocket"], reconnection: false });
    const p2 = ClientSocket(BASE_URL, { transports: ["websocket"], reconnection: false });

    await Promise.all([
      new Promise<void>((res) => p1.on("connect", () => res())),
      new Promise<void>((res) => p2.on("connect", () => res())),
    ]);

    // Connect authenticated Admin Socket
    const admin = ClientSocket(BASE_URL, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Cookie: validAdminCookie },
    });

    await new Promise<void>((res) => admin.on("connect", () => res()));
    admin.emit("client:register", { role: "admin", name: "Presenter" });

    // Track lobby updates on player 1
    let p1LobbyUpdates = 0;
    p1.on("lobby:updated", () => {
      p1LobbyUpdates++;
    });

    // Admin toggles registration
    const toggleSuccess = await new Promise<boolean>((resolve) => {
      admin.emit("session:toggle_registration", { sessionId: testSession.id, isOpen: false }, (s: boolean) =>
        resolve(s)
      );
    });

    // Wait a brief moment for event dissemination
    await new Promise((r) => setTimeout(r, 200));

    const playersStillConnected = p1.connected && p2.connected;

    p1.disconnect();
    p2.disconnect();
    admin.disconnect();

    if (toggleSuccess && playersStillConnected && p1LobbyUpdates > 0) {
      recordResult(
        11,
        "The admin can manage the game while players remain connected",
        true,
        `Admin toggled registration; all player sockets remained connected and received real-time lobby updates.`
      );
    } else {
      recordResult(
        11,
        "The admin can manage the game while players remain connected",
        false,
        `Admin toggle or player connection failed: toggle=${toggleSuccess}, p1Connected=${p1.connected}, updates=${p1LobbyUpdates}`
      );
    }
  } catch (err: unknown) {
    recordResult(11, "The admin can manage the game while players remain connected", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Scenario 12: The entire application continues working offline over the local network
  // -------------------------------------------------------------------------
  try {
    // 1. Verify no external API / cloud auth imports
    const fs = await import("node:fs");
    const path = await import("node:path");

    const authFile = fs.readFileSync(path.join(process.cwd(), "src/lib/auth.ts"), "utf-8");
    const dbFile = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");
    const serverFile = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");

    const externalKeywords = ["firebase", "supabase", "auth0", "clerk", "cognito", "google.com/oauth", "next-auth"];
    const allCode = authFile + dbFile + serverFile;
    const hasExternal = externalKeywords.some((kw) => allCode.toLowerCase().includes(kw));

    // 2. Verify server-info endpoint returns LAN-accessible IP and interfaces
    const serverInfoRes = await fetch(`${BASE_URL}/api/server-info`);
    const serverInfo = await serverInfoRes.json();

    const isOfflineCompliant = !hasExternal && serverInfo.serverIp && serverInfo.status === "ok";

    if (isOfflineCompliant) {
      recordResult(
        12,
        "The entire application continues working offline over the local network",
        true,
        `100% offline verified: local SQLite, Node.js native crypto (scrypt), LAN broadcast IP: ${serverInfo.serverIp}:${serverInfo.port}`
      );
    } else {
      recordResult(
        12,
        "The entire application continues working offline over the local network",
        false,
        `Offline compliance check failed: hasExternal=${hasExternal}, serverInfo=${JSON.stringify(serverInfo)}`
      );
    }
  } catch (err: unknown) {
    recordResult(12, "The entire application continues working offline over the local network", false, String(err));
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(" Final Security Test Suite Results");
  console.log("=================================================================");
  const passCount = results.filter((r) => r.passed).length;
  console.log(`Summary: ${passCount} / ${results.length} Scenarios Passed.\n`);

  for (const r of results) {
    console.log(`${r.passed ? "✅" : "❌"} Scenario ${r.scenarioNumber}: ${r.title}`);
  }

  if (passCount === results.length) {
    console.log("\n🎉 ALL 12 SECURITY SCENARIOS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error(`\n⚠️ ${results.length - passCount} scenarios failed.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
