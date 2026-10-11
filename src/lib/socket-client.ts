"use client";

import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket";

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (typeof window === "undefined") {
    return null as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;
  }

  if (!socketInstance) {
    // Explicitly connect to the origin the phone loaded the page from (e.g. http://192.168.1.6:3000)
    const targetUrl = window.location.origin;

    socketInstance = io(targetUrl, {
      // Polling first ensures instant mobile connection, then automatically upgrades to WebSocket
      transports: ["polling", "websocket"],
      withCredentials: true,
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });
  }

  return socketInstance;
}

export function reconnectSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance.connect();
    return socketInstance;
  }
  return getSocket();
}
