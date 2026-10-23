"use client";

import { useRealtimeNotifications } from "@/lib/useWebSocket";
import { AlertCircle, CheckCircle2, Info, X, Zap, Droplet } from "lucide-react";
import Link from "next/link";

export default function RealtimeToastListener() {
  const { notifications, dismissNotification } = useRealtimeNotifications();

  // Show the top 3 active notifications
  const activeToasts = notifications.slice(0, 3);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      {activeToasts.map((toast) => {
        const isCritical = toast.severity === "critical" || toast.priority === "Critical";
        const isSuccess = toast.severity === "success";
        const isWarning = toast.severity === "warning";

        const bgClass = isCritical
          ? "bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-900/40"
          : isSuccess
          ? "bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-900/40"
          : isWarning
          ? "bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-amber-900/40"
          : "bg-slate-900/95 border-blue-500/80 text-slate-100 shadow-blue-900/40";

        const icon = isCritical ? (
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
        ) : isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : isWarning ? (
          <Zap className="w-5 h-5 text-amber-400 shrink-0" />
        ) : (
          <Droplet className="w-5 h-5 text-blue-400 shrink-0" />
        );

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-5 duration-300 ${bgClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm tracking-wide">{toast.title}</span>
                <span className="text-[10px] opacity-75 font-mono">{toast.timestamp}</span>
              </div>
              <p className="text-xs mt-1 text-slate-200/90 leading-relaxed">{toast.message}</p>
              {toast.request_id && (
                <Link
                  href="/requests"
                  className="inline-block mt-2 text-[11px] font-medium underline text-rose-300 hover:text-rose-200"
                >
                  View in Request Center →
                </Link>
              )}
            </div>
            <button
              onClick={() => toast.id && dismissNotification(toast.id)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg -mr-1 -mt-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
