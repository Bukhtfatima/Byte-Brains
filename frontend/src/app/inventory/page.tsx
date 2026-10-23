"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Droplet,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  Edit2,
  CheckCircle2,
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  // Add Batch Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGroup, setNewGroup] = useState("O-");
  const [newQuantity, setNewQuantity] = useState(5);
  const [newCollectionDate, setNewCollectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newExpiryDate, setNewExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 35);
    return d.toISOString().slice(0, 10);
  });
  const [newBatchId, setNewBatchId] = useState(`BATCH-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newStorage, setNewStorage] = useState("Refrig-A1");
  const [addLoading, setAddLoading] = useState(false);

  // Edit Batch Modal state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>("Available");
  const [editStorage, setEditStorage] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const user = getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const data = await api.getInventory({
        blood_group: bloodGroupFilter || undefined,
        status: statusFilter || undefined,
        expiry_urgency: urgencyFilter || undefined,
        search: search || undefined,
      });
      setItems(data);
    } catch (err: any) {
      alert(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [bloodGroupFilter, statusFilter, urgencyFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInventory();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      await api.addInventoryBatch({
        blood_group: newGroup,
        quantity: Number(newQuantity),
        collection_date: newCollectionDate,
        expiry_date: newExpiryDate,
        batch_id: newBatchId,
        storage_location: newStorage,
        status: "Available",
      });
      setShowAddModal(false);
      setNewBatchId(`BATCH-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      await loadInventory();
    } catch (err: any) {
      alert(`Add Batch Error: ${err.message}`);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setEditLoading(true);
      await api.updateInventoryBatch(editingItem.id, {
        quantity: Number(editQuantity),
        status: editStatus,
        storage_location: editStorage,
      });
      setEditingItem(null);
      await loadInventory();
    } catch (err: any) {
      alert(`Update Error: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const getUrgencyBadge = (urgency: string, days: number) => {
    switch (urgency) {
      case "Critical":
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            <span>{days}d (Critical)</span>
          </span>
        );
      case "Urgent":
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            {days}d (Urgent)
          </span>
        );
      case "Warning":
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border border-yellow-300">
            {days}d (Warning)
          </span>
        );
      case "Expired":
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200 border border-red-400">
            Expired ({Math.abs(days)}d ago)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
            {days}d remaining
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Blood Inventory Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track multi-unit batches, dynamic shelf life, FEFO allocation, and storage locations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md shadow-red-500/20 text-sm flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Blood Batch</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search Batch ID or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Blood Group Filter */}
          <select
            value={bloodGroupFilter}
            onChange={(e) => setBloodGroupFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Blood Groups</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Reserved">Reserved</option>
            <option value="Issued">Issued</option>
            <option value="Expired">Expired</option>
            <option value="Quarantined">Quarantined</option>
          </select>

          {/* Expiry Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
          >
            <option value="">All Expiries</option>
            <option value="Critical">Critical (≤3d)</option>
            <option value="Urgent">Urgent (≤7d)</option>
            <option value="Warning">Warning (≤14d)</option>
            <option value="Normal">Normal (&gt;14d)</option>
            <option value="Expired">Expired</option>
          </select>

          {(bloodGroupFilter || statusFilter || urgencyFilter || search) && (
            <button
              onClick={() => {
                setBloodGroupFilter("");
                setStatusFilter("");
                setUrgencyFilter("");
                setSearch("");
              }}
              className="text-xs text-red-600 font-semibold hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Inventory Batches Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
            <p className="text-sm">Loading inventory batches...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">No inventory batches match the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Units</th>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Storage Location</th>
                  <th className="py-3 px-4">Collected</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Shelf Life Urgency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {b.batch_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-base text-red-600 dark:text-red-500">
                        {b.blood_group}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {b.quantity}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {b.blood_bank_name || "Central Blood Bank"}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {b.storage_location}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {b.collection_date}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {b.expiry_date}
                    </td>
                    <td className="py-3 px-4">
                      {getUrgencyBadge(b.expiry_urgency, b.days_until_expiry)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          b.status === "Available"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                            : b.status === "Reserved"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300"
                            : b.status === "Expired"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingItem(b);
                          setEditQuantity(b.quantity);
                          setEditStatus(b.status);
                          setEditStorage(b.storage_location);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Batch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Log Incoming Blood Donation Batch
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter verified laboratory batch details. Dynamic expiry will be tracked automatically.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
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
                    Units (Bags)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Batch Identifier
                </label>
                <input
                  type="text"
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Collection Date
                  </label>
                  <input
                    type="date"
                    value={newCollectionDate}
                    onChange={(e) => setNewCollectionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={newStorage}
                  onChange={(e) => setNewStorage(e.target.value)}
                  placeholder="e.g. Refrig-A1, Shelf 3"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md shadow-red-500/20"
                >
                  {addLoading ? "Saving..." : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Edit Batch {editingItem.batch_id}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Group: <span className="font-bold text-red-600">{editingItem.blood_group}</span> &bull; Expiry: {editingItem.expiry_date}
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Available Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={editStorage}
                  onChange={(e) => setEditStorage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Inventory Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Issued">Issued</option>
                  <option value="Expired">Expired</option>
                  <option value="Quarantined">Quarantined</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
                >
                  {editLoading ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
