import { io } from "socket.io-client";
import { getTestAdminCookie } from "./test-helper";

async function verifyFoundation() {
  console.log("=== STARTING FOUNDATION VERIFICATION TEST ===");

  const targetUrl = "http://127.0.0.1:3000";
  console.log(`Connecting to ${targetUrl}...`);

  // 1. Verify HTTP Server Info API
  try {
    const res = await fetch(`${targetUrl}/api/server-info`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const info = await res.json();
    console.log("✓ HTTP API /api/server-info is OK:", {
      status: info.status,
      serverIp: info.serverIp,
      port: info.port,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("✗ Failed to fetch /api/server-info:", message);
    process.exit(1);
  }

  // 2. Verify Admin Socket.IO Connection
  const adminCookie = getTestAdminCookie();
  const adminSocket = io(targetUrl, {
    transports: ["websocket", "polling"],
    timeout: 5000,
    extraHeaders: {
      Cookie: adminCookie,
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Admin socket connection timed out")), 5000);

    adminSocket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`✓ Admin socket connected successfully (ID: ${adminSocket.id})`);
      resolve();
    });

    adminSocket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // 3. Register Admin and test Ping/Pong latency
  const pongPromise = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Pong response timed out")), 5000);
    adminSocket.on("server:pong", (data) => {
      clearTimeout(timeout);
      const latency = Date.now() - data.clientTimestamp;
      resolve(latency);
    });
  });

  adminSocket.emit("client:register", { role: "admin", name: "Test Presenter" });
  adminSocket.emit("client:ping", { clientTimestamp: Date.now() });
  const latency = await pongPromise;
  console.log(`✓ Admin Ping/Pong verified (Round-trip latency: ${latency}ms)`);

  // 4. Verify Player Socket.IO Connection & Broadcast Reception
  const playerSocket = io(targetUrl, { transports: ["websocket", "polling"], timeout: 5000 });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Player socket connection timed out")), 5000);
    playerSocket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`✓ Player socket connected successfully (ID: ${playerSocket.id})`);
      resolve();
    });
  });

  playerSocket.emit("client:register", { role: "player", name: "Team 1: Alpha", teamId: "team-1" });

  const broadcastPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Broadcast reception timed out")), 5000);
    playerSocket.on("server:broadcast_test", (data) => {
      clearTimeout(timeout);
      resolve(data.message);
    });
  });

  adminSocket.emit("admin:test_broadcast", { message: "Classroom Quiz Battle - Test Broadcast Message" });
  const broadcastReceived = await broadcastPromise;
  console.log(`✓ Real-time broadcast successfully received by Player: "${broadcastReceived}"`);

  // Clean up
  adminSocket.disconnect();
  playerSocket.disconnect();

  console.log("\n=======================================================");
  console.log("  🎉 ALL FOUNDATION VERIFICATION TESTS PASSED!");
  console.log("=======================================================\n");
  process.exit(0);
}

verifyFoundation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
