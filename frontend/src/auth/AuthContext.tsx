import React, {createContext, type ReactNode, useContext, useEffect, useState,} from "react";
import { extractErrorMessage } from "../shared/api/client";

type User = {
    id: string;
    email: string;
};

type TokenPair = {
    access_token: string;
    refresh_token: string;
    token_type?: string;
};

type AuthContextValue = {
    user: User | null;
    accessToken: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Props = {
    children: ReactNode;
};

export const AuthProvider: React.FC<Props> = ({children}) => {
    const [accessToken, setAccessToken] = useState<string | null>(() =>
        localStorage.getItem("access_token")
    );
    const [refreshToken, setRefreshToken] = useState<string | null>(() =>
        localStorage.getItem("refresh_token")
    );
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchMe = async () => {
            if (!accessToken) {
                setUser(null);
                setLoading(false);
                return;
            }
            try {
                const res = await fetch(`${API_URL}/users/me`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (res.status === 401 && refreshToken) {
                    const ok = await tryRefresh(refreshToken);
                    if (!ok) {
                        doLogout();
                        return;
                    }
                    const res2 = await fetch(`${API_URL}/users/me`, {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                        },
                    });
                    if (!res2.ok) throw new Error("Не удалось получить профиль после обновления токена");
                    const data2 = (await res2.json()) as User;
                    setUser(data2);
                    setLoading(false);
                    return;
                }

                if (!res.ok) {
                    throw new Error("Не удалось получить профиль");
                }

                const data = (await res.json()) as User;
                setUser(data);
            } catch (e) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        void fetchMe();
    }, [accessToken, refreshToken]);

    const saveTokens = (tokens: TokenPair) => {
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
    };

    const tryRefresh = async (refresh: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({refresh_token: refresh}),
            });
            if (!res.ok) {
                return false;
            }
            const data = (await res.json()) as TokenPair;
            saveTokens(data);
            return true;
        } catch {
            return false;
        }
    };

    const login = async (email: string, password: string) => {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);

        const res = await fetch(`${API_URL}/auth/token`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: form.toString(),
        });

        if (!res.ok) {
            throw new Error(await extractErrorMessage(res));
        }

        const data = (await res.json()) as TokenPair;
        saveTokens(data);

        // сразу подтянем юзера
        const meRes = await fetch(`${API_URL}/users/me`, {
            headers: {Authorization: `Bearer ${data.access_token}`},
        });
        const meData = (await meRes.json()) as User;
        setUser(meData);
    };

    const register = async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email, password}),
        });
        if (!res.ok) {
            throw new Error(await extractErrorMessage(res));
        }
        // после регистрации можно сразу логинить
        await login(email, password);
    };

    const doLogout = () => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
    };

    const logout = () => {
        doLogout();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                loading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth должен использоваться внутри AuthProvider");
    }
    return ctx;
};
