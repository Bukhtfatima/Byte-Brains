"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Hospital,
  Droplet,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Send,
  Zap,
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

export default function HospitalDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Request modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("O-");
  const [quantity, setQuantity] = useState(2);
  const [priority, setPriority] = useState("Critical");
  const [requiredDate, setRequiredDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const res = await api.getHospitalDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load hospital dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitLoading(true);
      await api.createRequest({
        blood_group: bloodGroup,
        quantity: Number(quantity),
        priority,
        required_datetime: new Date(requiredDate).toISOString(),
        notes,
      });
      setShowCreateModal(false);
      setNotes("");
      await loadDashboard();
    } catch (err: any) {
      alert(`Submission Error: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="font-medium">Connecting to hospital dispatch feed...</p>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const myRequests = data?.my_requests || [];
  const networkAvailability = data?.network_availability || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hospital Emergency Coordination Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {data?.hospital_name || "Emergency Medical Center"}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md shadow-red-500/20 text-sm flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Emergency Request</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Submitted Requests
          </span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 block">
            {kpis.total_submitted_requests ?? 0}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Total historical requests</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Active Emergencies
          </span>
          <span className="text-3xl font-extrabold text-rose-600 mt-1 block">
            {kpis.emergency_requests_count ?? 0}
          </span>
          <span className="text-xs text-rose-500 font-medium mt-1 block">Critical priority pending</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Fulfilled Requests
          </span>
          <span className="text-3xl font-extrabold text-emerald-600 mt-1 block">
            {kpis.fulfilled_requests_count ?? 0}
          </span>
          <span className="text-xs text-emerald-500 font-medium mt-1 block">Fully delivered</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Units Received
          </span>
          <span className="text-3xl font-extrabold text-blue-600 mt-1 block">
            {kpis.total_units_received ?? 0} / {kpis.total_units_requested ?? 0}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Delivered vs requested</span>
        </div>
      </div>

      {/* Network Blood Group Availability Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Regional Blood Network Availability
            </h2>
            <p className="text-xs text-slate-500">
              Live available units across certified blood centers to help triage transfusions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {networkAvailability.map((g: any) => (
            <div
              key={g.blood_group}
              className={`p-3.5 rounded-xl border text-center ${
                g.is_low_stock
                  ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
              }`}
            >
              <span className="text-base font-extrabold text-slate-900 dark:text-white block">
                {g.blood_group}
              </span>
              <span className="text-xl font-black text-red-600 dark:text-red-500 my-0.5 block">
                {g.available_units}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                {g.is_low_stock ? "Low Reserve" : "In Stock"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital Submitted Requests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Our Blood Requests Tracking
          </h2>
          <p className="text-xs text-slate-500">
            Live updates on pending, approved, and fulfilled blood orders
          </p>
        </div>

        {myRequests.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No blood requests created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Req ID</th>
                  <th className="py-3 px-3">Group</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Fulfilled</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Required Time</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Clinical Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {myRequests.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-slate-500">#{r.id}</td>
                    <td className="py-3 px-3 font-bold text-red-600">{r.blood_group}</td>
                    <td className="py-3 px-3 font-semibold">{r.quantity} units</td>
                    <td className="py-3 px-3 text-slate-500">{r.fulfilled_quantity} units</td>
                    <td className="py-3 px-3">
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
                    <td className="py-3 px-3 text-xs text-slate-500">
                      {new Date(r.required_datetime).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3">
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
                    <td className="py-3 px-3 text-xs text-slate-500 max-w-xs truncate" title={r.notes}>
                      {r.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Emergency Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-600 mb-2">
              <Zap className="w-5 h-5 fill-red-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Submit Blood Request
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Dispatches emergency requirement to central blood banks and triggers automated priority notification.
            </p>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Required By
                  </label>
                  <input
                    type="datetime-local"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Clinical Emergency Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Trauma Bay 1 acute hemorrhage, O- universal donor required immediately"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md shadow-red-500/20"
                >
                  {submitLoading ? "Transmitting..." : "Submit Emergency Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
