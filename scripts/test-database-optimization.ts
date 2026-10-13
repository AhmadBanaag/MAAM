import {
  getDb,
  getQuestions,
  getQuestionById,
  saveQuestion,
  deleteQuestion,
  reorderQuestions,
  clearAllQuestions,
  closeDb,
} from "../src/lib/db";

async function testDatabaseOptimizations() {
  console.log("=== TESTING STEP 2: DATABASE OPTIMIZATIONS & QUERY CACHING ===");

  const db = getDb();

  // Test 1: Verify PRAGMA engine configuration
  console.log("--> [TEST 1] Verifying SQLite Engine PRAGMAs...");
  const journalMode = db.pragma("journal_mode", { simple: true });
  const synchronous = db.pragma("synchronous", { simple: true });
  const cacheSize = db.pragma("cache_size", { simple: true });
  const tempStore = db.pragma("temp_store", { simple: true });

  console.log(`    journal_mode: ${journalMode}`);
  console.log(`    synchronous: ${synchronous} (1 = NORMAL)`);
  console.log(`    cache_size: ${cacheSize}`);
  console.log(`    temp_store: ${tempStore} (2 = MEMORY)`);

  if (journalMode !== "wal") throw new Error(`Expected journal_mode=wal, got ${journalMode}`);
  if (synchronous !== 1) throw new Error(`Expected synchronous=1 (NORMAL), got ${synchronous}`);
  if (cacheSize !== -64000) throw new Error(`Expected cache_size=-64000, got ${cacheSize}`);
  if (tempStore !== 2) throw new Error(`Expected temp_store=2 (MEMORY), got ${tempStore}`);
  console.log("✓ All SQLite PRAGMAs successfully verified.");

  // Test 2: Verify Compound Indexes
  console.log("\n--> [TEST 2] Verifying Compound Indexes...");
  const requiredIndexes = [
    "idx_sessions_status",
    "idx_teams_session_token",
    "idx_questions_order",
    "idx_submissions_lookup",
    "idx_team_powerups_lookup",
    "idx_team_riddle_lookup",
    "idx_clincher_sub_round",
  ];

  const allIndexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{ name: string }>;
  const existingIndexNames = new Set(allIndexes.map((i) => i.name));

  for (const idx of requiredIndexes) {
    if (!existingIndexNames.has(idx)) {
      throw new Error(`Missing expected index: ${idx}`);
    }
    console.log(`    ✓ Found index: ${idx}`);
  }
  console.log("✓ All compound indexes verified in SQLite schema.");

  // Clean before starting question operations
  clearAllQuestions();

  // Test 3: In-Memory Question Cache & Speed
  console.log("\n--> [TEST 3] Testing In-Memory Question Cache & Speed...");
  const qSpeed = saveQuestion({
    questionText: "Performance Benchmark Question",
    options: { A: "A", B: "B", C: "C", D: "D" },
    correctAnswer: "A",
  });

  // Measure cached read speed
  const iterations = 5000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    getQuestionById(qSpeed.id);
  }
  const elapsedMs = performance.now() - start;
  const avgMicroseconds = (elapsedMs / iterations) * 1000;
  console.log(`    ${iterations} cached reads completed in ${elapsedMs.toFixed(2)}ms (average: ${avgMicroseconds.toFixed(2)}µs/read)`);

  // Remove benchmark question so bank is clean for mutation tests
  deleteQuestion(qSpeed.id);

  // Test 4: Cache Invalidation on Mutations
  console.log("\n--> [TEST 4] Testing Cache Invalidation Integrity...");
  const testQuestion = saveQuestion({
    questionText: "Cache Test Question",
    options: { A: "One", B: "Two", C: "Three", D: "Four" },
    correctAnswer: "A",
    points: 150,
  });

  const fetched = getQuestionById(testQuestion.id);
  if (!fetched || fetched.questionText !== "Cache Test Question") {
    throw new Error("Failed to read freshly saved question from cache.");
  }

  // Update question
  saveQuestion({
    id: testQuestion.id,
    questionText: "Updated Cache Test Question",
    options: { A: "One", B: "Two", C: "Three", D: "Four" },
    correctAnswer: "B",
    points: 200,
  });

  const updated = getQuestionById(testQuestion.id);
  if (!updated || updated.questionText !== "Updated Cache Test Question" || updated.points !== 200) {
    throw new Error("Cache invalidation failed: read stale question text or points.");
  }
  console.log("    ✓ Cache invalidated and refreshed accurately on saveQuestion.");

  // Delete question
  deleteQuestion(testQuestion.id);
  const deleted = getQuestionById(testQuestion.id);
  if (deleted !== null) {
    throw new Error("Cache invalidation failed: question still present after deleteQuestion.");
  }
  console.log("    ✓ Cache invalidated accurately on deleteQuestion.");

  // Reorder questions
  const qA = saveQuestion({ questionText: "Q A", options: { A: "1", B: "2", C: "3", D: "4" }, correctAnswer: "A" });
  const qB = saveQuestion({ questionText: "Q B", options: { A: "1", B: "2", C: "3", D: "4" }, correctAnswer: "B" });
  reorderQuestions([qB.id, qA.id]);
  const reordered = getQuestions();
  if (reordered[0].id !== qB.id) {
    throw new Error(`Cache invalidation failed on reorderQuestions: expected ${qB.id}, got ${reordered[0].id}`);
  }
  console.log("    ✓ Cache invalidated accurately on reorderQuestions.");

  // Clean up to keep question bank 100% fresh for production
  clearAllQuestions();

  closeDb();
  console.log("\n>>> ALL STEP 2 DATABASE OPTIMIZATION TESTS PASSED WITH 0 ERRORS! <<<");
}

testDatabaseOptimizations().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
