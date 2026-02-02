"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordReset } from "@/lib/firebaseAuth";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-not-found": "No matching account found.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
};

function resolveFirebaseError(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
      ? (error as { code: string }).code
      : null;
  return (
    (code && ERROR_MESSAGES[code]) ||
    "Password reset failed. Please try again."
  );
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordReset(email);
      setSuccess("Check your email for a reset link.");
    } catch (err) {
      setError(resolveFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Reset password</h1>
      <p className="mt-2 text-sm text-ink/70">
        Enter your account email and we will send a reset link.
      </p>

      <form
        onSubmit={handleReset}
        className="mt-6 space-y-4 rounded-md border border-ink/10 bg-sand p-6"
      >
        {error && (
          <div className="rounded-sm border border-clay/40 bg-mist px-3 py-2 text-xs text-clay">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-sm border border-ink/20 bg-mist px-3 py-2 text-xs text-ink">
            {success}
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <div className="text-xs text-ink/70">
          Remembered your password?{" "}
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
