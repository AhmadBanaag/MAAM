"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Shield,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Server,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const rawTarget = searchParams.get("redirect") || "/admin";
  const redirectTarget = rawTarget.startsWith("/admin/login") ? "/admin" : rawTarget;
  const hasExplicitRedirect = Boolean(searchParams.get("redirect"));

  const [isLoading, setIsLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Rate Limiting State
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);

  // Check auth and setup status on mount
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
        setHasAdmin((prev) => (prev !== null ? prev : true));
      }
    }, 3000);

    async function checkStatus() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch("/api/admin/auth/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("Status check failed");
        const data = await res.json();

        if (!isMounted) return;

        // If already authenticated and not bouncing from an explicit redirection
        if (data.isAuthenticated && !hasExplicitRedirect) {
          window.location.href = redirectTarget;
          return;
        }

        setHasAdmin(Boolean(data.hasAdmin));
        setIsLoading(false);
      } catch (err) {
        console.error("Auth status error:", err);
        if (isMounted) {
          setIsLoading(false);
          setHasAdmin(true); // fallback to login form
        }
      } finally {
        clearTimeout(safetyTimer);
      }
    }

    checkStatus();
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [hasExplicitRedirect, redirectTarget]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutRemaining || lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          setErrorMessage(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim()) {
      setErrorMessage("Please enter an administrator username.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter a password.");
      return;
    }

    // Initial Setup Mode validation
    if (hasAdmin === false) {
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters long for security.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please verify and try again.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const endpoint = hasAdmin === false ? "/api/admin/auth/setup" : "/api/admin/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          setLockoutRemaining(data.retryAfter);
        }
        setErrorMessage(data.error || "Authentication failed. Please check your credentials.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        hasAdmin === false
          ? "Administrator account initialized! Redirecting..."
          : "Access authorized. Loading dashboard..."
      );

      // Successfully authenticated: navigate to requested destination
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Connection error: ${msg}. Make sure the local server is running.`);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide text-slate-400">Verifying security configuration...</p>
        </div>
      </div>
    );
  }

  const isSetupMode = hasAdmin === false;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-slate-100">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-cyan-600/10 blur-3xl" />

      {/* Main Glass Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Header Badge */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${
              isSetupMode
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400 shadow-emerald-500/20 shadow-lg"
                : "border-indigo-500/30 bg-indigo-950/40 text-indigo-400 shadow-indigo-500/20 shadow-lg"
            }`}
          >
            {isSetupMode ? <Sparkles className="h-7 w-7" /> : <Shield className="h-7 w-7" />}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isSetupMode ? "Setup Administrator Account" : "Administrator Sign In"}
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {isSetupMode
              ? "Initial setup: Configure master credentials for this offline presentation server. No internet or cloud services required."
              : "Enter your presenter credentials to access the offline game control console."}
          </p>
        </div>

        {/* Status Banners */}
        {errorMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-200 shadow-inner">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">Access Denied</p>
              <p className="mt-0.5 leading-normal">{errorMessage}</p>
              {lockoutRemaining && (
                <div className="mt-1.5 flex items-center gap-1.5 font-medium text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Lockout active: wait {lockoutRemaining} seconds before retrying.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 shadow-inner">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="font-semibold">{successMessage}</p>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Username
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                disabled={isSubmitting || Boolean(lockoutRemaining)}
                placeholder="admin"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSetupMode ? "new-password" : "current-password"}
                disabled={isSubmitting || Boolean(lockoutRemaining)}
                placeholder={isSetupMode ? "Minimum 8 characters" : "••••••••"}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2.5 pr-10 pl-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Setup Mode only) */}
          {isSetupMode && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  placeholder="Re-type your password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || Boolean(lockoutRemaining)}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              isSetupMode
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/30"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-900/30"
            }`}
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{isSetupMode ? "Initialize & Open Dashboard" : "Sign In to Admin Dashboard"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Feature Badges */}
        <div className="mt-6 border-t border-slate-800/80 pt-4">
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="h-3 w-3 text-cyan-400" />
              100% Offline LAN
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-indigo-400" />
              HttpOnly Sessions
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-purple-400" />
              Scrypt Hashed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
