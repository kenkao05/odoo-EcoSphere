import { io } from "socket.io-client";

let socket = null;

// Called once from AuthContext after login (and on app load if a token
// already exists). Re-calling with a new token replaces the connection —
// needed if a different employee logs in without a full page refresh.
export function connectSocket(token) {
  if (socket) socket.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:4000";
  socket = io(url, { auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}