"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  createBackendSession,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/firebaseAuth";
import { isFirebaseConfigured } from "@/lib/firebaseClient";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-not-found": "No matching account found.",
  "auth/wrong-password": "Incorrect password.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/popup-blocked": "Popup blocked. Allow popups and try again.",
  "auth/account-exists-with-different-credential":
    "Account exists with another sign-in method.",
  provider: "Unsupported sign-in provider.",
};

function resolveFirebaseError(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
      ? (error as { code: string }).code
      : null;
  const message =
    error instanceof Error && error.message
      ? error.message
      : null;
  const status =
    typeof error === "object" &&
    error &&
    "status" in error &&
    typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : null;
  if (status === 403) {
    return "This account is banned.";
  }
  if (code === "account_conflict") {
    return "Account exists with another sign-in method.";
  }
  return (
    (code && ERROR_MESSAGES[code]) ||
    message ||
    "Sign in failed. Please try again."
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const firebaseReady = isFirebaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSession = async (idToken: string) => {
    const result = await createBackendSession(idToken);
    if (result.needsGamertag) {
      const nextParam = searchParams?.get("next") || "/browse";
      window.location.href = `/complete-profile?next=${encodeURIComponent(
        nextParam
      )}`;
      return;
    }
    window.location.href = result.redirectTo ?? "/browse";
  };

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!firebaseReady) {
      setError("Firebase auth is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmail(email, password);
      const token = await credential.user.getIdToken();
      await handleSession(token);
    } catch (err) {
      setError(resolveFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProvider = async (
    action: () => Promise<{ user: { getIdToken(): Promise<string> } }>
  ) => {
    if (loading) return;
    if (!firebaseReady) {
      setError("Firebase auth is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await action();
      const token = await credential.user.getIdToken();
      await handleSession(token);
    } catch (err) {
      setError(resolveFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink/70">
        Use your email or a connected account to sign in.
      </p>

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          onClick={() => handleProvider(signInWithGoogle)}
          disabled={loading || !firebaseReady}
          className="w-full rounded-sm border border-ink/20 bg-mist px-4 py-2 text-sm font-semibold text-ink hover:border-ink/40"
        >
          Continue with Google
        </button>
      </div>

      <form
        onSubmit={handleEmailSignIn}
        className="mt-6 space-y-4 rounded-md border border-ink/10 bg-sand p-6"
      >
        {error && (
          <div className="rounded-sm border border-clay/40 bg-mist px-3 py-2 text-xs text-clay">
            {error}
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Email
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Password
          <input
            name="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <div className="flex items-center justify-between text-xs text-ink/70">
          <Link href="/forgot-password" className="hover:text-ink">
            Forgot password?
          </Link>
          <Link href="/signup" className="hover:text-ink">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
