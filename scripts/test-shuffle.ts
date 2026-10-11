import { io, Socket } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamPowerUpAssignment,
  TeamRegisterResponse,
} from "../src/types/socket";
import type { GameSession } from "../src/lib/db";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function testShuffleFlow() {
  console.log("=== Testing Power-Up Shuffling & Real-time Player Distribution ===");
  const serverUrl = "http://127.0.0.1:3000";

  // 1. Admin socket
  const adminCookie = getTestAdminCookie();
  const adminSocket: TypedSocket = io(serverUrl, {
    transports: ["websocket", "polling"],
    extraHeaders: { Cookie: adminCookie },
  });
  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("client:register", { role: "admin", name: "Shuffle Admin" });

  // 2. Create fresh session
  const session = await new Promise<GameSession>((resolve) => {
    adminSocket.emit("session:create", { title: "Shuffle Test Session" }, (s) => resolve(s));
  });
  console.log(`Created session: ${session.id}`);

  // 3. Register 3 player sockets (fewer than 5 teams to test non-full lobby shuffling!)
  const playerSockets: TypedSocket[] = [];
  const assignedSpellsPerPlayer: Array<TeamPowerUpAssignment[]> = [[], [], []];

  for (let i = 1; i <= 3; i++) {
    const pSocket: TypedSocket = io(serverUrl, { transports: ["websocket", "polling"] });
    await new Promise<void>((resolve) => pSocket.on("connect", () => resolve()));
    playerSockets.push(pSocket);

    const playerIndex = i - 1;
    pSocket.on("powerup:assigned", (assignment) => {
      console.log(`Player ${i} received powerup:assigned event -> ${assignment.powerUpName} (${assignment.powerUpType})`);
      assignedSpellsPerPlayer[playerIndex].push(assignment);
    });

    const reg = await new Promise<TeamRegisterResponse>((resolve) => {
      pSocket.emit("team:register", { sessionId: session.id, teamName: `Team ${i}`, leaderName: `Leader ${i}` }, (res) => resolve(res));
    });
    if (!reg.success) throw new Error(`Registration failed: ${reg.error}`);
    console.log(`✓ Team ${i} registered.`);
  }

  // 4. Admin triggers power-up shuffle for the 3 teams
  console.log("\n--> Admin triggering powerup:shuffle for the 3 teams...");
  const shuffle1 = await new Promise<{ success: boolean; assignments?: TeamPowerUpAssignment[]; error?: string }>((resolve) => {
    adminSocket.emit("powerup:shuffle", { sessionId: session.id }, (res) => resolve(res));
  });

  if (!shuffle1.success || !shuffle1.assignments) {
    throw new Error(`Shuffle 1 failed: ${shuffle1.error}`);
  }
  console.log(`✓ Shuffle 1 successful! Assigned:`, shuffle1.assignments.map(a => `${a.teamName}: ${a.powerUpType}`).join(", "));
  if (shuffle1.assignments.length !== 3) {
    throw new Error(`Expected 3 assignments, got ${shuffle1.assignments.length}`);
  }

  // Allow events to reach sockets
  await new Promise((r) => setTimeout(r, 400));

  // Verify all 3 player sockets received their assignment
  for (let i = 0; i < 3; i++) {
    if (assignedSpellsPerPlayer[i].length === 0) {
      throw new Error(`Player ${i + 1} did NOT receive any powerup:assigned event!`);
    }
    const latest = assignedSpellsPerPlayer[i][assignedSpellsPerPlayer[i].length - 1];
    const expected = shuffle1.assignments.find(a => a.slotNumber === i + 1);
    if (latest.powerUpType !== expected?.powerUpType) {
      throw new Error(`Player ${i + 1} spell mismatch: received ${latest.powerUpType}, expected ${expected?.powerUpType}`);
    }
  }
  console.log("✓ All 3 player sockets received their live power-up assignment via Socket.IO!");

  // 5. Admin triggers SECOND power-up shuffle (reshuffle)
  console.log("\n--> Admin triggering SECOND powerup:shuffle (reshuffle)...");
  const shuffle2 = await new Promise<{ success: boolean; assignments?: TeamPowerUpAssignment[]; error?: string }>((resolve) => {
    adminSocket.emit("powerup:shuffle", { sessionId: session.id }, (res) => resolve(res));
  });

  if (!shuffle2.success || !shuffle2.assignments) {
    throw new Error(`Shuffle 2 failed: ${shuffle2.error}`);
  }
  console.log(`✓ Shuffle 2 successful! Assigned:`, shuffle2.assignments.map(a => `${a.teamName}: ${a.powerUpType}`).join(", "));

  // Allow events to reach sockets
  await new Promise((r) => setTimeout(r, 400));

  // Verify all 3 player sockets received the updated assignment
  for (let i = 0; i < 3; i++) {
    if (assignedSpellsPerPlayer[i].length < 2) {
      throw new Error(`Player ${i + 1} did NOT receive the second shuffled powerup event!`);
    }
    const latest = assignedSpellsPerPlayer[i][assignedSpellsPerPlayer[i].length - 1];
    const expected = shuffle2.assignments.find(a => a.slotNumber === i + 1);
    if (latest.powerUpType !== expected?.powerUpType) {
      throw new Error(`Player ${i + 1} second spell mismatch: received ${latest.powerUpType}, expected ${expected?.powerUpType}`);
    }
  }
  console.log("✓ All 3 player sockets immediately received their updated reshuffled spell!");

  // Disconnect sockets
  adminSocket.disconnect();
  playerSockets.forEach(s => s.disconnect());

  console.log("\n🎉 ALL REAL-TIME SHUFFLE TESTS PASSED PERFECTLY!\n");
}

testShuffleFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
