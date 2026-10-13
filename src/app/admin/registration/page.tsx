"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Copy,
  Check,
  Download,
  Wifi,
  Lock,
  Unlock,
  Users,
  ShieldCheck,
  ArrowRight,
  Smartphone,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { copyToClipboard as copyText } from "@/lib/utils";

interface NetworkInterfaceItem {
  name: string;
  address: string;
  isVirtual: boolean;
  priority: number;
}

export default function AdminRegistrationPage() {
  const mounted = useIsMounted();
  const {
    currentSession,
    lobbyData,
    serverIp,
    toggleRegistration,
  } = useSocket("admin", "Admin");

  const [copied, setCopied] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string>("");
  const [customIp, setCustomIp] = useState<string>("");
  const [interfaces, setInterfaces] = useState<NetworkInterfaceItem[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/server-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.interfaces && Array.isArray(data.interfaces)) {
          setInterfaces(data.interfaces);
        }
        if (!selectedIp && data.serverIp) {
          setSelectedIp(data.serverIp);
        }
      })
      .catch((err) => console.error("Error fetching network interfaces:", err));
  }, [selectedIp]);

  const candidateIp =
    customIp.trim() ||
    selectedIp ||
    serverIp ||
    (mounted && typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
      ? window.location.hostname
      : "192.168.1.6");

  const port = mounted && typeof window !== "undefined" && window.location.port ? window.location.port : "3000";

  const session = lobbyData?.session || currentSession;
  const registrationUrl = session
    ? `http://${candidateIp}:${port}/player/register?session=${session.id}`
    : `http://${candidateIp}:${port}/player/register`;

  const copyToClipboard = async () => {
    if (!registrationUrl) return;
    const ok = await copyText(registrationUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 600;
    canvas.height = 600;

    img.onload = () => {
      if (!ctx) return;
      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 40, 40, 520, 520);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `quiz-battle-qr-${session?.id || "join"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  const isRegistrationOpen = session ? session.is_registration_open === 1 && session.status !== "registration_closed" : true;
  const registeredCount = lobbyData?.registeredCount ?? 0;
  const maxTeams = lobbyData?.maxTeams ?? 5;
  const slotsRemaining = Math.max(0, maxTeams - registeredCount);
  const isFull = registeredCount >= maxTeams;

  const handleToggle = () => {
    if (!session) return;
    toggleRegistration(session.id, !isRegistrationOpen);
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <QrCode className="h-4 w-4" />
            <span>Classroom Join Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">QR Code Registration</h1>
          <p className="text-sm text-slate-400 mt-1">
            Project this screen onto the classroom projector. Students scan to register their 5 teams.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggle}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
              isRegistrationOpen
                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-rose-500/10"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-emerald-500/10"
            }`}
          >
            {isRegistrationOpen ? (
              <>
                <Lock className="h-4 w-4" />
                <span>Close Registration</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                <span>Reopen Registration</span>
              </>
            )}
          </button>

          <Link
            href="/admin/teams"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/20"
          >
            <span>View Teams</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Main Grid: QR Left, Slots & Info Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Big Projector QR Card */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-8 shadow-2xl relative overflow-hidden text-center">
          {/* Subtle glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Registration Status Pill */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold border shadow-sm">
            {isFull ? (
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Lobby Full ({registeredCount} / {maxTeams})
              </span>
            ) : isRegistrationOpen ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Registration Open ({slotsRemaining} slots remaining)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Registration Closed
              </span>
            )}
          </div>

          {/* High Res QR Box */}
          <div
            ref={qrRef}
            className="p-5 rounded-3xl bg-white shadow-2xl shadow-indigo-500/10 border-4 border-white inline-block transition-transform hover:scale-[1.02]"
          >
            {mounted && session ? (
              <QRCodeSVG
                value={registrationUrl}
                size={240}
                level="H"
                includeMargin={false}
              />
            ) : (
              <div className="w-[240px] h-[240px] bg-slate-200 animate-pulse rounded-2xl flex items-center justify-center text-slate-500 text-xs">
                Generating QR...
              </div>
            )}
          </div>

          {/* Instruction */}
          <div className="mt-5 space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-400" />
              Scan with Smartphone Camera
            </h2>
            <p className="text-xs text-slate-400 max-w-sm">
              Connect to the presentation Wi-Fi and scan this code to choose your team name and enter the lobby.
            </p>
          </div>

          {/* Copyable URL Bar */}
          <div className="mt-5 w-full max-w-md rounded-xl bg-slate-950/80 border border-slate-800 p-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-emerald-400 truncate pl-2 select-all font-medium">
              {mounted ? registrationUrl : "Generating URL..."}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                title="Copy Registration URL"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition"
                title="Download QR code image for print or slides"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PNG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Roster & Network Configuration */}
        <div className="lg:col-span-6 space-y-6">
          {/* Registered Teams Summary Card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Live Registration Slots</h3>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                {registeredCount} / {maxTeams} Teams
              </span>
            </div>

            {/* 5 Slots Cards */}
            <div className="space-y-2.5">
              {Array.from({ length: maxTeams }).map((_, idx) => {
                const slotNum = idx + 1;
                const team = lobbyData?.teams.find((t) => t.slotNumber === slotNum);

                if (team) {
                  return (
                    <div
                      key={team.id}
                      className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-xs shadow"
                          style={{ backgroundColor: team.color || "#6366f1" }}
                        >
                          #{slotNum}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{team.name}</span>
                            <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" title="Connected" />
                          </div>
                          <div className="text-[11px] text-slate-400">Leader: {team.leaderName}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          Registered
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`slot-${slotNum}`}
                    className="flex items-center justify-between rounded-xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-slate-800 text-slate-600 font-bold text-xs">
                        #{slotNum}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-400">Slot {slotNum}: Available</div>
                        <div className="text-[11px] text-slate-600">Waiting for team to register...</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-medium text-slate-500">Open Slot</span>
                  </div>
                );
              })}
            </div>

            {/* Quick status notice */}
            {isFull && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-xs text-emerald-300">
                <span className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  All 5 teams registered! Ready to start presentation.
                </span>
                <Link
                  href="/admin"
                  className="font-bold underline hover:text-white"
                >
                  Start Game →
                </Link>
              </div>
            )}
          </div>

          {/* Network Adapter Configuration Card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">LAN Network Configuration</h3>
              </div>
              <span className="text-[11px] text-slate-500">Offline Wi-Fi Mode</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If student phones cannot connect, verify that all devices are connected to the same local Wi-Fi or mobile hotspot. Select the primary Wi-Fi IP address below:
            </p>

            {/* Interface selector pills */}
            {interfaces.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Detected Network Adapters:
                </span>
                <div className="flex flex-wrap gap-2">
                  {interfaces.map((iface) => {
                    const isSelected = candidateIp === iface.address;
                    return (
                      <button
                        key={`${iface.name}-${iface.address}`}
                        type="button"
                        onClick={() => {
                          setSelectedIp(iface.address);
                          setCustomIp("");
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition border ${
                          isSelected
                            ? "bg-indigo-600 text-white font-bold border-indigo-400 shadow-md shadow-indigo-600/30"
                            : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
                        }`}
                      >
                        <Wifi className="h-3 w-3" />
                        <span>{iface.name}:</span>
                        <span className="font-bold">{iface.address}</span>
                        {iface.isVirtual && <span className="text-[9px] text-amber-400 font-sans">(Virtual)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Detecting LAN network interfaces...</div>
            )}

            {/* Custom IP Override */}
            <div className="pt-2 border-t border-slate-800/80">
              <label htmlFor="custom-ip" className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Manual LAN IP Override (Optional):
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-ip"
                  type="text"
                  placeholder="e.g. 192.168.1.15"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                {customIp && (
                  <button
                    type="button"
                    onClick={() => setCustomIp("")}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
