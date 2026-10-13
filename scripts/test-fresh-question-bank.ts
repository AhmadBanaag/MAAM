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

async function testFreshQuestionBank() {
  console.log("=== TESTING FRESH QUESTION BANK & PERSISTENCE ===");

  // Step 1: Verify clean starting state
  closeDb();
  let questions = getQuestions();
  console.log(`--> [CHECK 1] Question bank count on clean boot: ${questions.length}`);
  if (questions.length !== 0) {
    throw new Error(`Expected 0 questions on clean boot, got ${questions.length}. Auto-seeding was not properly disabled!`);
  }
  console.log("✓ Question bank starts completely fresh with 0 questions (no dummy resurrection).");

  // Step 2: Save a production presentation question
  console.log("--> [CHECK 2] Saving production questions to question bank...");
  const q1 = saveQuestion({
    questionText: "Which architecture pattern decouples services via message queues?",
    options: {
      A: "Event-Driven Architecture",
      B: "Monolithic Architecture",
      C: "Shared Database Pattern",
      D: "Client-Server Direct Socket",
    },
    correctAnswer: "A",
    timeLimit: 30,
    points: 100,
    category: "Software Engineering",
    explanation: "Event-Driven Architecture relies on event producers and consumers with asynchronous queues.",
  });

  const q2 = saveQuestion({
    questionText: "What status code represents successful resource creation in REST APIs?",
    options: {
      A: "200 OK",
      B: "201 Created",
      C: "204 No Content",
      D: "202 Accepted",
    },
    correctAnswer: "B",
    timeLimit: 20,
    points: 100,
    category: "Web Development",
    explanation: "HTTP 201 indicates that the request has succeeded and led to the creation of a resource.",
  });

  questions = getQuestions();
  console.log(`    Total questions saved in bank: ${questions.length}`);
  if (questions.length !== 2) throw new Error(`Expected 2 questions, got ${questions.length}`);
  console.log("✓ Successfully saved 2 questions.");

  // Step 3: Verify cross-session availability (session-agnostic Question Bank)
  console.log("--> [CHECK 3] Verifying availability in multiple sessions...");
  const questionsInSessionA = getQuestions("SESSION-NEW-123");
  const questionsInSessionB = getQuestions("SESSION-OTHER-456");
  const questionsGlobal = getQuestions();

  if (questionsInSessionA.length !== 2 || questionsInSessionB.length !== 2 || questionsGlobal.length !== 2) {
    throw new Error("Questions are not globally available across sessions!");
  }
  console.log("✓ Questions are permanently accessible regardless of session ID.");

  // Step 4: Verify persistence after database connection cycle
  console.log("--> [CHECK 4] Testing database reboot persistence...");
  closeDb();
  const rebootedQuestions = getQuestions();
  if (rebootedQuestions.length !== 2) {
    throw new Error(`Expected 2 questions after reboot, got ${rebootedQuestions.length}`);
  }
  if (rebootedQuestions[0].questionText !== q1.questionText || rebootedQuestions[1].questionText !== q2.questionText) {
    throw new Error("Question text mismatch after DB reboot!");
  }
  console.log("✓ Questions survive complete DB close and reconnect.");

  // Step 5: Test Editing
  console.log("--> [CHECK 5] Testing question editing...");
  saveQuestion({
    id: q1.id,
    questionText: "Updated: Which architecture pattern decouples services via message queues?",
    options: q1.options,
    correctAnswer: "A",
    timeLimit: 35,
    points: 150,
    category: "Software Engineering",
  });

  const updatedQ1 = getQuestionById(q1.id);
  if (!updatedQ1 || updatedQ1.points !== 150 || !updatedQ1.questionText.startsWith("Updated:")) {
    throw new Error("Question edit failed!");
  }
  console.log("✓ Question updated accurately.");

  // Step 6: Test Reordering
  console.log("--> [CHECK 6] Testing question reordering...");
  reorderQuestions([q2.id, q1.id]);
  const reordered = getQuestions();
  if (reordered[0].id !== q2.id || reordered[1].id !== q1.id) {
    throw new Error("Question reordering failed!");
  }
  console.log("✓ Questions reordered accurately.");

  // Step 7: Clear all questions back to fresh for the user's actual presentation questions
  console.log("--> [CHECK 7] Cleaning up test questions for fresh production state...");
  clearAllQuestions();
  const finalCount = getQuestions().length;
  if (finalCount !== 0) throw new Error(`Expected 0 questions after clear, got ${finalCount}`);
  console.log("✓ Question bank wiped clean and 100% fresh for production.");

  closeDb();
  console.log("\n>>> FRESH QUESTION BANK TESTS PASSED WITH 0 ERRORS! <<<");
}

testFreshQuestionBank().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
