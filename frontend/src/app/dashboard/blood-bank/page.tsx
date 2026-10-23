"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Droplet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

export default function BloodBankDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fulfillment dialog state
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [fulfillUnits, setFulfillUnits] = useState<number>(0);
  const [fulfillNote, setFulfillNote] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const res = await api.getBloodBankDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load blood bank dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleApprove = async (reqId: number) => {
    try {
      setActionLoading(true);
      await api.updateRequestStatus(reqId, "Approved", "Approved by blood bank staff");
      await loadDashboard();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reqId: number) => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;
    try {
      setActionLoading(true);
      await api.updateRequestStatus(reqId, "Rejected", reason);
      await loadDashboard();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setActionLoading(true);
      await api.fulfillRequest(
        selectedRequest.id,
        fulfillUnits > 0 ? fulfillUnits : undefined,
        fulfillNote
      );
      setSelectedRequest(null);
      await loadDashboard();
    } catch (err: any) {
      alert(`Fulfillment Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-red-600 mb-3" />
        <p className="font-medium">Connecting to BloodBridge backend...</p>
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
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const groups = data?.inventory_by_group || [];
  const recentReqs = data?.recent_requests || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Blood Bank Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {data?.blood_bank_name || "Blood Bank Facility"}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/inventory"
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm text-sm flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Manage Inventory</span>
          </Link>
        </div>
      </div>

      {/* Low Stock Warning Banner if any */}
      {kpis.low_stock_groups_count > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start space-x-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-bold">Safety Stock Threshold Alert</h2>
            <p className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
              {kpis.low_stock_groups_count} blood group(s) are currently below configured minimum safety thresholds (e.g. O-, AB-). Action required.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Available Units
          </span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 block">
            {kpis.total_available_units ?? 0}
          </span>
          <span className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
            Ready for dispatch
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Low Stock Groups
          </span>
          <span className="text-3xl font-extrabold text-amber-600 mt-1 block">
            {kpis.low_stock_groups_count ?? 0}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Below safety reserve</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Critical Expiry (≤3d)
          </span>
          <span className="text-3xl font-extrabold text-rose-600 mt-1 block">
            {kpis.critical_expiry_count ?? 0}
          </span>
          <span className="text-xs text-rose-500 font-medium mt-1 block">Requires prioritization</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Pending Requests
          </span>
          <span className="text-3xl font-extrabold text-blue-600 mt-1 block">
            {kpis.pending_requests_count ?? 0}
          </span>
          <span className="text-xs text-blue-500 font-medium mt-1 block">Awaiting review</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Emergency Requests
          </span>
          <span className="text-3xl font-extrabold text-red-600 mt-1 block">
            {kpis.emergency_requests_count ?? 0}
          </span>
          <span className="text-xs text-red-500 font-medium mt-1 block">Critical priority</span>
        </div>
      </div>

      {/* Inventory by Blood Group Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Blood Group Inventory Availability
            </h2>
            <p className="text-xs text-slate-500">
              Live available units vs configured safety threshold
            </p>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center"
          >
            <span>View All Batches</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {groups.map((g: any) => {
            const pct = Math.min(100, Math.round((g.available_units / (g.min_threshold * 1.5)) * 100));
            return (
              <div
                key={g.blood_group}
                className={`p-4 rounded-xl border text-center relative overflow-hidden transition-all ${
                  g.is_low_stock
                    ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                {g.is_low_stock && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" title="Low Stock" />
                )}
                <span className="text-lg font-black text-slate-900 dark:text-white block">
                  {g.blood_group}
                </span>
                <span className="text-2xl font-extrabold text-red-600 dark:text-red-500 my-1 block">
                  {g.available_units}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Min: {g.min_threshold} units
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${g.is_low_stock ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hospital Blood Requests Processing Queue */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Incoming Hospital Requests
            </h2>
            <p className="text-xs text-slate-500">
              Review and authorize hospital emergency blood supply dispatch
            </p>
          </div>
          <Link
            href="/requests"
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center"
          >
            <span>View All Requests</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {recentReqs.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No active requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Req ID</th>
                  <th className="py-3 px-3">Hospital</th>
                  <th className="py-3 px-3">Group</th>
                  <th className="py-3 px-3">Requested</th>
                  <th className="py-3 px-3">Fulfilled</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentReqs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-500">#{r.id}</td>
                    <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">
                      {r.hospital_name}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-red-600">{r.blood_group}</td>
                    <td className="py-3.5 px-3 font-semibold">{r.quantity} units</td>
                    <td className="py-3.5 px-3 text-slate-500">{r.fulfilled_quantity} units</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          r.priority === "Critical"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
                            : r.priority === "Urgent"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                        }`}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          r.status === "Fulfilled"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                            : r.status === "Approved"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300"
                            : r.status === "Rejected"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-2">
                      {r.status === "Submitted" && (
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Approve
                        </button>
                      )}
                      {(r.status === "Submitted" || r.status === "Approved" || r.status === "Partially Fulfilled") && (
                        <button
                          onClick={() => {
                            setSelectedRequest(r);
                            setFulfillUnits(r.quantity - r.fulfilled_quantity);
                            setFulfillNote("");
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
                        >
                          Fulfill
                        </button>
                      )}
                      {r.status === "Submitted" && (
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={actionLoading}
                          className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-red-600"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fulfillment Modal Dialog */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Fulfill Blood Request #{selectedRequest.id}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Authorized release of <span className="font-bold text-red-600">{selectedRequest.blood_group}</span> units for <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRequest.hospital_name}</span>. Inventory will be automatically deducted using FEFO (First-Expiry-First-Out).
            </p>

            <form onSubmit={handleFulfillSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Units to Dispatch (Remaining: {selectedRequest.quantity - selectedRequest.fulfilled_quantity})
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedRequest.quantity - selectedRequest.fulfilled_quantity}
                  value={fulfillUnits}
                  onChange={(e) => setFulfillUnits(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Dispatch Notes / Courier Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dispatched via Emergency Transit Van #4"
                  value={fulfillNote}
                  onChange={(e) => setFulfillNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                >
                  {actionLoading ? "Processing Atomic Deduction..." : "Confirm & Fulfill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
