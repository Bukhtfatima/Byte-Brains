"use client";

import React, { useEffect, useState } from "react";
import { api, getCurrentUser } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  Building2,
  Droplet,
  Users,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"both" | "hospital" | "blood_bank">("both");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await api.getAnalytics();
        setData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-sm font-medium text-slate-500">Loading scoped intelligence analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center text-red-600 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
        <p className="font-semibold">{error || "Failed to retrieve analytics data"}</p>
      </div>
    );
  }

  const role = data.role || currentUser?.role || "admin";
  const hospitalData = data.hospital_analytics;
  const bloodBankData = data.blood_bank_analytics;
  const summary = data.summary || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {role === "hospital_staff" && "Hospital Clinical & Transfusion Analytics"}
              {role === "blood_bank_staff" && "Blood Bank Inventory & Donor Supply Analytics"}
              {role === "admin" && "Executive Network Intelligence & Analytics"}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                role === "hospital_staff"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300"
                  : role === "blood_bank_staff"
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300"
              }`}
            >
              {role === "hospital_staff" && "HOSPITAL RBAC"}
              {role === "blood_bank_staff" && "BLOOD BANK RBAC"}
              {role === "admin" && "ADMIN RBAC (DUAL VIEW)"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {role === "hospital_staff" && "Detailed monitoring of clinical transfusion throughput, urgent requests, and hospital delivery turnaround."}
            {role === "blood_bank_staff" && "Live monitoring of blood reserve levels, donor intake, avoidable wastage, and batch shelf-life."}
            {role === "admin" && "Unified cross-system operations: complete visibility into both hospital clinical demand and blood bank reserves."}
          </p>
        </div>

        {/* Admin Tab Switcher */}
        {role === "admin" && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 self-start md:self-auto">
            <button
              onClick={() => setAdminTab("both")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                adminTab === "both"
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Both / Executive
            </button>
            <button
              onClick={() => setAdminTab("hospital")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${
                adminTab === "hospital"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 mr-1" />
              <span>Hospital View</span>
            </button>
            <button
              onClick={() => setAdminTab("blood_bank")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${
                adminTab === "blood_bank"
                  ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Droplet className="w-3.5 h-3.5 mr-1" />
              <span>Blood Bank View</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. HOSPITAL ANALYTICS SECTION (Visible to Hospital Staff & Admin)          */}
      {/* ========================================================================= */}
      {(role === "hospital_staff" || (role === "admin" && (adminTab === "both" || adminTab === "hospital"))) && hospitalData && (
        <section className="space-y-6">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Hospital Clinical Demand & Transfusion Intelligence
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Scope: {hospitalData.hospital_name}
              </span>
            </div>
          </div>

          {/* Hospital KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                30-Day Transfusions
              </span>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {hospitalData.summary.total_30d_transfused_units}{" "}
                <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Clinical bedside usage</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Order Fulfillment
              </span>
              <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
                {hospitalData.summary.fulfillment_rate_pct}%
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {hospitalData.summary.fulfilled_requests_count} / {hospitalData.summary.total_requests} requests
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Critical Emergencies
              </span>
              <div className="mt-2 text-2xl font-black text-rose-600">
                {hospitalData.summary.emergency_critical_count}
              </div>
              <span className="text-[11px] text-rose-500 font-medium mt-1 block">
                +{hospitalData.summary.emergency_urgent_count} urgent orders
              </span>
            </div>
          </div>

          {/* Hospital Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Usage Trend */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Hospital Transfusions (Past 14 Days)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hospitalData.daily_transfusion_trend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="units_transfused"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demand by Blood Group */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Hospital Blood Group Consumption (30 Days)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hospitalData.demand_by_blood_group}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="blood_group" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="units_used" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hospital Request Priority & Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Requests by Clinical Priority
              </h4>
              <div className="space-y-2 text-xs">
                {hospitalData.request_priority_breakdown?.map((item: any) => (
                  <div key={item.priority} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.priority}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{item.count} orders</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Requests Lifecycle Status
              </h4>
              <div className="space-y-2 text-xs">
                {hospitalData.request_status_breakdown?.map((item: any) => (
                  <div key={item.status} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.status}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{item.count} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Divider between sections in dual view */}
      {role === "admin" && adminTab === "both" && (
        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-800 my-8"></div>
      )}

      {/* ========================================================================= */}
      {/* 2. BLOOD BANK ANALYTICS SECTION (Visible to Blood Bank Staff & Admin)     */}
      {/* ========================================================================= */}
      {(role === "blood_bank_staff" || (role === "admin" && (adminTab === "both" || adminTab === "blood_bank"))) && bloodBankData && (
        <section className="space-y-6">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600">
              <Droplet className="w-4 h-4 fill-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Blood Bank Inventory & Donor Supply Operations
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Scope: {bloodBankData.blood_bank_name}
              </span>
            </div>
          </div>

          {/* Blood Bank KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Available Reserves
              </span>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {bloodBankData.summary.active_available_inventory}{" "}
                <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                +{bloodBankData.summary.reserved_units} reserved for delivery
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Donor Intake Volume
              </span>
              <div className="mt-2 text-2xl font-black text-emerald-600">
                {bloodBankData.summary.total_intake_units}{" "}
                <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {bloodBankData.summary.total_donations_collected} donations / {bloodBankData.summary.active_registered_donors} donors
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Avoidable Wastage
              </span>
              <div className="mt-2 text-2xl font-black text-amber-600">
                {bloodBankData.summary.wastage_rate_pct}%
              </div>
              <span className="text-[11px] text-amber-500 font-medium mt-1 block">
                {bloodBankData.summary.expired_units} expired / {bloodBankData.summary.expiring_soon_7d_units} expiring soon
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Dispatch Velocity
              </span>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {bloodBankData.summary.average_dispatch_hours}{" "}
                <span className="text-xs font-normal text-slate-400">hrs</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {bloodBankData.summary.fulfilled_orders_count} of {bloodBankData.summary.total_orders_received} orders fulfilled
              </span>
            </div>
          </div>

          {/* Blood Bank Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Stock Reserves by Blood Group */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Available Units by Blood Group
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bloodBankData.stock_by_blood_group}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="blood_group" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="available_units" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Status Breakdown */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Inventory Stock Classification
              </h3>
              <div className="h-64 flex flex-col justify-center space-y-3">
                {bloodBankData.inventory_status_breakdown?.map((item: any) => (
                  <div key={item.status} className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          item.status === "AVAILABLE"
                            ? "bg-emerald-500"
                            : item.status === "RESERVED"
                            ? "bg-blue-500"
                            : item.status === "EXPIRED"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        }`}
                      ></span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.status}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {item.units} <span className="text-xs font-normal text-slate-400">units</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
