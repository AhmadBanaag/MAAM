"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Award,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Shield,
  LogOut,
  CheckCircle2,
  Save,
  Volume1,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import { soundEffects } from "@/lib/sound-effects";

export default function AdminSettingsPage() {
  const router = useRouter();
  const {
    currentSession,
    lobbyData,
    toggleRegistration,
  } = useSocket("admin", "AdminSettingsView");

  const session = lobbyData?.session || currentSession;
  const isRegistrationOpen = session ? session.is_registration_open === 1 && session.status !== "registration_closed" : true;

  // Settings State
  const [defaultTimeLimit, setDefaultTimeLimit] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const savedTime = localStorage.getItem("cqb_setting_default_time");
      if (savedTime) return Number(savedTime);
    }
    return 25;
  });
  const [correctPoints, setCorrectPoints] = useState<number>(100);
  const incorrectPoints = 0;
  const unansweredPoints = 0;
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedAudio = localStorage.getItem("cqb_sound_effects");
      if (savedAudio !== null) return savedAudio === "true";
    }
    return true;
  });
  const [autoProjectorContrast] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedContrast = localStorage.getItem("cqb_setting_projector_contrast");
      if (savedContrast !== null) return savedContrast === "true";
    }
    return true;
  });

  // Security Session State
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Load admin user info
  useEffect(() => {
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("cqb_setting_default_time", defaultTimeLimit.toString());
      localStorage.setItem("cqb_sound_effects", isAudioEnabled ? "true" : "false");
      localStorage.setItem("cqb_setting_projector_contrast", autoProjectorContrast ? "true" : "false");
    }

    soundEffects.setEnabled(isAudioEnabled);
    setSavedNotification("Configuration saved successfully!");
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const handleTestSound = () => {
    soundEffects.setEnabled(true);
    soundEffects.playQuizStart();
  };

  const handleToggleRegistration = () => {
    if (!session) return;
    toggleRegistration(session.id, !isRegistrationOpen);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {}
    router.replace("/admin/login");
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Settings className="h-4 w-4" />
            <span>Game Rules & System Configuration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Game Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure default quiz timers, scoring guidelines, audio cues, and administrative session security.
          </p>
        </div>

        {savedNotification && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in duration-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{savedNotification}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Question Timer & Scoring */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-400" />
              Quiz Scoring & Default Timer
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rules apply to upcoming quiz questions. Existing recorded scores are never altered retroactively.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Question Time Limit */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Default Question Time Limit
              </label>
              <div className="flex items-center gap-3">
                {[15, 20, 25, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDefaultTimeLimit(sec)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition border ${
                      defaultTimeLimit === sec
                        ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Applied automatically when creating new questions. Individual questions can override this value.
              </p>
            </div>

            {/* Points per Correct Answer */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Points per Correct Answer
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={correctPoints}
                  onChange={(e) => setCorrectPoints(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-medium">Default: +100 points</span>
              </div>
            </div>

            {/* Points for Incorrect Answer */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Points for Incorrect Answer
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={incorrectPoints}
                  disabled
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-mono text-slate-400 font-bold cursor-not-allowed opacity-80"
                />
                <span className="text-xs text-slate-400 font-medium">0 points (Standard tournament rule)</span>
              </div>
            </div>

            {/* Points for Unanswered */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Points for Unanswered Question
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={unansweredPoints}
                  disabled
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-mono text-slate-400 font-bold cursor-not-allowed opacity-80"
                />
                <span className="text-xs text-slate-400 font-medium">0 points (No penalty)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Registration & Sound Effects */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-indigo-400" />
              Registration & Audio Feedback
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Controls live tournament admission and synthesizer audio cues generated in the browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Registration Availability Toggle */}
            <div className="flex items-start justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="space-y-1 pr-4">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  {isRegistrationOpen ? (
                    <Unlock className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Lock className="h-4 w-4 text-rose-400" />
                  )}
                  Student Team Registration
                </h3>
                <p className="text-[11px] text-slate-400">
                  Allow mobile students to scan the QR code and submit new team registrations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleRegistration}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  isRegistrationOpen
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {isRegistrationOpen ? "OPEN" : "CLOSED"}
              </button>
            </div>

            {/* Synthesized Sound Effects Toggle */}
            <div className="flex items-start justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="space-y-1 pr-4">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  {isAudioEnabled ? (
                    <Volume2 className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-slate-500" />
                  )}
                  Synthesized Sound Effects
                </h3>
                <p className="text-[11px] text-slate-400">
                  Audio tones for countdown ticks, quiz activation, and clincher tie-breakers. 100% offline.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  title="Test Web Audio Chime"
                >
                  <Volume1 className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    isAudioEnabled
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isAudioEnabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Administrator Security & Session */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              Admin Session & Offline Security
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Server-enforced session credentials stored in local SQLite database.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Current Admin Account
              </span>
              <div className="text-white font-mono font-bold text-sm">
                {user ? user.username : "admin"}
              </div>
              <p className="text-[11px] text-slate-500">
                Encrypted via native scrypt with a unique 32-byte cryptographic salt.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Session Cookie Policy
              </span>
              <div className="text-emerald-400 font-mono font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                HttpOnly &bull; SameSite=Lax &bull; 8h Expiry
              </div>
              <p className="text-[11px] text-slate-500">
                Credentials are never exposed to browser scripts or stored in localStorage.
              </p>
            </div>
          </div>

          {/* Sign Out Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              End your administrator session and return to the login screen:
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-bold transition"
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoggingOut ? "Signing out..." : "Sign Out of Admin"}</span>
            </button>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition active:scale-95"
          >
            <Save className="h-4 w-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
