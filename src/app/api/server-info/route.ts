import { NextResponse } from "next/server";
import { getSortedNetworkInterfaces, getPrimaryIpAddress } from "@/lib/network";

export async function GET() {
  const interfaces = getSortedNetworkInterfaces();
  const primaryIp = getPrimaryIpAddress();
  const port = process.env.PORT || "3000";

  return NextResponse.json({
    status: "ok",
    appName: "Classroom Quiz Battle",
    serverIp: primaryIp,
    interfaces,
    port: parseInt(port, 10),
    url: `http://${primaryIp}:${port}`,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
}
