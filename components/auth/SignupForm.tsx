"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  createBackendSession,
  signInWithGoogle,
  signUpWithEmail,
  signOutFirebase,
} from "@/lib/firebaseAuth";
import { isFirebaseConfigured } from "@/lib/firebaseClient";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/popup-blocked": "Pop-up blocked. Please allow pop-ups and try again.",
  "auth/account-exists-with-different-credential":
    "This email is linked to a different sign-in method.",
  gamertag_required: "Please enter a gamertag to continue.",
  gamertag_taken: "That gamertag is already in use.",
  gamertag_invalid:
    "Gamertag must be 3-24 characters and contain only letters, numbers, spaces, or underscores.",
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
  if (code === "gamertag_taken") {
    return "That gamertag is already in use.";
  }
  return (
    (code && ERROR_MESSAGES[code]) ||
    message ||
    "We couldn't complete your sign-up. Please try again."
  );
}

export default function SignupForm() {
  const searchParams = useSearchParams();
  const firebaseReady = isFirebaseConfigured();
  const [gamertag, setGamertag] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSession = async (idToken: string, tag?: string) => {
    const result = await createBackendSession(idToken, tag);
    if (result.needsGamertag) {
      const nextParam = searchParams?.get("next") || "/browse";
      window.location.href = `/complete-profile?next=${encodeURIComponent(
        nextParam
      )}`;
      return;
    }
    window.location.href = result.redirectTo ?? "/browse";
  };

  const handleEmailSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!firebaseReady) {
      setError("Firebase auth is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await signUpWithEmail(email, password);
      const token = await credential.user.getIdToken();
      await handleSession(token, gamertag);
    } catch (err) {
      const message = resolveFirebaseError(err);
      setError(message);
      await signOutFirebase().catch(() => {});
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
      <h1 className="text-3xl font-semibold text-ink">Create account</h1>
      <p className="mt-2 text-sm text-ink/70">
        Your gamertag is your identity for invites and roster listings.
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
        onSubmit={handleEmailSignUp}
        className="mt-6 space-y-4 rounded-md border border-ink/10 bg-sand p-6"
      >
        {error && (
          <div className="rounded-sm border border-clay/40 bg-mist px-3 py-2 text-xs text-clay">
            {error}
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Gamertag
          <input
            name="gamertag"
            type="text"
            required
            placeholder="Your gamertag"
            value={gamertag}
            onChange={(event) => setGamertag(event.target.value)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
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
          disabled={loading || !firebaseReady}
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
        <div className="text-xs text-ink/70">
          Already have an account?{" "}
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
