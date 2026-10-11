"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone,
  Copy,
  Check,
  Radio,
  ExternalLink,
  Wifi,
  AlertTriangle,
} from "lucide-react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { copyToClipboard as copyText } from "@/lib/utils";

interface NetworkInterfaceItem {
  name: string;
  address: string;
  isVirtual: boolean;
  priority: number;
}

interface NetworkInfoCardProps {
  serverIp?: string | null;
  port?: number;
  sessionId?: string;
}

export function NetworkInfoCard({ serverIp, port = 3000, sessionId }: NetworkInfoCardProps) {
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

  // Compute active IP
  const activeIp =
    selectedIp ||
    serverIp ||
    (mounted && typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "192.168.1.6");

  const currentPort =
    mounted && typeof window !== "undefined" && window.location.port
      ? window.location.port
      : port.toString();

  const sessionQuery = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
  const detectedUrl = `http://${activeIp}:${currentPort}/player${sessionQuery}`;

  const copyToClipboard = async () => {
    if (!detectedUrl) return;
    const ok = await copyText(detectedUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 p-6 shadow-xl relative overflow-hidden space-y-5">
      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* QR Code container */}
        <div className="bg-white p-3.5 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center min-w-[172px] min-h-[172px]">
          {mounted ? (
            <QRCodeSVG
              value={detectedUrl}
              size={144}
              level="M"
              includeMargin={false}
            />
          ) : (
            <div className="w-[144px] h-[144px] bg-slate-200 animate-pulse rounded" />
          )}
        </div>

        {/* Network instructions and URL display */}
        <div className="flex-1 space-y-3 text-center md:text-left w-full">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Local Wi-Fi Player Portal</span>
          </div>

          <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            Connect Team Smartphones
          </h3>

          <p className="text-sm text-slate-400">
            Connect team phones to the same Wi-Fi network and scan this QR code or navigate to:
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
            <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-sm text-emerald-400 select-all font-semibold">
              {mounted ? detectedUrl : `http://${activeIp}:${port}/player`}
            </div>

            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              title="Copy URL"
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

            <a
              href="/player"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Player View</span>
            </a>
          </div>

          {/* Network Adapter Selector if multiple adapters exist */}
          {mounted && interfaces.length > 1 && (
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              <span className="text-slate-500 font-medium">Network Adapter:</span>
              {interfaces.map((iface) => (
                <button
                  key={`${iface.name}-${iface.address}`}
                  onClick={() => setSelectedIp(iface.address)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
                    activeIp === iface.address
                      ? "bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/20"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <Wifi className="w-3 h-3" />
                  <span>
                    {iface.name}: {iface.address}
                  </span>
                  {iface.isVirtual && (
                    <span className="text-[10px] text-amber-400 opacity-80">(Virtual)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Troubleshooting Alert Box */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-300">Troubleshooting Phone Connections:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-400">
            <li>
              Make sure the phone connects to{" "}
              <strong className="text-emerald-400">http://192.168.1.6:3000</strong> (Wi-Fi), NOT
              virtual adapters like 192.168.56.1.
            </li>
            <li>
              If connection takes long or times out, verify your Wi-Fi profile is set to Private
              in Windows Settings.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
