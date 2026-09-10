import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = unauth, object = authed

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("misbah_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, refresh: load, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
