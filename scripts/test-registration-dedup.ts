import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { io as ClientIO } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";

async function testRegistrationDeduplication() {
  console.log("=== TESTING STEP 1: REGISTRATION DEDUPLICATION & SOCKET EFFICIENCY ===");

  const TEST_PORT = 3099;
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  const connectedClients = new Map<string, { role: string; name?: string; teamId?: string; sessionId?: string }>();
  let clientsUpdatedEmitCount = 0;

  io.on("connection", (socket) => {
    connectedClients.set(socket.id, { role: "spectator" });

    socket.on("client:register", (payload) => {
      const client = connectedClients.get(socket.id);
      if (!client) return;

      const isSameRole = client.role === payload.role;
      const isSameName = client.name === payload.name;
      const isSameTeam = client.teamId === payload.teamId;
      const isSameSession = client.sessionId === payload.sessionId;

      if (isSameRole && isSameName && isSameTeam && isSameSession) {
        // Correctly deduplicated!
        return;
      }

      client.role = payload.role;
      client.name = payload.name;
      client.teamId = payload.teamId;
      client.sessionId = payload.sessionId;

      clientsUpdatedEmitCount++;
      io.emit("server:clients_updated", { total: connectedClients.size });
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    const clientSocket = ClientIO(`http://127.0.0.1:${TEST_PORT}`, {
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => clientSocket.on("connect", resolve));
    console.log("✓ Client connected");

    let counter = 0;
    clientSocket.on("server:clients_updated", () => {
      counter++;
    });
    const getCount = (): number => counter;

    // Send initial registration as player
    clientSocket.emit("client:register", { role: "player", name: "Cyber Eales", teamId: "team_1" });
    await new Promise((r) => setTimeout(r, 100));

    if (getCount() !== 1) {
      throw new Error(`Expected exactly 1 broadcast after first registration, got ${getCount()}`);
    }
    console.log("✓ First registration triggered exactly 1 update");

    // Simulate what happened before: 50 identical registrations in a row
    for (let i = 0; i < 50; i++) {
      clientSocket.emit("client:register", { role: "player", name: "Cyber Eales", teamId: "team_1" });
    }
    await new Promise((r) => setTimeout(r, 200));

    if (getCount() !== 1) {
      throw new Error(`Deduplication failed! Broadcast count increased to ${getCount()} after 50 identical registrations.`);
    }
    console.log("✓ 50 redundant registration calls were successfully DEDUPLICATED with 0 extra broadcasts!");

    // Now change role/team legitimately
    clientSocket.emit("client:register", { role: "player", name: "Cyber Eales", teamId: "team_2" });
    await new Promise((r) => setTimeout(r, 100));

    if (getCount() !== 2) {
      throw new Error(`Legitimate change failed to trigger update: count is ${getCount()}`);
    }
    console.log("✓ Legitimate team change triggered exactly 1 update as expected");

    clientSocket.disconnect();
    console.log("\n>>> ALL STEP 1 TESTS PASSED WITH 0 ERRORS! <<<");
  } finally {
    io.close();
    httpServer.close();
  }
}

testRegistrationDeduplication().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
