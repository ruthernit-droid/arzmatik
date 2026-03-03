"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  Users,
  PieChart,
  Settings,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { FirebaseDataProvider, useFirebaseDataContext } from "@/components/FirebaseDataContext";

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`px-2 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 min-w-[64px] ${active
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
        : "border-transparent text-zinc-400 hover:text-white"}`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user, darkMode, toggleTheme } = useFirebaseDataContext();
  const [loginBusy, setLoginBusy] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [registerMode, setRegisterMode] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        if (!auth) return;
        await getRedirectResult(auth);
      } catch (e: any) {
        console.error("Redirect login failed", e);
        setLoginError(String(e?.message || e));
      }
    })();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoginBusy(true);
      setLoginError(null);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      const code = String(error?.code || "");
      const msg = String(error?.message || error);
      setLoginError(msg);
      if (code.includes("popup") || code.includes("blocked") || code.includes("closed")) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e: any) {
          console.error("Redirect login failed", e);
          setLoginError(String(e?.message || e));
        }
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setLoginError("Lutfen e-posta ve sifre gir.");
      return;
    }
    setLoginBusy(true);
    setLoginError(null);
    try {
      if (registerMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      console.error("Email auth failed", e);
      setLoginError(String(e?.message || e));
    } finally {
      setLoginBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen premium-gradient flex items-center justify-center p-4 text-white safe-area-pb">
        <div className="glass-card max-w-sm w-full text-center space-y-6 p-8 bg-zinc-900/80 border border-zinc-800 rounded-3xl">
          <div className="mx-auto w-14 h-14 bg-zinc-900 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black">
            Halka Arz <span className="text-emerald-500">Matik</span>
          </h1>
          <p className="text-zinc-400 text-sm">Hesaplarinizi ve halka arzlari yonetin.</p>

          <button
            onClick={handleLogin}
            disabled={loginBusy}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all"
          >
            <LogIn className="w-5 h-5" />
            {loginBusy ? "Giris..." : "Google ile Giris"}
          </button>

          <div className="space-y-3 text-left">
            <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">veya mail ile</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@ornek.com"
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white outline-none focus:border-emerald-500 transition-all font-medium text-base"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sifre"
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white outline-none focus:border-emerald-500 transition-all font-medium text-base"
            />
            <button
              onClick={handleEmailAuth}
              disabled={loginBusy}
              className="w-full h-12 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
            >
              {loginBusy ? "Isleniyor..." : registerMode ? "Kaydol" : "Giris Yap"}
            </button>
            <button
              onClick={() => setRegisterMode((x) => !x)}
              className="w-full text-xs text-zinc-400 hover:text-white font-medium"
            >
              {registerMode ? "Hesabim var" : "Hesap olustur"}
            </button>
          </div>

          {loginError && (
            <div className="text-left text-xs text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 font-medium">
              <div className="text-[10px] uppercase tracking-widest font-black text-rose-300 mb-1">Hata</div>
              <div className="break-words">{loginError}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 pb-24 ${darkMode ? "bg-black text-zinc-100" : "bg-slate-100 text-slate-900"}`}>
      {/* Mobile Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl safe-area-pt ${darkMode ? "bg-black/90 border-zinc-900" : "bg-white/90 border-slate-200"}`}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">Halka Arz Matik</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all ${darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-slate-200 text-slate-500"}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div 
            key={pathname} 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -8 }} 
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-xl z-50 safe-area-pb ${darkMode ? "bg-black/95 border-zinc-900" : "bg-white/95 border-slate-200"}`}>
        <div className="flex items-center justify-around h-16 px-2">
          <NavLink href="/portfolio" icon={<LayoutDashboard className="w-5 h-5" />} label="Portfoy" />
          <NavLink href="/summary" icon={<PieChart className="w-5 h-5" />} label="Ozet" />
          <NavLink href="/accounts" icon={<Users className="w-5 h-5" />} label="Hesaplar" />
          <NavLink href="/ipos" icon={<Box className="w-5 h-5" />} label="Arz" />
          <NavLink href="/day" icon={<TrendingUp className="w-5 h-5" />} label="Islem" />
          <NavLink href="/settings" icon={<Settings className="w-5 h-5" />} label="Ayarlar" />
        </div>
      </nav>
    </div>
  );
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseDataProvider>
      <Shell>{children}</Shell>
    </FirebaseDataProvider>
  );
}
