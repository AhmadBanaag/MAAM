"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone,
  Copy,
  Check,
  Radio,
  Wifi,
  Lock,
  Unlock,
} from "lucide-react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { copyToClipboard as copyText } from "@/lib/utils";
import type { GameSession } from "@/lib/db";

interface AdminRegistrationQrProps {
  session: GameSession | null;
  serverIp: string | null;
  port?: number;
  onToggleRegistration: (isOpen: boolean) => void;
  registeredCount: number;
  maxTeams?: number;
}

interface NetworkInterfaceItem {
  name: string;
  address: string;
  isVirtual: boolean;
  priority: number;
}

export function AdminRegistrationQr({
  session,
  serverIp,
  port = 3000,
  onToggleRegistration,
  registeredCount,
  maxTeams = 5,
}: AdminRegistrationQrProps) {
  const mounted = useIsMounted();
  const [copied, setCopied] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string>("");
  const [interfaces, setInterfaces] = useState<NetworkInterfaceItem[]>([]);

  useEffect(() => {
    fetch("/api/server-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.interfaces && Array.isArray(data.interfaces)) {
          setInterfaces(data.interfaces);
        }
        setSelectedIp((prev) => prev || data.serverIp || "");
      })
      .catch((err) => console.error("Error fetching network interfaces:", err));
  }, []);

  // NEVER use localhost for smartphone QR code
  const candidateIp =
    selectedIp ||
    serverIp ||
    (mounted && typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
      ? window.location.hostname
      : "192.168.1.6");

  const actualPort =
    mounted && typeof window !== "undefined" && window.location.port
      ? window.location.port
      : port.toString();

  const registrationUrl = session
    ? `http://${candidateIp}:${actualPort}/player?session=${session.id}`
    : `http://${candidateIp}:${actualPort}/player`;

  const copyToClipboard = async () => {
    if (!registrationUrl) return;
    const ok = await copyText(registrationUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isRegistrationOpen = session ? session.is_registration_open === 1 && session.status !== "registration_closed" : true;
  const isFull = registeredCount >= maxTeams;

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 p-6 shadow-xl relative overflow-hidden space-y-5">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* QR Code Container */}
        <div className="bg-white p-3.5 rounded-2xl shadow-lg flex-shrink-0 flex items-center justify-center min-w-[172px] min-h-[172px]">
          {mounted && session ? (
            <QRCodeSVG
              value={registrationUrl}
              size={144}
              level="M"
              includeMargin={false}
            />
          ) : (
            <div className="w-[144px] h-[144px] bg-slate-200 animate-pulse rounded-lg" />
          )}
        </div>

        {/* Details & Controls */}
        <div className="flex-1 space-y-3.5 text-center md:text-left w-full">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Session: {session ? session.id : "Loading..."}</span>
            </span>

            {/* Registration Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isFull
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                  : isRegistrationOpen
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {isFull ? (
                <span>Lobby Full ({registeredCount}/{maxTeams})</span>
              ) : isRegistrationOpen ? (
                <span>Registration Open ({registeredCount}/{maxTeams})</span>
              ) : (
                <span>Registration Closed</span>
              )}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <Smartphone className="w-5 h-5 text-indigo-400" />
              Scan to Register Team
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Have 5 team leaders scan this QR code or navigate to the link on their smartphones to enter team and leader names.
            </p>
          </div>

          {/* Registration URL bar */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
            <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs md:text-sm text-emerald-400 select-all font-semibold break-all">
              {mounted ? registrationUrl : `http://${candidateIp}:${port}/player?session=...`}
            </div>

            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              title="Copy registration link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Toggle Registration Button */}
            {session && (
              <button
                onClick={() => onToggleRegistration(!isRegistrationOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isRegistrationOpen
                    ? "bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300"
                    : "bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300"
                }`}
              >
                {isRegistrationOpen ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Close Registration</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Reopen Registration</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Network Adapter Selector */}
          {mounted && interfaces.length > 1 && (
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              <span className="text-slate-500 font-medium">QR Network IP:</span>
              {interfaces.map((iface) => (
                <button
                  key={`${iface.name}-${iface.address}`}
                  onClick={() => setSelectedIp(iface.address)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 ${
                    candidateIp === iface.address
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <Wifi className="w-3 h-3" />
                  <span>{iface.name}: {iface.address}</span>
                  {iface.isVirtual && (
                    <span className="text-[9px] text-amber-400 opacity-80">(Virtual)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
