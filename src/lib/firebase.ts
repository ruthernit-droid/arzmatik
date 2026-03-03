import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

function getPublicFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

function assertFirebaseConfig(cfg: ReturnType<typeof getPublicFirebaseConfig>) {
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!cfg.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!cfg.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!cfg.storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!cfg.messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!cfg.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  if (missing.length) {
    throw new Error(`Missing Firebase env vars: ${missing.join(", ")}`);
  }
}

// Note:
// - This app is a static export. Pages are pre-rendered at build time.
// - Avoid reading env vars at module scope on the server.
// - Initialize Firebase only in the browser.

const app = (() => {
  if (typeof window === "undefined") return null as any;
  const cfg = getPublicFirebaseConfig();
  assertFirebaseConfig(cfg);
  return getApps().length > 0 ? getApp() : initializeApp(cfg);
})();

const db = (() => {
  if (typeof window === "undefined") return null as any;
  return getFirestore(app);
})();

const auth = (() => {
  if (typeof window === "undefined") return null as any;
  return getAuth(app);
})();

export { app, db, auth };
