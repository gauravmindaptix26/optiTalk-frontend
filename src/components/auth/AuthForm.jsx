import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  ArrowRight,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const featurePills = [
  "Realtime messaging",
  "Private rooms",
  "Auth0 protected access",
];

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const {
    isLoading,
    isAuthenticated,
    error,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  const dbConnection = import.meta.env.VITE_AUTH0_DB_CONNECTION;
  const googleConnection =
    import.meta.env.VITE_AUTH0_GOOGLE_CONNECTION ?? "google-oauth2";
  const logoutReturnTo =
    import.meta.env.VITE_AUTH0_LOGOUT_REDIRECT ||
    import.meta.env.VITE_AUTH0_REDIRECT_URI ||
    window.location.origin;

  const login = () =>
    loginWithRedirect({
      authorizationParams: dbConnection ? { connection: dbConnection } : {},
      appState: { returnTo: "/chat" },
    });

  const signupWithDb = () =>
    loginWithRedirect({
      authorizationParams: {
        screen_hint: "signup",
        ...(dbConnection ? { connection: dbConnection } : {}),
      },
      appState: { returnTo: "/chat" },
    });

  const loginWithGoogle = () =>
    loginWithRedirect({
      authorizationParams: { connection: googleConnection },
      appState: { returnTo: "/chat" },
    });

  const auth0Logout = () =>
    logout({
      logoutParams: { returnTo: logoutReturnTo },
    });

  return (
    <section className="relative flex min-h-full flex-col justify-between border-b border-white/10 px-5 py-6 sm:px-8 sm:py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10 xl:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.06),transparent_28%)]" />

      <div className="relative">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_45%,#2563eb_100%)] text-white shadow-[0_18px_34px_rgba(14,165,233,0.24)]">
              <MessageCircleMore className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-white">
                Pulse Chat
              </div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/65">
                Luxury messaging workspace
              </div>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">
            Secure access
          </div>
        </div>

        <div className="premium-card rounded-[1.85rem] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm text-cyan-100/72">
            <Sparkles className="h-4 w-4" />
            Premium collaboration suite
          </div>

          <h1 className="font-display mt-4 text-[2rem] font-semibold leading-tight text-white sm:text-[2.35rem]">
            {isAuthenticated
              ? `Welcome${user?.name ? `, ${user.name}` : ""}`
              : isLogin
                ? "Sign in to your premium chat workspace"
                : "Create your private collaboration account"}
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300/84">
            Access a polished real-time chat experience with modern rooms,
            message search, groups, and secure identity powered by Auth0.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {featurePills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200/82"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_42%,#2563eb_100%)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(14,165,233,0.24)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={
                isAuthenticated ? auth0Logout : isLogin ? login : signupWithDb
              }
              disabled={isLoading}
              type="button"
            >
              <span>
                {isLoading
                  ? "Loading..."
                  : isAuthenticated
                    ? "Logout"
                    : isLogin
                      ? "Sign In"
                      : "Create Account"}
              </span>
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>

            {!isAuthenticated && (
              <button
                className="inline-flex w-full items-center justify-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={loginWithGoogle}
                disabled={isLoading}
                type="button"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900">
                  G
                </span>
                Continue with Google
              </button>
            )}
          </div>

          {!isAuthenticated && (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-[1.2rem] border border-white/10 bg-black/16 px-4 py-3">
              <div className="text-sm text-slate-300/82">
                {isLogin ? "New to Pulse?" : "Already using Pulse?"}
              </div>
              <button
                className="text-sm font-medium text-cyan-100 transition hover:text-white"
                onClick={() => setIsLogin(!isLogin)}
                type="button"
              >
                {isLogin ? "Create account" : "Back to sign in"}
              </button>
            </div>
          )}

          {error && !isAuthenticated && (
            <div className="mt-4 rounded-[1.15rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Error: {error.message}
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
        <div className="premium-card rounded-[1.4rem] p-4">
          <ShieldCheck className="h-5 w-5 text-cyan-200" />
          <div className="mt-3 text-sm font-semibold text-white">
            Protected sign-in
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-300/76">
            Auth0 handles your secure login and session flow.
          </div>
        </div>
        <div className="premium-card rounded-[1.4rem] p-4">
          <LockKeyhole className="h-5 w-5 text-cyan-200" />
          <div className="mt-3 text-sm font-semibold text-white">
            Private by default
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-300/76">
            Use direct chats, premium group spaces, and protected rooms.
          </div>
        </div>
        <div className="premium-card rounded-[1.4rem] p-4">
          <MessageCircleMore className="h-5 w-5 text-cyan-200" />
          <div className="mt-3 text-sm font-semibold text-white">
            Realtime delivery
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-300/76">
            Presence, attachments, and message actions stay synced.
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuthForm;
