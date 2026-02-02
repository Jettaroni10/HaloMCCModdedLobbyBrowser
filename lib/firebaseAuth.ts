"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebaseClient";

async function ensurePersistence(auth: Auth) {
  await setPersistence(auth, browserLocalPersistence);
}

function getAuthOrThrow() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase auth is not configured.");
  }
  return auth;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getAuthOrThrow();
  await ensurePersistence(auth);
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signUpWithEmail(email: string, password: string) {
  const auth = getAuthOrThrow();
  await ensurePersistence(auth);
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getAuthOrThrow();
  await ensurePersistence(auth);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordReset(email: string) {
  const auth = getAuthOrThrow();
  return sendPasswordResetEmail(auth, email);
}

export async function signOutFirebase() {
  if (!isFirebaseConfigured()) {
    return;
  }
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export async function createBackendSession(
  idToken: string,
  gamertag?: string
) {
  const response = await fetch("/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, gamertag }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    code?: string;
    redirectTo?: string;
    needsGamertag?: boolean;
  };

  if (!response.ok) {
    const message = data.error ?? "Sign in failed.";
    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}
