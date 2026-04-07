"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// League code verified server-side via /api/verify-code

export default function LandingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "code" | "auth">("welcome");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [leagueCode, setLeagueCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in — skip to app
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push("/standings");
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  // Show nothing while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1a" }}>
        <div className="text-white text-lg font-medium animate-pulse">טוען...</div>
      </div>
    );
  }

  const verifyCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: leagueCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setCodeError(false);
        setShowSignup(true);
        setStep("auth");
      } else {
        setCodeError(true);
      }
    } catch {
      setCodeError(true);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    setLoading(true);
    // Use current origin for the callback — works on both localhost and production
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${showSignup ? "/groups" : "/standings"}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      // Google not enabled yet — show friendly message
      if (error.message.includes("provider") || error.message.includes("Unsupported")) {
        setError("התחברות עם Google עדיין לא מוגדרת — השתמשו באימייל וסיסמה");
      } else {
        setError(error.message);
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (showSignup) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) { setError(error.message); setLoading(false); }
      else { setError("נשלח אימייל אימות — בדקו את התיבה"); setLoading(false); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError("אימייל או סיסמה שגויים"); setLoading(false); }
      else { router.push(showSignup ? "/groups" : "/standings"); }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0f1a 0%, #111827 40%, #0a0f1a 100%)", fontFamily: "var(--font-assistant), sans-serif" }} dir="rtl">

      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Floating orbs */}
        <motion.div
          className="absolute w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)", top: "10%", right: "5%" }}
          animate={{ x: [0, 30, -20, 0], y: [0, -20, 15, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", bottom: "5%", left: "10%" }}
          animate={{ x: [0, -25, 20, 0], y: [0, 20, -15, 0], scale: [1, 0.95, 1.08, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)", top: "50%", left: "40%" }}
          animate={{ x: [0, 15, -10, 0], y: [0, -10, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Animated football pitch SVG */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center opacity-[0.04]"
          animate={{ rotate: [0, 0.5, -0.5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 1200 800" fill="none" className="w-[150%] h-[150%]" xmlns="http://www.w3.org/2000/svg">
            {/* Pitch outline */}
            <rect x="50" y="50" width="1100" height="700" stroke="white" strokeWidth="3" rx="8" />
            {/* Center line */}
            <line x1="600" y1="50" x2="600" y2="750" stroke="white" strokeWidth="3" />
            {/* Center circle */}
            <circle cx="600" cy="400" r="100" stroke="white" strokeWidth="3" />
            <circle cx="600" cy="400" r="5" fill="white" />
            {/* Left penalty box */}
            <rect x="50" y="200" width="180" height="400" stroke="white" strokeWidth="2" />
            <rect x="50" y="280" width="70" height="240" stroke="white" strokeWidth="2" />
            <circle cx="185" cy="400" r="5" fill="white" />
            {/* Right penalty box */}
            <rect x="970" y="200" width="180" height="400" stroke="white" strokeWidth="2" />
            <rect x="1080" y="280" width="70" height="240" stroke="white" strokeWidth="2" />
            <circle cx="1015" cy="400" r="5" fill="white" />
            {/* Corner arcs */}
            <path d="M50 70 A20 20 0 0 1 70 50" stroke="white" strokeWidth="2" />
            <path d="M1130 50 A20 20 0 0 1 1150 70" stroke="white" strokeWidth="2" />
            <path d="M50 730 A20 20 0 0 0 70 750" stroke="white" strokeWidth="2" />
            <path d="M1130 750 A20 20 0 0 0 1150 730" stroke="white" strokeWidth="2" />
          </svg>
        </motion.div>

        {/* Floating football */}
        <motion.div
          className="absolute opacity-[0.06]"
          style={{ top: "20%", right: "15%" }}
          animate={{ y: [0, -30, 0], rotate: [0, 360] }}
          transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 8, repeat: Infinity, ease: "linear" } }}
        >
          <svg width="80" height="80" viewBox="0 0 100 100" fill="white">
            <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="3" />
            <polygon points="50,15 61,38 85,38 66,53 73,76 50,62 27,76 34,53 15,38 39,38" fill="white" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute opacity-[0.04]"
          style={{ bottom: "25%", left: "10%" }}
          animate={{ y: [0, 20, 0], rotate: [0, -360] }}
          transition={{ y: { duration: 5, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 12, repeat: Infinity, ease: "linear" } }}
        >
          <svg width="50" height="50" viewBox="0 0 100 100" fill="white">
            <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="3" />
            <polygon points="50,15 61,38 85,38 66,53 73,76 50,62 27,76 34,53 15,38 39,38" fill="white" />
          </svg>
        </motion.div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">

        <AnimatePresence mode="wait">

          {/* === STEP 1: Welcome === */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.4 }}
                className="mb-8"
              >
                <img
                  src="/logo.png"
                  alt="The Minhelet"
                  className="w-60 h-60 rounded-full object-cover shadow-2xl mx-auto"
                />
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-5xl sm:text-7xl font-black text-white mb-4 tracking-tight"
                style={{ fontFamily: "var(--font-secular), sans-serif" }}
              >
                THE MINHELET
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center justify-center gap-4 mb-6"
              >
                <div className="h-px w-16 bg-gradient-to-l from-blue-400/60 to-transparent"></div>
                <p className="text-lg font-bold text-blue-300 uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-inter)" }}>
                  FIFA WORLD CUP 2026
                </p>
                <div className="h-px w-16 bg-gradient-to-r from-blue-400/60 to-transparent"></div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xl text-gray-300 max-w-lg mx-auto leading-relaxed mb-10"
              >
                פלטפורמת ההימורים הפרטית של החבר׳ה.
                <br />
                <span className="text-gray-400">48 נבחרות · 104 משחקים · מי ייקח את הגביע?</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="flex flex-col sm:flex-row gap-3 items-center"
              >
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep("code")}
                  className="px-10 py-4 rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 transition-shadow"
                >
                  הרשמה חדשה
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setShowSignup(false); setStep("auth"); }}
                  className="px-10 py-4 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/10 transition-colors"
                >
                  כבר רשום? התחברות
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {/* === STEP 2: League Code === */}
          {step === "code" && (
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
              >
                <img src="/logo.png" alt="" className="w-28 h-28 rounded-full object-cover shadow-xl mx-auto mb-6" />
              </motion.div>

              <h2 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "var(--font-secular)" }}>
                קוד כניסה לליגה
              </h2>
              <p className="text-base text-gray-400 mb-8">הזינו את הקוד הסודי שקיבלתם כדי להיכנס</p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20"
              >
                <div className="space-y-4">
                  <input
                    type="text"
                    value={leagueCode}
                    onChange={(e) => { setLeagueCode(e.target.value); setCodeError(false); }}
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                    placeholder="הקוד הסודי"
                    dir="ltr"
                    className={`w-full px-5 py-4 rounded-xl text-center text-2xl font-black tracking-[0.3em] uppercase border-2 transition-all focus:outline-none ${
                      codeError
                        ? "border-red-300 bg-red-50 text-red-600 focus:ring-2 focus:ring-red-500"
                        : "border-gray-200 bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    }`}
                    style={{ fontFamily: "var(--font-inter)" }}
                  />

                  <AnimatePresence>
                    {codeError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm font-bold text-red-600"
                      >
                        קוד שגוי — נסו שוב או פנו למנהל הליגה
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={verifyCode}
                    className="w-full py-4 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-blue-500/25 transition-all"
                  >
                    כניסה
                  </motion.button>
                </div>
              </motion.div>

              <button onClick={() => setStep("welcome")} className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors font-medium">
                → חזרה
              </button>
            </motion.div>
          )}

          {/* === STEP 3: Auth === */}
          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring" }}
                className="text-center mb-6"
              >
                <div className="flex items-center justify-center gap-3 mb-3">
                  <img src="/logo.png" alt="" className="w-18 h-18 rounded-full object-cover shadow-lg" />
                  <div className="text-start">
                    <h2 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</h2>
                    <p className="text-xs text-green-400 font-bold">קוד אומת בהצלחה ✓</p>
                  </div>
                </div>
                <p className="text-base text-gray-400">התחברו או הירשמו כדי להתחיל להמר</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
              >
                {/* Google */}
                <div className="p-6 pb-4">
                  <motion.button
                    whileHover={{ scale: 1.01, boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-bold text-base hover:border-gray-300 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {loading ? "מתחבר..." : "המשך עם Google"}
                  </motion.button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 px-6">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-sm text-gray-400 font-medium">או</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* Email form */}
                <form onSubmit={handleEmailAuth} className="p-6 pt-4 space-y-3">
                  <AnimatePresence>
                    {showSignup && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <label className="text-sm font-bold text-gray-700 mb-1 block">שם תצוגה (כינוי)</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="השם שיוצג לכולם" required={showSignup}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-1 block">אימייל</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com" dir="ltr" required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-1 block">סיסמה</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder={showSignup ? "לפחות 6 תווים" : "••••••••"} dir="ltr" required minLength={6}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-xl px-4 py-3 text-sm font-medium ${
                          error.includes("אימייל אימות") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                  >
                    {loading ? "טוען..." : showSignup ? "הרשמה" : "התחברות"}
                  </motion.button>

                  <p className="text-center text-sm text-gray-500 pt-1">
                    {showSignup ? (
                      <>כבר יש לך חשבון? <button type="button" onClick={() => { setShowSignup(false); setError(null); }} className="text-blue-600 font-bold hover:underline">התחברות</button></>
                    ) : (
                      <>אין לך חשבון? <button type="button" onClick={() => { setShowSignup(true); setError(null); }} className="text-blue-600 font-bold hover:underline">הרשמה</button></>
                    )}
                  </p>
                </form>
              </motion.div>

              <button onClick={() => setStep("code")} className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors font-medium block mx-auto">
                → חזרה
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Features — visible on welcome step */}
        {step === "welcome" && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full"
          >
            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, title: "12 בתים · 72 משחקים", desc: "סדרו, הזינו תוצאות, הטבלה מתעדכנת", color: "from-blue-500/20 to-blue-600/5" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, title: "עץ נוק-אאוט מלא", desc: "מהשמינית ועד הגמר עם פנדלים", color: "from-amber-500/20 to-amber-600/5" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>, title: "דירוג + סטטיסטיקות", desc: "ליגה פרטית, השוואות, גרפים", color: "from-green-500/20 to-green-600/5" },
            ].map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`rounded-xl bg-gradient-to-br ${f.color} backdrop-blur-sm border border-white/10 p-6 text-center cursor-default`}
              >
                <div className="text-white/70 flex justify-center mb-3">{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-gray-500">The Minhelet · מונדיאל 2026 · ארה״ב, קנדה ומקסיקו</p>
        </motion.footer>
      </div>
    </div>
  );
}
