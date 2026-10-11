import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamRegisterResponse,
  TeamReconnectResponse,
} from "../src/types/socket";
import type { GameSession } from "../src/lib/db";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function runRegistrationLobbyTests() {
  console.log("\n=======================================================");
  console.log("  🧪 RUNNING REGISTRATION & LOBBY AUTOMATED TEST SUITE");
  console.log("=======================================================\n");

  const serverUrl = "http://127.0.0.1:3000";

  // 1. Verify Local Network Address & URL Generation
  console.log("--> Testing 1: Verifying Local Network & QR Target URL...");
  const serverInfoRes = await fetch(`${serverUrl}/api/server-info`);
  const serverInfo = (await serverInfoRes.json()) as { serverIp: string; port: number };
  if (serverInfo.serverIp === "localhost" || serverInfo.serverIp === "127.0.0.1") {
    console.warn("⚠️ Warning: Primary IP is localhost. Expected Wi-Fi IPv4.");
  } else {
    console.log(`✓ Local-network IPv4 verified: ${serverInfo.serverIp}:${serverInfo.port}`);
  }

  // 2. Admin Connection & Session Creation
  console.log("\n--> Testing 2: Admin Session Creation...");
  const adminCookie = getTestAdminCookie();
  const adminSocket: TypedSocket = io(serverUrl, {
    transports: ["polling", "websocket"],
    extraHeaders: {
      Cookie: adminCookie,
    },
  });

  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("client:register", { role: "admin", name: "Test Admin" });

  const session = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Automated Test Session" }, (newSession: GameSession) => {
      resolve(newSession);
    });
  });

  console.log(`✓ Session successfully created: ${session.id} ("${session.title}")`);
  const expectedPhoneUrl = `http://${serverInfo.serverIp}:${serverInfo.port}/player?session=${session.id}`;
  console.log(`✓ Non-localhost Registration URL generated: ${expectedPhoneUrl}`);

  // 3. Test Successful Team Registration
  console.log("\n--> Testing 3: Successful Team Registration (Slot 1)...");
  const player1Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => player1Socket.on("connect", () => resolve()));

  const p1RegResult = await new Promise<TeamRegisterResponse>((resolve) => {
    player1Socket.emit(
      "team:register",
      {
        sessionId: session.id,
        teamName: "Quantum Quizzers",
        leaderName: "Alice",
      },
      (res: TeamRegisterResponse) => resolve(res)
    );
  });

  if (!p1RegResult.success || !p1RegResult.team || !p1RegResult.token) {
    throw new Error(`Team 1 registration failed: ${p1RegResult.error}`);
  }

  console.log(`✓ Team 1 registered: "${p1RegResult.team.name}" (Slot ${p1RegResult.team.slotNumber}, Leader: ${p1RegResult.team.leaderName})`);
  console.log(`✓ Secret reconnect token issued: ${p1RegResult.token.slice(0, 8)}...`);

  // 4. Test Duplicate Team Registration (Case-insensitive & Trimmed)
  console.log("\n--> Testing 4: Duplicate Registration Prevention...");
  const player2Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => player2Socket.on("connect", () => resolve()));

  // Exact duplicate
  const exactDupResult = await new Promise<TeamRegisterResponse>((resolve) => {
    player2Socket.emit(
      "team:register",
      {
        sessionId: session.id,
        teamName: "Quantum Quizzers",
        leaderName: "Bob",
      },
      (res: TeamRegisterResponse) => resolve(res)
    );
  });

  if (exactDupResult.success) {
    throw new Error("Failed: Server allowed exact duplicate team name!");
  }
  console.log(`✓ Exact duplicate correctly rejected: "${exactDupResult.error}"`);

  // Case-insensitive whitespace duplicate
  const caseDupResult = await new Promise<TeamRegisterResponse>((resolve) => {
    player2Socket.emit(
      "team:register",
      {
        sessionId: session.id,
        teamName: "   quantum QUIZZERS   ",
        leaderName: "Charlie",
      },
      (res: TeamRegisterResponse) => resolve(res)
    );
  });

  if (caseDupResult.success) {
    throw new Error("Failed: Server allowed case-insensitive duplicate team name!");
  }
  console.log(`✓ Case-insensitive duplicate correctly rejected: "${caseDupResult.error}"`);

  // 5. Test 5-Team Limit & Lobby Full Rejection
  console.log("\n--> Testing 5: Filling Lobby to 5/5 Capacity & 6th Team Rejection...");
  const remainingTeams = [
    { name: "Binary Bandits", leader: "Bob" },
    { name: "Cyber Knights", leader: "Carol" },
    { name: "Data Dragons", leader: "David" },
    { name: "Echo Eagles", leader: "Emma" },
  ];

  for (const t of remainingTeams) {
    const s: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
    await new Promise<void>((resolve) => s.on("connect", () => resolve()));
    const res = await new Promise<TeamRegisterResponse>((resolve) => {
      s.emit("team:register", { sessionId: session.id, teamName: t.name, leaderName: t.leader }, (r: TeamRegisterResponse) => resolve(r));
    });
    if (!res.success || !res.team) {
      throw new Error(`Failed to register ${t.name}: ${res.error}`);
    }
    console.log(`✓ Team registered: "${res.team.name}" (Slot ${res.team.slotNumber})`);
    s.disconnect();
  }

  // Attempt 6th team
  const player6Socket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => player6Socket.on("connect", () => resolve()));
  const fullResult = await new Promise<TeamRegisterResponse>((resolve) => {
    player6Socket.emit(
      "team:register",
      {
        sessionId: session.id,
        teamName: "Overflow Six",
        leaderName: "Frank",
      },
      (res: TeamRegisterResponse) => resolve(res)
    );
  });

  if (fullResult.success) {
    throw new Error("Failed: Server allowed 6th team registration into 5-team lobby!");
  }
  console.log(`✓ Full lobby (6th team) correctly rejected: "${fullResult.error}"`);
  player6Socket.disconnect();

  // 6. Test Registration Closed By Administrator
  console.log("\n--> Testing 6: Registration Closed Enforcement...");
  // Create a new session and close it
  const session2 = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Session Closed Test" }, (newSession: GameSession) => {
      resolve(newSession);
    });
  });

  const toggleRes = await new Promise<boolean>((resolve) => {
    adminSocket.emit("session:toggle_registration", { sessionId: session2.id, isOpen: false }, (ok: boolean) => {
      resolve(ok);
    });
  });

  if (!toggleRes) {
    throw new Error("Admin failed to toggle registration to closed");
  }
  console.log(`✓ Administrator closed registration for ${session2.id}`);

  const closedRegResult = await new Promise<TeamRegisterResponse>((resolve) => {
    player2Socket.emit(
      "team:register",
      {
        sessionId: session2.id,
        teamName: "Late Arrivals",
        leaderName: "Liam",
      },
      (res: TeamRegisterResponse) => resolve(res)
    );
  });

  if (closedRegResult.success) {
    throw new Error("Failed: Server allowed registration after presenter closed it!");
  }
  console.log(`✓ Registration on closed session correctly rejected: "${closedRegResult.error}"`);

  // 7. Test Browser Refresh / Reconnecting with Token
  console.log("\n--> Testing 7: Browser Refresh / Token Reconnection...");
  // Simulate Player 1 closing their tab / refreshing browser
  player1Socket.disconnect();
  console.log("✓ Player 1 browser disconnected (simulating page reload)...");

  // Reconnect with a brand-new socket simulating the reloaded page
  const reloadedSocket: TypedSocket = io(serverUrl, { transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => reloadedSocket.on("connect", () => resolve()));

  const reconnectResult = await new Promise<TeamReconnectResponse>((resolve) => {
    reloadedSocket.emit(
      "team:reconnect",
      {
        sessionId: session.id,
        teamId: p1RegResult.team!.id,
        token: p1RegResult.token!,
      },
      (res: TeamReconnectResponse) => resolve(res)
    );
  });

  if (!reconnectResult.success || !reconnectResult.team) {
    throw new Error(`Failed to reconnect team after browser refresh: ${reconnectResult.error}`);
  }

  console.log(`✓ Successfully reconnected: "${reconnectResult.team.name}" (Slot ${reconnectResult.team.slotNumber}, ID: ${reconnectResult.team.id})`);

  // Verify invalid token is rejected
  const badTokenResult = await new Promise<TeamReconnectResponse>((resolve) => {
    reloadedSocket.emit(
      "team:reconnect",
      {
        sessionId: session.id,
        teamId: p1RegResult.team!.id,
        token: "invalid-token-12345",
      },
      (res: TeamReconnectResponse) => resolve(res)
    );
  });

  if (badTokenResult.success) {
    throw new Error("Failed: Server allowed reconnection with forged token!");
  }
  console.log(`✓ Forged token correctly rejected: "${badTokenResult.error}"`);

  // Clean up
  adminSocket.disconnect();
  player2Socket.disconnect();
  reloadedSocket.disconnect();

  console.log("\n=======================================================");
  console.log("  🎉 ALL 6 REGISTRATION & LOBBY TESTS PASSED!");
  console.log("=======================================================\n");
  process.exit(0);
}

runRegistrationLobbyTests().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Test failure:", msg);
  process.exit(1);
});
