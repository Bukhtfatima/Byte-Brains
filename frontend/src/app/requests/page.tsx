"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Droplet,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Zap,
} from "lucide-react";
import { api, getCurrentUser, UserSession } from "@/lib/api";

export default function RequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  // Create Request Modal state
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

  // Fulfillment Modal state
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [fulfillUnits, setFulfillUnits] = useState<number>(0);
  const [fulfillNote, setFulfillNote] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      const data = await api.getRequests({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        blood_group: groupFilter || undefined,
      });
      setRequests(data);
    } catch (err: any) {
      alert(err.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, priorityFilter, groupFilter]);

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
      await loadRequests();
    } catch (err: any) {
      alert(`Submission Error: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleApprove = async (reqId: number) => {
    try {
      setActionLoading(true);
      await api.updateRequestStatus(reqId, "Approved", "Approved by blood bank staff");
      await loadRequests();
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
      await loadRequests();
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
      await loadRequests();
    } catch (err: any) {
      alert(`Fulfillment Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Blood Supply Requests & Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time inter-facility blood requests, priority alerts, and authorized dispatch
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {(user?.role === "hospital_staff" || user?.role === "admin") && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md shadow-red-500/20 text-sm flex items-center space-x-2 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Blood Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Blood group */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Blood Groups</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Reviewing">Reviewing</option>
            <option value="Approved">Approved</option>
            <option value="Partially Fulfilled">Partially Fulfilled</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="Urgent">Urgent</option>
            <option value="Normal">Normal</option>
          </select>

          {(statusFilter || priorityFilter || groupFilter) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setPriorityFilter("");
                setGroupFilter("");
              }}
              className="text-xs text-red-600 font-semibold hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing {requests.length} request(s)
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
            <p className="text-sm">Loading blood requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">No blood requests match filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="py-3 px-4">Req ID</th>
                  <th className="py-3 px-4">Hospital Facility</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Fulfilled</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Required Datetime</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-medium text-slate-500">#{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {r.hospital_name || "Hospital"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-base text-red-600 dark:text-red-500">
                        {r.blood_group}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {r.quantity} units
                    </td>
                    <td className="py-3 px-4 text-slate-500">{r.fulfilled_quantity} units</td>
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(r.required_datetime).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title={r.notes}>
                      {r.notes || "—"}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {(user?.role === "blood_bank_staff" || user?.role === "admin") && (
                        <>
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
                              className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-red-600"
                            >
                              Reject
                            </button>
                          )}
                        </>
                      )}
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
                  placeholder="e.g. Dispatched via Transit Unit #2"
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
                  {actionLoading ? "Deducting from Inventory..." : "Confirm & Fulfill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
