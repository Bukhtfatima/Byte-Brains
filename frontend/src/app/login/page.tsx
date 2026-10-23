"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Droplet,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";

type AuthMode = "signin" | "signup";
type RoleType = "hospital_staff" | "blood_bank_staff" | "admin";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up state
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RoleType>("hospital_staff");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "signup" || qMode === "register") {
      setMode("signup");
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const session = await api.login(email, password);
      redirectByRole(session.role);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (signupPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        name,
        email: signupEmail,
        password: signupPassword,
        role,
        organization_type:
          role === "hospital_staff"
            ? "hospital"
            : role === "blood_bank_staff"
            ? "blood_bank"
            : undefined,
        hospital_id: role === "hospital_staff" ? 1 : undefined,
        blood_bank_id: role === "blood_bank_staff" ? 1 : undefined,
      };

      const session = await api.register(payload);
      setSuccess("Account successfully registered! Redirecting to your dashboard...");
      setTimeout(() => {
        redirectByRole(session.role);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (userRole: string) => {
    let dest = "/dashboard/hospital";
    if (userRole === "admin") {
      dest = "/dashboard/admin";
    } else if (userRole === "blood_bank_staff") {
      dest = "/dashboard/blood-bank";
    }
    window.location.href = dest;
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setMode("signin");
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);

    try {
      const session = await api.login(demoEmail, demoPass);
      redirectByRole(session.role);
    } catch (err: any) {
      setError(err.message || "Failed to sign in demo account.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-xl w-full space-y-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-red-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md shadow-red-500/20 mb-3">
            <Droplet className="w-6 h-6 fill-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Blood<span className="text-red-600">Bridge</span> Access Portal
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Role-Based Access Control (RBAC) Authentication & Management
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              mode === "signin"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Sign In to Existing Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              mode === "signup"
                ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            <span>Create RBAC Account</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 flex items-start space-x-2 text-red-700 dark:text-red-300 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 flex items-start space-x-2 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SIGN IN FORM                                                              */}
        {/* ========================================================================= */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Authorized Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bloodbridge.org"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating credentials...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Demo Fast-Fill */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-bold text-center text-slate-400 uppercase tracking-wider mb-2.5">
                1-Click Instant Demo Login
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin("hospital@bloodbridge.org", "hospital123")}
                  className="px-2 py-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  Hospital Staff
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin("bloodbank@bloodbridge.org", "bloodbank123")}
                  className="px-2 py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Droplet className="w-4 h-4 mx-auto mb-1 text-red-600 fill-red-600" />
                  Blood Bank
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin("admin@bloodbridge.org", "admin123")}
                  className="px-2 py-2.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                  System Admin
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SIGN UP FORM (RBAC REGISTRATION)                                         */}
        {/* ========================================================================= */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Step 1: Role Selection Cards */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Select Your Assigned RBAC Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Hospital Staff */}
                <button
                  type="button"
                  onClick={() => setRole("hospital_staff")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    role === "hospital_staff"
                      ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-blue-600 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs font-bold">Hospital Staff</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Submit blood orders, triage emergencies & monitor transfusions.
                  </p>
                </button>

                {/* Blood Bank Staff */}
                <button
                  type="button"
                  onClick={() => setRole("blood_bank_staff")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    role === "blood_bank_staff"
                      ? "border-red-500 bg-red-50/80 dark:bg-red-950/40 shadow-sm ring-2 ring-red-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-red-600 mb-1">
                    <Droplet className="w-4 h-4" />
                    <span className="text-xs font-bold">Blood Bank</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Manage inventory stock, batch expiries & donor collections.
                  </p>
                </button>

                {/* Admin */}
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    role === "admin"
                      ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 shadow-sm ring-2 ring-purple-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-purple-600 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-bold">System Admin</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Full network governance, audit trail logs & donor management.
                  </p>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Full Name & Title
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jordan Hayes, MD"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="jordan.hayes@healthsystem.org"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                />
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Registering account...</span>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-slate-400">Loading access portal...</div>}>
      <LoginForm />
    </Suspense>
  );
}
