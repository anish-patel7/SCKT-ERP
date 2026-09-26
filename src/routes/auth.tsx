import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { signInWithPassword } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    // Redirect authenticated users to dashboard
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      throw redirect({
        to: "/",
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Chehar Krupa Group of Industries" },
      {
        name: "description",
        content:
          "Sign in to Chehar Krupa Group of Industries Textile Production & Management System.",
      },
      { property: "og:title", content: "Chehar Krupa Group — Textile Production System" },
      {
        property: "og:description",
        content:
          "Integrated platform for managing textile production, costing, inventory, quality, sales and business operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const SIGN_IN_TIMEOUT_MS = 20_000;
const BUILD_ID: string = import.meta.env["VITE_BUILD_ID"] ?? "dev";

function supabaseHost(): string {
  try {
    return new URL(String(import.meta.env["VITE_SUPABASE_URL"] ?? "")).host || "unknown";
  } catch {
    return "unknown";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function describeAuthError(error: { message: string; code?: string | undefined }): string {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "This email address is not confirmed yet. Confirm it from the invitation email, or ask an administrator to confirm the user in Supabase (Authentication → Users).";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Cannot reach the authentication server. Check your connection and try again.";
  }
  return `Authentication failed: ${error.message}`;
}

function AuthPage() {
  const navigate = useNavigate();

  // Active View State: "signin" | "request"
  const [activeTab, setActiveTab] = useState<"signin" | "request">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  // Card Zoom State (Applies only to sign-in card)
  // Unauthenticated users: use localStorage as fallback
  const [cardScale, setCardScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = parseFloat(localStorage.getItem("ck_card_zoom") || "");
    return saved >= 0.6 && saved <= 2.2 ? saved : 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ck_card_zoom", String(cardScale));
    } catch (_) {}
  }, [cardScale]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setCardScale((prev) => {
        const delta = e.deltaY < 0 ? 0.06 : -0.06;
        return Math.min(2.2, Math.max(0.6, prev + delta));
      });
    };

    const handleKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setCardScale((prev) => Math.min(2.2, prev + 0.1));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setCardScale((prev) => Math.max(0.6, prev - 0.1));
      } else if (e.key === "0") {
        e.preventDefault();
        setCardScale(1);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Sign In State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const fail = (message: string) => {
    setSignInError(message);
    toast.error(message);
    setBusy(false);
  };

  const signIn = async () => {
    setSignInError(null);
    if (!email || !password) {
      fail("Please enter email address and password");
      return;
    }
    if (!isSupabaseConfigured()) {
      fail(
        "Sign-in is unavailable: this deployment has no Supabase configuration (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).",
      );
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await withTimeout(
        signInWithPassword(email.trim().toLowerCase(), password),
        SIGN_IN_TIMEOUT_MS,
        `No response from the authentication server (${supabaseHost()}) after ${SIGN_IN_TIMEOUT_MS / 1000}s.`,
      );

      if (error) {
        fail(describeAuthError(error));
        return;
      }

      if (!data?.session) {
        fail("Sign in failed: no session was created. Please try again.");
        return;
      }

      // Profile creation is owned by the signup trigger and access is resolved per route,
      // so a failed lookup here is reported but never blocks the sign-in.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("Profile lookup failed after sign-in:", profileError);
      } else if (!profile) {
        toast.warning(
          "Signed in, but no profile exists for this account yet. Ask an administrator to check it.",
        );
      }

      toast.success("Signed in successfully!");
      await navigate({ to: "/" });
    } catch (err) {
      fail(`Sign in failed: ${err instanceof Error ? err.message : "unexpected error"}`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        fontFamily: "'Poppins', sans-serif",
        background: "#0d1829",
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0 }} className="flex-col lg:flex-row">
        {/* ========================================================================= */}
        {/* LEFT PANEL (100% Exact Copy from Login page design code/Login Page.dc.html) */}
        {/* ========================================================================= */}
        <div
          style={{
            width: "50%",
            position: "relative",
            background: "#0d1829",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 60px 40px",
          }}
          className="w-full lg:w-1/2"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=80') center/cover no-repeat",
              opacity: 0.15,
            }}
          ></div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, rgba(13,24,41,0.95) 0%, rgba(13,24,41,0.82) 50%, rgba(13,24,41,0.92) 100%)",
            }}
          ></div>

          <div style={{ position: "relative", zIndex: 1, alignSelf: "center" }}>
            {/* Logo row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "22px",
                marginBottom: "52px",
                alignSelf: "center",
                textAlign: "center",
                marginRight: "0px",
                justifyContent: "center",
              }}
            >
              <img
                src="/ck-logo.png"
                alt="Chehar Krupa"
                style={{
                  width: "clamp(84px, 9vw, 148px)",
                  height: "auto",
                  display: "block",
                  flexShrink: 0,
                  alignSelf: "center",
                  textAlign: "center",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "clamp(22px, 2.45vw, 40px)",
                    fontWeight: 800,
                    color: "#d5aa4d",
                    letterSpacing: "clamp(1.5px, 0.18vw, 3px)",
                    lineHeight: 1.05,
                    paddingBottom: "6px",
                    borderBottom: "2.5px solid #d5aa4d",
                    whiteSpace: "nowrap",
                    alignSelf: "center",
                    textAlign: "center",
                  }}
                >
                  CHEHAR KRUPA
                </div>
                <div
                  style={{
                    fontSize: "clamp(10px, 1.05vw, 17px)",
                    fontWeight: 500,
                    color: "#ffffff",
                    letterSpacing: "clamp(4px, 0.52vw, 8.5px)",
                    lineHeight: 1,
                    paddingTop: "8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  GROUP OF INDUSTRIES
                </div>
              </div>
            </div>

            <h1
              style={{
                fontSize: "40px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.18,
                letterSpacing: "1.5px",
                maxWidth: "6000px",
                textAlign: "center",
              }}
            >
              TEXTILE PRODUCTION
              <br />
              &amp;&nbsp;
              <br />
              MANAGEMENT SYSTEM
            </h1>

            <div
              style={{ width: "52px", height: "4px", background: "#c9a84e", margin: "28px 0 24px" }}
            ></div>

            <p
              style={{
                fontSize: "15.5px",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.75,
                maxWidth: "600px",
              }}
            >
              Integrated platform for managing textile production, costing, inventory, quality,
              sales and business operations.
            </p>

            {/* Feature grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "18px 48px",
                marginTop: "40px",
                maxWidth: "500px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Production Management
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M8 12l3 3 5-5"></path>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Quality Control
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <path d="M3 9h18M9 3v18"></path>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Design &amp; Costing
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <rect x="2" y="7" width="15" height="10" rx="1.5"></rect>
                    <path d="M17 10l5 2.5L17 15"></path>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Sales &amp; Dispatch
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
                    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"></path>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Inventory Management
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    minWidth: "46px",
                    borderRadius: "10px",
                    background: "rgba(201,168,78,0.1)",
                    border: "1px solid rgba(201,168,78,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c9a84e"
                    strokeWidth="1.6"
                  >
                    <path d="M18 20V10M12 20V4M6 20v-6"></path>
                  </svg>
                </div>
                <span
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}
                >
                  Reports &amp; Analytics
                </span>
              </div>
            </div>
          </div>

          {/* Left Footer Security Tag */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: "24px",
                marginTop: "36px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "18px",
                  flexDirection: "column",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9a84e"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                  <path d="M7 11V7a5 5 0 0110 0v4"></path>
                </svg>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#c9a84e",
                    letterSpacing: "2.5px",
                    textAlign: "center",
                  }}
                >
                  INTERNAL USE ONLY
                </span>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.35)",
                  lineHeight: 1.6,
                  textAlign: "center",
                }}
              >
                © 2024 Chehar Krupa Group of Industries.
                <br />
                All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL (100% Exact Copy from Login page design code/Login Page.dc.html) */}
        {/* ========================================================================= */}
        <div
          style={{
            width: "50%",
            position: "relative",
            background: "#d8dbe1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
          }}
          className="w-full lg:w-1/2"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=80') center/cover no-repeat",
              opacity: 0.06,
            }}
          ></div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(220,223,230,0.95) 0%, rgba(210,213,220,0.98) 100%)",
            }}
          ></div>

          {/* Login Card */}
          <div
            data-signin-card="1"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: "424px",
              background: "#ffffff",
              borderRadius: "18px",
              padding: "36px 36px 28px",
              boxShadow: "0 12px 48px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
              transform: `scale(${cardScale})`,
              transformOrigin: "center center",
              transition: "transform 0.12s ease-out",
              willChange: "transform",
            }}
          >
            {/* Card Logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <img
                src="/ck-logo.png"
                alt="Chehar Krupa"
                style={{ width: "82px", height: "auto", display: "block" }}
              />
              <div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#1a2a3e",
                    letterSpacing: "1.5px",
                    lineHeight: 1.05,
                    paddingBottom: "3px",
                    borderBottom: "1.5px solid #1a2a3e",
                    whiteSpace: "nowrap",
                  }}
                >
                  CHEHAR KRUPA
                </div>
                <div
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 500,
                    color: "#1a2a3e",
                    letterSpacing: "4.5px",
                    lineHeight: 1,
                    paddingTop: "4px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  GROUP OF INDUSTRIES
                </div>
              </div>
            </div>

            <h2
              style={{
                textAlign: "center",
                fontSize: "15px",
                fontWeight: 700,
                color: "#1a2a3e",
                letterSpacing: "2.5px",
                marginBottom: "6px",
              }}
            >
              TEXTILE PRODUCTION SYSTEM
            </h2>
            <div
              style={{
                width: "62px",
                height: "2.5px",
                background: "#c9a84e",
                margin: "12px auto 22px",
              }}
            ></div>
            <h3
              style={{
                textAlign: "center",
                fontSize: "24px",
                fontWeight: 700,
                color: "#1a2a3e",
                marginBottom: "4px",
              }}
            >
              {activeTab === "signin" ? "Welcome Back" : "Request Access"}
            </h3>
            <p
              style={{
                textAlign: "center",
                fontSize: "13px",
                color: "#8a8f9c",
                marginBottom: "28px",
              }}
            >
              {activeTab === "signin"
                ? "Sign in to the Textile Production System"
                : "Submit details for Admin authorization"}
            </p>

            {/* TAB 1: SIGN IN VIEW */}
            {activeTab === "signin" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn();
                }}
              >
                {/* Email */}
                <div style={{ marginBottom: "18px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#2a3040",
                      marginBottom: "7px",
                    }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a0a6b2"
                      strokeWidth="1.6"
                      style={{
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      style={{
                        width: "100%",
                        padding: "13px 14px 13px 42px",
                        border: "1px solid #e2e4ea",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontFamily: "Poppins, sans-serif",
                        color: "#1a2a3e",
                        background: "#f7f8fa",
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#2a3040",
                      marginBottom: "7px",
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a0a6b2"
                      strokeWidth="1.6"
                      style={{
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                      <path d="M7 11V7a5 5 0 0110 0v4"></path>
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{
                        width: "100%",
                        padding: "13px 44px 13px 42px",
                        border: "1px solid #e2e4ea",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontFamily: "Poppins, sans-serif",
                        color: "#1a2a3e",
                        background: "#f7f8fa",
                      }}
                    />
                    <svg
                      onClick={() => setShowPassword(!showPassword)}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a0a6b2"
                      strokeWidth="1.6"
                      style={{
                        position: "absolute",
                        right: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                      }}
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </div>
                </div>

                {signInError && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "14px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "#fdecec",
                      color: "#9b1c1c",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {signInError}
                  </div>
                )}

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "linear-gradient(135deg, #1a7d6a 0%, #14695a 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 600,
                    fontFamily: "Poppins, sans-serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  {busy ? "Signing in..." : "Sign In"}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                </button>

                {/* Divider */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "14px", margin: "18px 0" }}
                >
                  <div style={{ flex: 1, height: "1px", background: "#e2e4ea" }}></div>
                  <span style={{ fontSize: "13px", color: "#a0a6b2" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "#e2e4ea" }}></div>
                </div>

                {/* Links */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "6px 18px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1a7d6a",
                      cursor: "pointer",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1a7d6a"
                      strokeWidth="1.8"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                      <path d="M7 11V7a5 5 0 0110 0v4"></path>
                    </svg>
                    Forgot Password?
                  </button>
                  <div style={{ width: "1px", height: "18px", background: "#dfe1e6" }}></div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    style={{
                      background: "none",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "6px 18px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1a7d6a",
                      cursor: "pointer",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1a7d6a"
                      strokeWidth="1.8"
                    >
                      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Request Access
                  </button>
                </div>
              </form>
            )}

            <p
              style={{ marginTop: "10px", fontSize: "10px", color: "#9aa3b2", textAlign: "center" }}
            >
              Build {BUILD_ID} · {supabaseHost()}
            </p>

            {/* TAB 2: REQUEST ACCESS VIEW (WORKFLOW B) */}
            {activeTab === "request" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2 text-center">
                  <h3 className="font-bold text-amber-900 text-sm">
                    Self-service access requests are not available yet
                  </h3>
                  <p className="text-xs text-amber-800">
                    Accounts are provisioned by a System Administrator. Please contact your
                    administrator with your name, employee ID, department and the access you need.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("signin")}
                    className="mt-2 text-xs bg-[#1a7d6a] text-white rounded-lg"
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Zoom Reset Affordance */}
          {Math.abs(cardScale - 1) >= 0.01 && (
            <button
              type="button"
              onClick={() => setCardScale(1)}
              style={{
                position: "absolute",
                bottom: "18px",
                right: "20px",
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                gap: "7px",
                background: "#ffffff",
                border: "1px solid #d0d3da",
                borderRadius: "8px",
                padding: "7px 12px",
                fontFamily: "Poppins, sans-serif",
                fontSize: "11.5px",
                fontWeight: 500,
                color: "#5a6070",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 109-9 9 9 0 00-6.36 2.64L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              <span>{Math.round(cardScale * 100)}% (Reset)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM BAR (100% Exact Copy from Login page design code/Login Page.dc.html) */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: "1px solid #e8eaee",
        }}
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "20px 28px",
            borderRight: "1px solid #eaecf0",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1a7d6a"
            strokeWidth="1.4"
          >
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M8 12l3 3 5-5"></path>
          </svg>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a2a3e" }}>
              Secure &amp; Reliable
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8f9c" }}>Enterprise Grade Security</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "20px 28px",
            borderRight: "1px solid #eaecf0",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c9a84e"
            strokeWidth="1.4"
          >
            <ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>
            <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"></path>
            <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"></path>
          </svg>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a2a3e" }}>
              Real-time Data
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8f9c" }}>Accurate &amp; Up-to-date</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "20px 28px",
            borderRight: "1px solid #eaecf0",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1a7d6a"
            strokeWidth="1.4"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"></path>
          </svg>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a2a3e" }}>
              Integrated Operations
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8f9c" }}>End-to-End Automation</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px 28px" }}>
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c9a84e"
            strokeWidth="1.4"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"></path>
          </svg>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a2a3e" }}>
              Built for Performance
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8f9c" }}>Scalable &amp; Efficient</div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
        <DialogContent className="max-w-sm text-xs space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-[#1a7d6a]">
              <HelpCircle className="size-4" /> Password Recovery Assistance
            </DialogTitle>
            <DialogDescription className="text-xs">
              Contact your System Administrator or submit a support request.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs text-slate-800">
            <p>
              To reset your password, please contact the{" "}
              <strong>Chehar Krupa Group IT Admin</strong> or your department manager.
            </p>
            <div className="font-mono text-[0.6875rem] bg-white p-2 rounded border border-slate-200">
              Admin Contact: <span className="font-bold text-[#1a7d6a]">admin@sckt.com</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setForgotModalOpen(false)}
              className="h-8 text-xs bg-[#1a7d6a] text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
