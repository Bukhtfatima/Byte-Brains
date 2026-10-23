"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  Droplet,
  Package,
  FileText,
  Shield,
  LogOut,
  Hospital,
  Building2,
  TrendingUp,
  AlertTriangle,
  PlayCircle,
  BarChart3,
  Bot,
  Cpu,
  Bell,
  Settings,
  Menu,
  X,
  Radio,
} from "lucide-react";
import { getCurrentUser, clearSession, api, UserSession } from "@/lib/api";
import { useRealtimeNotifications } from "@/lib/useWebSocket";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, notifications, clearAll } = useRealtimeNotifications();
  const [storedUnread, setStoredUnread] = useState(0);

  // Critical requests are also saved as stored notifications, so skip them here to avoid double counting
  const liveOnlyAlerts = notifications.filter(
    (n) => !(n.type === "NEW_BLOOD_REQUEST" && n.priority === "Critical")
  ).length;
  const unreadAlerts = storedUnread + liveOnlyAlerts;

  useEffect(() => {
    setUser(getCurrentUser());
    setMobileMenuOpen(false);
  }, [pathname]);

  // Count stored notifications newer than the last one this user has seen
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const seenKey = `bloodbridge_last_seen_notification_${currentUser.email}`;
    let cancelled = false;

    api
      .getNotifications()
      .then((items) => {
        if (cancelled) return;
        const latestId = items.reduce((max, n) => Math.max(max, n.id), 0);
        if (pathname === "/notifications") {
          localStorage.setItem(seenKey, String(latestId));
          setStoredUnread(0);
          clearAll();
          return;
        }
        const lastSeen = Number(localStorage.getItem(seenKey) || 0);
        setStoredUnread(items.filter((n) => n.id > lastSeen).length);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, notifications.length, clearAll]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    router.push("/login");
  };

  const getDashboardHref = () => {
    if (!user) return "/login";
    if (user.role === "admin") return "/dashboard/admin";
    if (user.role === "blood_bank_staff") return "/dashboard/blood-bank";
    return "/dashboard/hospital";
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-300">ADMIN</span>;
      case "blood_bank_staff":
        return <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-red-300">BLOOD BANK</span>;
      case "hospital_staff":
        return <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-300">HOSPITAL</span>;
      default:
        return null;
    }
  };

  const navLinks = [
    { label: "Dashboard", href: getDashboardHref(), match: "/dashboard" },
    { label: "Inventory", href: "/inventory", match: "/inventory", roles: ["admin", "blood_bank_staff"] },
    { label: "Donors", href: "/donors", match: "/donors", roles: ["admin"] },
    { label: "Requests", href: "/requests", match: "/requests" },
    { label: "Risk Monitor", href: "/risk", match: "/risk" },
    { label: "Analytics", href: "/analytics", match: "/analytics" },
    { label: "AI Assistant", href: "/assistant", match: "/assistant", highlight: true },
    { label: "Audit Logs", href: "/audit", match: "/audit", roles: ["admin"] },
    { label: "Settings", href: "/settings", match: "/settings", roles: ["admin"] },
  ];

  const visibleLinks = navLinks.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform">
              <Droplet className="w-5 h-5 fill-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Blood<span className="text-red-600">Bridge</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        {user && (
          <nav className="hidden xl:flex items-center space-x-1">
            {visibleLinks.map((item) => {
              const isActive = pathname.startsWith(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    item.highlight
                      ? isActive
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold"
                      : isActive
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* Live WebSocket Status & Notifications Link */}
              <div className="flex items-center space-x-2">
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    isConnected
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  }`}
                  title={isConnected ? "Real-time WebSocket Connected" : "Connecting to live feed..."}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span>{isConnected ? "LIVE" : "SYNC"}</span>
                </div>

                <Link
                  href="/notifications"
                  className="relative p-2 text-slate-700 hover:text-slate-900 dark:text-white dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Notification Center"
                >
                  <Bell className="w-5 h-5" />
                  {unreadAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  )}
                </Link>
              </div>

              <div className="hidden sm:block text-right">
                <div className="flex items-center justify-end space-x-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {user.name.split(" ")[0]}
                  </span>
                  {getRoleBadge(user.role)}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 transition-all hover:scale-[1.02]"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && user && (
        <div className="xl:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1">
          {visibleLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                pathname.startsWith(item.match)
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/notifications"
            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Notifications
          </Link>
        </div>
      )}
    </header>
  );
}
