import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket, getSocket } from "../lib/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(() => {
    const raw = localStorage.getItem("ecosphere_employee");
    return raw ? JSON.parse(raw) : null;
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ecosphere_token");
    if (token && employee) {
      const socket = connectSocket(token);
      socket.on("notification", (n) => setNotifications((prev) => [n, ...prev]));
    }
    setLoading(false);
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ecosphere_token", data.token);
    localStorage.setItem("ecosphere_employee", JSON.stringify(data.employee));
    setEmployee(data.employee);
    const socket = connectSocket(data.token);
    socket.on("notification", (n) => setNotifications((prev) => [n, ...prev]));
    return data.employee;
  }

  function logout() {
    localStorage.removeItem("ecosphere_token");
    localStorage.removeItem("ecosphere_employee");
    disconnectSocket();
    setEmployee(null);
  }

  const value = {
    employee,
    isAdmin: employee?.role === "admin",
    loading,
    notifications,
    markNotificationRead: (id) =>
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}