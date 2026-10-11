"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { QuizQuestion, QuizChoice } from "@/types/socket";

interface QuizQuestionManagerProps {
  questions: QuizQuestion[];
  sessionId: string;
  onSaveQuestion: (question: Partial<QuizQuestion>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onActivateQuestion?: (questionId: string) => void;
  isQuizActive?: boolean;
}

export function QuizQuestionManager({
  questions,
  sessionId,
  onSaveQuestion,
  onDeleteQuestion,
  onActivateQuestion,
  isQuizActive = false,
}: QuizQuestionManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Form State
  const [formText, setFormText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<QuizChoice>("A");
  const [timeLimit, setTimeLimit] = useState(25);
  const [points, setPoints] = useState(100);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFormText("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswer("A");
    setTimeLimit(25);
    setPoints(100);
    setFormError(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (q: QuizQuestion) => {
    setEditingId(q.id);
    setFormText(q.questionText);
    setOptionA(q.options.A);
    setOptionB(q.options.B);
    setOptionC(q.options.C);
    setOptionD(q.options.D);
    setCorrectAnswer(q.correctAnswer);
    setTimeLimit(q.timeLimit);
    setPoints(q.points);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) {
      setFormError("Question text cannot be empty.");
      return;
    }
    if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setFormError("All four options (A, B, C, D) are required.");
      return;
    }

    onSaveQuestion({
      id: editingId || undefined,
      sessionId,
      questionText: formText.trim(),
      options: {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim(),
      },
      correctAnswer,
      timeLimit,
      points,
    });

    resetForm();
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      {/* Header bar */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Quiz Question Bank</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
                {questions.length} Questions
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Prepare, edit, and schedule presentation questions in advance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAdding && (
            <button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Question Form Modal / Panel */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="p-5 bg-slate-950/80 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4" />
              <span>{editingId ? "Edit Question" : "Create New Question"}</span>
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Question Text
            </label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="e.g. Which layer of the OSI model handles end-to-end packet delivery?"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["A", "B", "C", "D"] as QuizChoice[]).map((choice) => {
              const val =
                choice === "A" ? optionA : choice === "B" ? optionB : choice === "C" ? optionC : optionD;
              const setVal =
                choice === "A"
                  ? setOptionA
                  : choice === "B"
                  ? setOptionB
                  : choice === "C"
                  ? setOptionC
                  : setOptionD;
              const isSelected = correctAnswer === choice;

              return (
                <div key={choice} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Option {choice}</span>
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(choice)}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                        isSelected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <CheckCircle className="w-3 h-3" />
                      <span>{isSelected ? "Correct Answer" : "Mark as Correct"}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder={`Answer for ${choice}...`}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      isSelected ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : "border-slate-700 focus:border-indigo-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Duration & Points Controls */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <label className="text-xs text-slate-300 font-medium">Time Limit:</label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value={15}>15 Seconds</option>
                <option value={20}>20 Seconds</option>
                <option value={25}>25 Seconds</option>
                <option value={30}>30 Seconds</option>
                <option value={45}>45 Seconds</option>
                <option value={60}>60 Seconds</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <label className="text-xs text-slate-300 font-medium">Points:</label>
              <select
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value={50}>50 Points</option>
                <option value={100}>100 Points (Standard)</option>
                <option value={150}>150 Points</option>
                <option value={200}>200 Points (Bonus)</option>
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                {editingId ? "Update Question" : "Save Question"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Questions List */}
      {isExpanded && (
        <div className="p-4 divide-y divide-slate-800/80 max-h-[380px] overflow-y-auto space-y-3">
          {questions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs italic">
              No questions found. Click &quot;Add Question&quot; to create your first question.
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="pt-3 first:pt-0 space-y-2 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono font-bold">
                        Q{idx + 1}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" /> {q.timeLimit}s
                      </span>
                      <span className="text-xs text-amber-400 flex items-center gap-1 font-mono font-semibold">
                        <Award className="w-3 h-3" /> {q.points} pts
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        Answer: {q.correctAnswer}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white leading-relaxed">
                      {q.questionText}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onActivateQuestion && (
                      <button
                        onClick={() => onActivateQuestion(q.id)}
                        disabled={isQuizActive}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Trigger this specific question as surprise quiz"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Launch</span>
                      </button>
                    )}

                    <button
                      onClick={() => startEdit(q)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Edit question"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteQuestion(q.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Choices preview */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  {(["A", "B", "C", "D"] as QuizChoice[]).map((c) => {
                    const isCorrect = q.correctAnswer === c;
                    return (
                      <div
                        key={c}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] truncate ${
                          isCorrect
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold"
                            : "bg-slate-950/60 border-slate-800/80 text-slate-400"
                        }`}
                        title={`${c}: ${q.options[c]}`}
                      >
                        <span className="font-bold mr-1">{c}:</span>
                        {q.options[c]}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
