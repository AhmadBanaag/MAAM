"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  Clock,
  Award,
  Zap,
  Tag,
  AlertCircle,
  X,
  Smartphone,
  Play,
  Check,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import type { QuizQuestion, QuizChoice } from "@/types/socket";

export default function AdminQuestionsPage() {
  const {
    currentSession,
    lobbyData,
    questions,
    activeQuiz,
    fetchQuestions,
    saveQuestionAction,
    deleteQuestionAction,
    clearQuestionsAction,
    activateSurpriseQuiz,
    reorderQuestionsAction,
  } = useSocket("admin", "Admin");

  const activeSessionId = lobbyData?.session.id || currentSession?.id;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuizQuestion | null>(null);

  // Form State
  const [formText, setFormText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<QuizChoice>("A");
  const [timeLimit, setTimeLimit] = useState(25);
  const [points, setPoints] = useState(100);
  const [category, setCategory] = useState("General");
  const [explanation, setExplanation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions(activeSessionId);
  }, [activeSessionId, fetchQuestions]);

  // Extract all unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.category) set.add(q.category);
    });
    return Array.from(set);
  }, [questions]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchCat = selectedCategory === "all" || (q.category || "General").toLowerCase() === selectedCategory.toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        q.questionText.toLowerCase().includes(query) ||
        q.options.A.toLowerCase().includes(query) ||
        q.options.B.toLowerCase().includes(query) ||
        q.options.C.toLowerCase().includes(query) ||
        q.options.D.toLowerCase().includes(query) ||
        (q.category && q.category.toLowerCase().includes(query));

      return matchCat && matchQuery;
    });
  }, [questions, selectedCategory, searchQuery]);

  const openAddModal = () => {
    setEditingQuestion(null);
    setFormText("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswer("A");
    setTimeLimit(25);
    setPoints(100);
    setCategory("General");
    setExplanation("");
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (q: QuizQuestion) => {
    if (activeQuiz && activeQuiz.id === q.id) {
      alert("Cannot edit this question while it is actively being presented to students!");
      return;
    }
    setEditingQuestion(q);
    setFormText(q.questionText);
    setOptionA(q.options.A);
    setOptionB(q.options.B);
    setOptionC(q.options.C);
    setOptionD(q.options.D);
    setCorrectAnswer(q.correctAnswer);
    setTimeLimit(q.timeLimit);
    setPoints(q.points);
    setCategory(q.category || "General");
    setExplanation(q.explanation || "");
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) {
      setFormError("Question text cannot be blank.");
      return;
    }
    if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setFormError("All 4 answer options (A, B, C, D) are required.");
      return;
    }

    saveQuestionAction({
      id: editingQuestion?.id || undefined,
      sessionId: undefined,
      questionText: formText.trim(),
      options: {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim(),
      },
      correctAnswer,
      timeLimit: Number(timeLimit) || 25,
      points: Number(points) || 100,
      category: category.trim() || "General",
      explanation: explanation.trim() || undefined,
      orderNum: editingQuestion ? editingQuestion.orderNum : questions.length + 1,
    });

    setIsEditorOpen(false);
  };

  const handleDelete = (id: string) => {
    if (activeQuiz && activeQuiz.id === id) {
      alert("Cannot delete this question while it is actively being presented to students!");
      return;
    }
    if (confirm("Are you sure you want to delete this question?")) {
      deleteQuestionAction(id);
    }
  };

  const handleClearAll = () => {
    if (activeQuiz) {
      alert("Cannot clear questions while a quiz question is actively in progress!");
      return;
    }
    if (questions.length === 0) {
      alert("The question bank is already empty.");
      return;
    }
    if (confirm(`Are you sure you want to delete ALL ${questions.length} questions in the question bank? This will start completely fresh for your presentation.`)) {
      clearQuestionsAction((success) => {
        if (!success) {
          alert("Failed to clear question bank.");
        }
      });
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newOrder = [...questions];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const ids = newOrder.map((q) => q.id);
    await reorderQuestionsAction(ids);
  };

  const handleActivate = (qId: string) => {
    if (activeQuiz) {
      alert("A quiz question is already active! Please wait for it to end or terminate it before launching another.");
      return;
    }
    if (!activeSessionId) {
      alert("No active session found.");
      return;
    }
    activateSurpriseQuiz(activeSessionId, qId);
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <HelpCircle className="h-4 w-4" />
            <span>Quiz Content Repository</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Question Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create, edit, reorder, preview, and activate multiple-choice questions for the quiz battle.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {questions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-white font-semibold text-xs transition active:scale-95"
              title="Clear all questions to start fresh"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
              <span>Clear Question Bank</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Question</span>
          </button>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search questions or choices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
              selectedCategory === "all"
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            All Categories ({questions.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500 space-y-3">
            <HelpCircle className="h-10 w-10 mx-auto text-slate-600" />
            <h3 className="text-base font-bold text-slate-300">No questions found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== "all"
                ? "Try clearing your search query or category filter."
                : "Your question bank is empty. Click 'Add New Question' to get started."}
            </p>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const isActive = activeQuiz && activeQuiz.id === q.id;

            return (
              <div
                key={q.id}
                className={`rounded-2xl border p-5 transition backdrop-blur shadow-md ${
                  isActive
                    ? "border-purple-500/80 bg-purple-950/20 shadow-purple-500/10 ring-1 ring-purple-500/40"
                    : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, "down")}
                        disabled={idx === questions.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {q.category && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-slate-700">
                            <Tag className="h-3 w-3" />
                            {q.category}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {q.timeLimit}s limit
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <Award className="h-3 w-3" />
                          {q.points} pts
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/40 animate-pulse">
                            <Zap className="h-3 w-3 text-purple-400" />
                            CURRENTLY ACTIVE
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm md:text-base font-bold text-white leading-relaxed">
                        {q.questionText}
                      </h3>

                      {/* Answer Choices Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {(["A", "B", "C", "D"] as QuizChoice[]).map((choiceKey) => {
                          const isCorrect = q.correctAnswer === choiceKey;
                          return (
                            <div
                              key={choiceKey}
                              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${
                                isCorrect
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 font-semibold"
                                  : "border-slate-800/80 bg-slate-950/40 text-slate-400"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                  isCorrect ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {choiceKey}
                              </span>
                              <span className="truncate">{q.options[choiceKey]}</span>
                              {isCorrect && <Check className="h-3.5 w-3.5 text-emerald-400 ml-auto shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                          <span className="font-semibold text-indigo-400">Explanation:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                    <button
                      type="button"
                      onClick={() => handleActivate(q.id)}
                      disabled={!!activeQuiz}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow disabled:opacity-40 disabled:hover:bg-emerald-600"
                      title={activeQuiz ? "Another quiz is already active" : "Launch this question to students"}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Activate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(q)}
                      className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Preview how this appears on student screens"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      disabled={!!isActive}
                      className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-30"
                      title="Edit question"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      disabled={!!isActive}
                      className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition disabled:opacity-30"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit / Add Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 md:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingQuestion ? "Edit Quiz Question" : "Add New Quiz Question"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Question Text <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Enter the quiz question..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* 4 Choices */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Four Answer Choices (Select radio for the correct answer) <span className="text-rose-400">*</span>
                </label>

                {[
                  { key: "A" as QuizChoice, val: optionA, set: setOptionA },
                  { key: "B" as QuizChoice, val: optionB, set: setOptionB },
                  { key: "C" as QuizChoice, val: optionC, set: setOptionC },
                  { key: "D" as QuizChoice, val: optionD, set: setOptionD },
                ].map(({ key, val, set }) => (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(key)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs transition border ${
                        correctAnswer === key
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                      title={`Mark Choice ${key} as correct`}
                    >
                      {key}
                    </button>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={`Option ${key} text...`}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                ))}
              </div>

              {/* Details row: Category, Time Limit, Points */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Networking"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Time Limit (seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Points</label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Optional Explanation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Explanation (shown after quiz round ends)
                </label>
                <input
                  type="text"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the correct answer is right..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 text-xs font-semibold hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20"
                >
                  {editingQuestion ? "Save Changes" : "Create Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student View Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">Student Screen Simulation</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            {/* Simulated Phone Screen */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Quiz Round</span>
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {previewQuestion.timeLimit}s
                </span>
              </div>

              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-3/4 rounded-full" />
              </div>

              <h4 className="text-sm font-bold text-white leading-relaxed">
                {previewQuestion.questionText}
              </h4>

              <div className="space-y-2">
                {(["A", "B", "C", "D"] as QuizChoice[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-950 text-left text-xs text-white hover:border-indigo-500 hover:bg-indigo-950/20 transition"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white font-bold text-xs">
                      {key}
                    </span>
                    <span className="flex-1 truncate">{previewQuestion.options[key]}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-500">
              Students see the question and four answer buttons on their phones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
