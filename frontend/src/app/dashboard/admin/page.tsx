"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Hospital,
  Users,
  Package,
  Activity,
  Settings,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = getCurrentUser();
      if (!user || user.role !== "admin") {
        router.push("/login");
        return;
      }
      const res = await api.getAdminDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
        <p className="font-medium">Loading administrative governance metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
          <h2 className="text-lg font-bold mb-2">Error Connecting to Dashboard</h2>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const recentLogs = data?.recent_audit_logs || [];
  const overview = data?.inventory_overview?.by_blood_group || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              System Administrator Governance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Regional Blood Coordination Network
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/audit"
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-sm text-sm flex items-center space-x-2 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Full Audit Logs</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
            <Hospital className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Partner Hospitals
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {kpis.total_hospitals ?? 0}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Blood Bank Centers
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {kpis.total_blood_banks ?? 0}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Active Staff Users
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {kpis.total_users ?? 0}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Tracked Batches
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {kpis.total_batches ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Network Inventory Balance Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Network-Wide Blood Supply Reserves
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Aggregate inventory across all facilities with low-stock threshold detection
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {overview.map((g: any) => (
            <div
              key={g.blood_group}
              className={`p-4 rounded-xl border text-center ${
                g.is_low_stock
                  ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
              }`}
            >
              <span className="text-lg font-black text-slate-900 dark:text-white block">
                {g.blood_group}
              </span>
              <span className="text-2xl font-extrabold text-red-600 dark:text-red-500 my-1 block">
                {g.available_units}
              </span>
              <span className="text-[10px] text-slate-400 block font-semibold">
                Threshold: {g.min_threshold}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-2 inline-block ${
                  g.is_low_stock ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {g.is_low_stock ? "DEFICIT" : "HEALTHY"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time System Audit Trail */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              System Audit Trail
            </h2>
            <p className="text-xs text-slate-500">
              Immutable ledger of logins, request submissions, inventory deductions, and status changes
            </p>
          </div>
          <Link
            href="/audit"
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">User</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {recentLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-3 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                    {log.user_name || "System"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold border border-slate-200 dark:border-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{log.entity_type}</td>
                  <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-300 max-w-md truncate" title={log.description}>
                    {log.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
