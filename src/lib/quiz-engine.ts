import type {
  QuizQuestion,
  ClientQuizQuestion,
  QuizChoice,
} from "@/types/socket";

export interface PowerUpQuizRules {
  /**
   * Future power-up hook: e.g. Lockout / Freeze disables a team from answering.
   */
  canTeamAnswer?: (teamId: string, questionId: string) => { allowed: boolean; reason?: string };

  /**
   * Future power-up hook: e.g. 50/50 removes 2 wrong options for a specific team.
   */
  filterOptionsForTeam?: (
    teamId: string,
    question: QuizQuestion
  ) => { A?: string; B?: string; C?: string; D?: string };

  /**
   * Future power-up hook: e.g. Riddle Gatekeeper requires solving a riddle first.
   */
  requiresRiddle?: (teamId: string) => boolean;
}

// Global hook registry for future power-up extensions
let activePowerUpRules: PowerUpQuizRules = {};

export function registerPowerUpRules(rules: PowerUpQuizRules) {
  activePowerUpRules = { ...activePowerUpRules, ...rules };
}

export function resetPowerUpRules() {
  activePowerUpRules = {};
}

/**
 * Creates a client-safe question object for players / spectators.
 * CRITICAL SECURITY: Never includes the correct answer!
 */
export function createClientQuestion(
  question: QuizQuestion,
  sessionId: string,
  startedAt: number,
  deadline: number,
  questionNumber: number,
  totalQuestions: number,
  targetTeamId?: string
): ClientQuizQuestion {
  let options = { ...question.options };

  // Allow power-up rules to filter options if applicable (e.g. 50/50 in Phase 4)
  if (targetTeamId && activePowerUpRules.filterOptionsForTeam) {
    const filtered = activePowerUpRules.filterOptionsForTeam(targetTeamId, question);
    options = {
      A: filtered.A ?? options.A,
      B: filtered.B ?? options.B,
      C: filtered.C ?? options.C,
      D: filtered.D ?? options.D,
    };
  }

  return {
    id: question.id,
    sessionId,
    questionText: question.questionText,
    options,
    timeLimit: question.timeLimit,
    points: question.points,
    startedAt,
    deadline,
    questionNumber,
    totalQuestions,
  };
}

/**
 * Validates whether a team is currently allowed to submit an answer.
 */
export function isTeamEligibleToAnswer(
  teamId: string,
  questionId: string
): { allowed: boolean; reason?: string } {
  if (activePowerUpRules.canTeamAnswer) {
    return activePowerUpRules.canTeamAnswer(teamId, questionId);
  }
  return { allowed: true };
}

/**
 * Checks if team needs to clear a riddle gate before accessing the quiz.
 */
export function doesTeamRequireRiddle(teamId: string): boolean {
  if (activePowerUpRules.requiresRiddle) {
    return activePowerUpRules.requiresRiddle(teamId);
  }
  return false;
}

/**
 * Evaluates an answer submission. Pure function.
 */
export function evaluateAnswer(
  choice: QuizChoice,
  correctAnswer: QuizChoice,
  points: number = 100
): { isCorrect: boolean; pointsAwarded: number } {
  const isCorrect = choice === correctAnswer;
  return {
    isCorrect,
    pointsAwarded: isCorrect ? points : 0,
  };
}
