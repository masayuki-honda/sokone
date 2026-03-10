import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { config } from "./config";
import {
  saveToken,
  saveUser,
  getUser,
  getToken,
  clearAuthData,
  type StoredUser,
} from "./auth-storage";
import { setOnUnauthorized } from "./api";

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: StoredUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  // Google OAuth request
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.googleClientId,
      scopes: ["openid", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri({ scheme: "sokone" }),
    },
    discovery,
  );

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([getUser(), getToken()]);
        if (storedUser && storedToken) {
          setUser(storedUser);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Register 401 handler — auto-logout when token expires
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === "success" && response.authentication?.accessToken) {
      handleGoogleToken(response.authentication.accessToken);
    }
  }, [response]);

  const handleGoogleToken = async (googleAccessToken: string) => {
    try {
      setIsLoading(true);
      // Exchange Google access token for our backend session token
      const res = await fetch(`${config.apiBaseUrl}/api/auth/mobile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: googleAccessToken }),
      });

      if (!res.ok) {
        throw new Error("認証に失敗しました");
      }

      const data = await res.json();
      await saveToken(data.token);
      const userData: StoredUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image,
      };
      await saveUser(userData);
      setUser(userData);
    } catch (error) {
      console.error("Auth error:", error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async () => {
    if (!request) return;
    await promptAsync();
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    await clearAuthData();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
