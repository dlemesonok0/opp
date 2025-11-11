import React, {createContext, type ReactNode, useContext, useEffect, useState,} from "react";

type User = {
    id: string;
    email: string;
};

type AuthContextValue = {
    token: string | null;
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type AuthProviderProps = {
    children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem("access_token")
    );
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(!!token);

    useEffect(() => {
        const fetchMe = async () => {
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }
            try {
                const res = await fetch(`${API_URL}/users/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!res.ok) {
                    throw new Error("unauthorized");
                }
                const data = (await res.json()) as User;
                setUser(data);
            } catch (e) {
                // токен невалиден — выкидываем
                setUser(null);
                setToken(null);
                localStorage.removeItem("access_token");
            } finally {
                setLoading(false);
            }
        };

        void fetchMe();
    }, [token]);

    const login = async (email: string, password: string) => {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);

        const res = await fetch(`${API_URL}/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });

        if (!res.ok) {
            throw new Error("Неверный email или пароль");
        }

        const data = await res.json();
        const accessToken = data.access_token as string;

        localStorage.setItem("access_token", accessToken);
        setToken(accessToken);

        const meRes = await fetch(`${API_URL}/users/me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const meData = (await meRes.json()) as User;
        setUser(meData);
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{token, user, loading, login, logout}}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
};
