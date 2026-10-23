"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Heart,
  Droplet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Search,
  Calendar,
  Activity,
  Plus,
  X,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function DonorsPage() {
  const router = useRouter();
  const [donors, setDonors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<any | null>(null);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [activeDonorForDonation, setActiveDonorForDonation] = useState<any | null>(null);
  const [quickMatchGroup, setQuickMatchGroup] = useState<string>("");

  // New Donor Form state
  const [newDonor, setNewDonor] = useState({
    name: "",
    blood_group: "O-",
    gender: "Male",
    phone: "",
    email: "",
    address: "",
    medical_notes: "",
  });

  // Donation Form state
  const [donationForm, setDonationForm] = useState({
    blood_bank_id: 1,
    units: 1,
    hemoglobin: 14.5,
    blood_pressure: "120/80",
    notes: "Routine intake donation.",
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadDonors = async () => {
    try {
      setLoading(true);
      const user = getCurrentUser();
      if (!user || user.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      const data = await api.getDonors({
        blood_group: selectedGroup || undefined,
        eligible_only: eligibleOnly || undefined,
        search: search || undefined,
      });
      setDonors(data);
    } catch (err: any) {
      console.error("Failed to load donors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDonors();
  }, [selectedGroup, eligibleOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDonors();
  };

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await api.createDonor(newDonor);
      setFormSuccess("Donor successfully registered!");
      setShowRegisterModal(false);
      setNewDonor({
        name: "",
        blood_group: "O-",
        gender: "Male",
        phone: "",
        email: "",
        address: "",
        medical_notes: "",
      });
      loadDonors();
    } catch (err: any) {
      setFormError(err.message || "Failed to register donor");
    }
  };

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!activeDonorForDonation) return;

    try {
      await api.recordDonation(activeDonorForDonation.id, {
        ...donationForm,
        hemoglobin: Number(donationForm.hemoglobin),
        units: Number(donationForm.units),
      });
      setShowDonateModal(false);
      setActiveDonorForDonation(null);
      loadDonors();
    } catch (err: any) {
      setFormError(err.message || "Failed to record donation");
    }
  };

  // Quick stats
  const totalDonors = donors.length;
  const eligibleDonors = donors.filter((d) => d.is_eligible).length;
  const deferredDonors = totalDonors - eligibleDonors;
  const universalDonors = donors.filter((d) => d.blood_group === "O-").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Donor Management & Eligibility
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                WHO 56-day cooldown tracking, intake donation logging & emergency donor matching
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Register Donor
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Donors
            </span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {totalDonors}
            </span>
            <span className="text-xs text-slate-500">Registered</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Eligible Now
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {eligibleDonors}
            </span>
            <span className="text-xs text-slate-500">Ready to donate</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              In Cooldown
            </span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {deferredDonors}
            </span>
            <span className="text-xs text-slate-500">&lt;56 days window</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Universal O- Donors
            </span>
            <Droplet className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {universalDonors}
            </span>
            <span className="text-xs text-slate-500">Universal type</span>
          </div>
        </div>
      </div>

      {/* Emergency Quick-Match Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border border-red-500/30 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Emergency Shortage Quick-Match</h3>
            <p className="text-xs text-slate-300">
              Filter immediately eligible donors for critical hospital trauma requests.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BLOOD_GROUPS.map((bg) => (
            <button
              key={bg}
              onClick={() => {
                setSelectedGroup(selectedGroup === bg ? "" : bg);
                setEligibleOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                selectedGroup === bg && eligibleOnly
                  ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-900/50"
                  : "bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Find {bg}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Blood Group Select */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="">All Blood Groups</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                Group {bg}
              </option>
            ))}
          </select>

          {/* Eligible only toggle */}
          <button
            onClick={() => setEligibleOnly(!eligibleOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              eligibleOnly
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"
                : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Eligible Donors Only
          </button>
        </div>
      </div>

      {/* Donors List Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Donor Name</th>
                <th className="py-3.5 px-4">Blood Group</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Last Donation</th>
                <th className="py-3.5 px-4">Eligibility Status</th>
                <th className="py-3.5 px-4">Total Donated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading donors...
                  </td>
                </tr>
              ) : donors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No donors found matching criteria.
                  </td>
                </tr>
              ) : (
                donors.map((donor) => {
                  const isEligible = donor.is_eligible;
                  return (
                    <tr
                      key={donor.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {donor.name}
                        </div>
                        <span className="text-xs text-slate-400">
                          {donor.gender} • {donor.address || "Area registered"}
                        </span>
                      </td>

                      {/* Blood Group */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900">
                          <Droplet className="w-3 h-3 fill-current" />
                          {donor.blood_group}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-xs">
                          <a
                            href={`tel:${donor.phone}`}
                            className="text-slate-700 dark:text-slate-300 hover:text-red-600 flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            {donor.phone}
                          </a>
                          {donor.email && (
                            <span className="text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" />
                              {donor.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Donation */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {donor.last_donation_date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {donor.last_donation_date}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">First time</span>
                        )}
                      </td>

                      {/* Eligibility Status */}
                      <td className="py-3.5 px-4">
                        {isEligible ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Eligible Now
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            {donor.days_until_eligible}d cooldown
                          </span>
                        )}
                      </td>

                      {/* Total Donated */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {donor.total_donations} unit(s)
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setActiveDonorForDonation(donor);
                              setShowDonateModal(true);
                            }}
                            disabled={!isEligible}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isEligible
                                ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed"
                            }`}
                            title={isEligible ? "Record Blood Donation" : "In 56-day cooldown"}
                          >
                            Intake Blood
                          </button>

                          <button
                            onClick={async () => {
                              const detail = await api.getDonorById(donor.id);
                              setSelectedDonor(detail);
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register New Donor */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-red-600" />
              Register New Donor
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Add a voluntary blood donor to the regional BloodBridge network.
            </p>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 text-xs border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterDonor} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newDonor.name}
                  onChange={(e) => setNewDonor({ ...newDonor, name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Blood Group
                  </label>
                  <select
                    value={newDonor.blood_group}
                    onChange={(e) => setNewDonor({ ...newDonor, blood_group: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Gender
                  </label>
                  <select
                    value={newDonor.gender}
                    onChange={(e) => setNewDonor({ ...newDonor, gender: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+1-555-0100"
                    value={newDonor.phone}
                    onChange={(e) => setNewDonor({ ...newDonor, phone: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="donor@example.com"
                    value={newDonor.email}
                    onChange={(e) => setNewDonor({ ...newDonor, email: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central City Area"
                  value={newDonor.address}
                  onChange={(e) => setNewDonor({ ...newDonor, address: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Medical & Eligibility Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Healthy, regular donor, verified Rh factor"
                  value={newDonor.medical_notes}
                  onChange={(e) => setNewDonor({ ...newDonor, medical_notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-500 dark:placeholder:text-white placeholder:font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm"
                >
                  Register Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Blood Donation */}
      {showDonateModal && activeDonorForDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowDonateModal(false);
                setActiveDonorForDonation(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-600 fill-red-600" />
              Intake Blood Donation
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Donor: <strong className="text-slate-900 dark:text-white">{activeDonorForDonation.name}</strong> ({activeDonorForDonation.blood_group})
            </p>

            <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
              ⚡ <strong>Automatic Action:</strong> Recording this donation will create a new inventory batch with 42-day expiry and push a live WebSocket notification to network staff.
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 text-xs border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordDonation} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Units Collected
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={donationForm.units}
                    onChange={(e) => setDonationForm({ ...donationForm, units: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Hemoglobin (g/dL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={donationForm.hemoglobin}
                    onChange={(e) => setDonationForm({ ...donationForm, hemoglobin: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Blood Pressure (mmHg)
                </label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={donationForm.blood_pressure}
                  onChange={(e) => setDonationForm({ ...donationForm, blood_pressure: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Intake Notes
                </label>
                <input
                  type="text"
                  value={donationForm.notes}
                  onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDonateModal(false)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Droplet className="w-4 h-4 fill-white" />
                  Confirm & Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Donor Details & History Drawer */}
      {selectedDonor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedDonor(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 flex items-center justify-center font-bold text-lg">
                {selectedDonor.blood_group}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedDonor.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDonor.gender} • Registered on {new Date(selectedDonor.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Quick stats in drawer */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-400 block">Eligibility</span>
                <span className={`text-sm font-bold ${selectedDonor.is_eligible ? "text-emerald-500" : "text-amber-500"}`}>
                  {selectedDonor.is_eligible ? "Eligible Now" : `${selectedDonor.days_until_eligible} days remaining`}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-400 block">Total Donations</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedDonor.total_donations} unit(s)
                </span>
              </div>
            </div>

            {/* Medical notes */}
            {selectedDonor.medical_notes && (
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-500 block mb-1">Medical Record</span>
                <p className="text-slate-700 dark:text-slate-300">{selectedDonor.medical_notes}</p>
              </div>
            )}

            {/* Donation History Timeline */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Donation History Timeline
              </h4>

              {selectedDonor.donations && selectedDonor.donations.length > 0 ? (
                <div className="space-y-3">
                  {selectedDonor.donations.map((d: any) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            {d.units} unit(s) ({d.blood_group})
                          </span>
                          {d.hemoglobin && (
                            <span className="text-[11px] text-slate-400">
                              Hb: {d.hemoglobin} g/dL
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          Date: {d.donation_date} • BP: {d.blood_pressure || "N/A"}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                        Added to Stock
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No donations recorded yet.</p>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDonor(null)}
                className="px-4 py-2 text-sm rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
