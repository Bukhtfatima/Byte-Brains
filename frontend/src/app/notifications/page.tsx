"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  Flame,
  CheckCircle,
  Clock,
  TrendingDown,
  Info,
} from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");

  const fetchNotifs = async () => {
    try {
      setLoading(true);
      const res = await api.getNotifications();
      setNotifications(res || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "EMERGENCY_REQUEST":
        return <Flame className="w-4 h-4 text-red-600" />;
      case "EXPIRY_WARNING":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "LOW_INVENTORY":
        return <TrendingDown className="w-4 h-4 text-rose-600" />;
      case "SHORTAGE_RISK":
        return <AlertTriangle className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600" />;
    }
  };

  const filtered = filterType === "ALL"
    ? notifications
    : notifications.filter((n) => n.type === filterType);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Notification Center
            </h1>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-slate-300">
              {notifications.length} alerts
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time operational alerts dispatched via BloodBridge internal automation workflows.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto text-xs pb-1">
        {["ALL", "EMERGENCY_REQUEST", "LOW_INVENTORY", "EXPIRY_WARNING", "SHORTAGE_RISK"].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === t
                ? "bg-red-600 text-white shadow-sm font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading alerts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            No active alerts found matching filter.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition-shadow flex items-start space-x-3.5"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {n.type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      To: {n.recipient}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {n.message}
                </p>

                {n.metadata_json && (
                  <div className="mt-2 text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2 rounded max-w-2xl overflow-x-auto">
                    {JSON.stringify(n.metadata_json)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
