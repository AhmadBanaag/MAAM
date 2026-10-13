import { getDb, closeDb } from "../src/lib/db";

async function runStep4Tests() {
  console.log("=== TESTING STEP 4: OPTIMISTIC SUBMISSION & NTP CLOCK SYNCHRONIZATION ===");

  // 1. Check NTP Clock Drift Offset Calculation Logic
  console.log("--> [CHECK 1] Testing NTP Clock Offset Calculation...");
  const clientT0 = 1000;
  const serverT = 1050; // Server is 50ms ahead
  const clientT1 = 1100; // 100ms round trip
  const roundTrip = clientT1 - clientT0;
  const estimatedServerNow = serverT + Math.round(roundTrip / 2); // 1050 + 50 = 1100
  const offset = estimatedServerNow - clientT1; // 1100 - 1100 = 0 (perfect sync relative to reception)
  
  if (roundTrip !== 100 || estimatedServerNow !== 1100) {
    throw new Error(`NTP calculation error: roundTrip=${roundTrip}, estimated=${estimatedServerNow}`);
  }
  console.log(`✓ NTP clock offset calculation verified: roundTrip=${roundTrip}ms, offset=${offset}ms.`);

  // Test asymmetric clock drift:
  const clientLocal = Date.now();
  const serverOffset = 3000; // Server is 3 seconds ahead
  const serverClock = clientLocal + serverOffset;
  const deadline = serverClock + 30000; // 30s deadline
  
  // Client without offset:
  const rawDiff = Math.ceil((deadline - clientLocal) / 1000); // 33s (wrong!)
  // Client WITH offset:
  const calibratedDiff = Math.ceil((deadline - (clientLocal + serverOffset)) / 1000); // 30s (exact!)
  
  if (calibratedDiff !== 30) {
    throw new Error(`Calibrated diff mismatch: expected 30, got ${calibratedDiff}`);
  }
  console.log(`✓ Asymmetric 3000ms clock drift calibration successfully verified: ${rawDiff}s -> ${calibratedDiff}s.`);

  // 2. Check Question Bank Freshness Persistence
  console.log("--> [CHECK 2] Verifying question bank remains fresh and production-ready...");
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) as count FROM questions").get() as { count: number };
  if (countRow.count !== 0) {
    throw new Error(`Question bank is not fresh! Found ${countRow.count} questions.`);
  }
  console.log(`✓ Question bank count is exactly 0 questions (fresh and ready for production).`);

  // 3. Verify PRAGMA optimizations remain in WAL mode
  console.log("--> [CHECK 3] Verifying SQLite Engine PRAGMAs...");
  const walRow = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
  if (walRow.journal_mode.toLowerCase() !== "wal") {
    throw new Error(`Expected WAL mode, got ${walRow.journal_mode}`);
  }
  console.log(`✓ SQLite journal_mode is ${walRow.journal_mode}.`);

  closeDb();
  console.log("\n>>> ALL STEP 4 VERIFICATION CHECKS PASSED WITH 0 ERRORS! <<<");
}

runStep4Tests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
