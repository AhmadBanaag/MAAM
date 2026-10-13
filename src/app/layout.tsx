import type { Metadata } from "next";
import "./globals.css";
import { SocketProvider } from "@/providers/socket-provider";

export const metadata: Metadata = {
  title: "Classroom Quiz Battle - Local Multiplayer",
  description:
    "Real-time local-network multiplayer quiz competition for university classroom presentations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
