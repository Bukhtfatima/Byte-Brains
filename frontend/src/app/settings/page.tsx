"use client";

import React, { useEffect, useState } from "react";
import { api, getCurrentUser } from "@/lib/api";
import {
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  Hospital,
  Building2,
  Sliders,
  Shield,
} from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    expiry_warning_days: 14,
    expiry_urgent_days: 7,
    expiry_critical_days: 3,
    min_inventory_thresholds: {
      "O-": 12,
      "O+": 20,
      "A-": 8,
      "A+": 16,
      "B-": 8,
      "B+": 16,
      "AB-": 4,
      "AB+": 8,
    },
  });
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [bloodBanks, setBloodBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [st, hs, bbs] = await Promise.all([
          api.getSettings().catch(() => null),
          api.getHospitals().catch(() => []),
          api.getBloodBanks().catch(() => []),
        ]);
        if (st) {
          setSettings((prev: any) => ({ ...prev, ...st }));
        }
        setHospitals(hs || []);
        setBloodBanks(bbs || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleSaveThresholds = async () => {
    try {
      setSaving(true);
      await api.updateSetting("expiry_warning_days", String(settings.expiry_warning_days));
      await api.updateSetting("expiry_urgent_days", String(settings.expiry_urgent_days));
      await api.updateSetting("expiry_critical_days", String(settings.expiry_critical_days));
      await api.updateSetting("min_inventory_thresholds", JSON.stringify(settings.min_inventory_thresholds));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert("Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Configuration & Thresholds
            </h1>
            <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-300">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure expiry detection windows, blood-group safety buffers, and manage participating healthcare institutions.
          </p>
        </div>

        <button
          onClick={handleSaveThresholds}
          disabled={saving}
          className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Saving..." : "Save Configuration"}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Threshold configuration updated and persisted across database services.</span>
        </div>
      )}

      {/* Expiry Monitoring Windows */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-red-600" />
          <span>Automated Expiry Monitoring Windows (Days)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Warning Window (Days)
            </label>
            <input
              type="number"
              value={settings.expiry_warning_days || 14}
              onChange={(e) =>
                setSettings({ ...settings, expiry_warning_days: parseInt(e.target.value) || 14 })
              }
              className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-900"
            />
            <span className="text-[11px] text-slate-400 block mt-1">FIFO prioritization advisory</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Urgent Window (Days)
            </label>
            <input
              type="number"
              value={settings.expiry_urgent_days || 7}
              onChange={(e) =>
                setSettings({ ...settings, expiry_urgent_days: parseInt(e.target.value) || 7 })
              }
              className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-900"
            />
            <span className="text-[11px] text-slate-400 block mt-1">Triggers Workflow 2 expiry alerts</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Critical Window (Days)
            </label>
            <input
              type="number"
              value={settings.expiry_critical_days || 3}
              onChange={(e) =>
                setSettings({ ...settings, expiry_critical_days: parseInt(e.target.value) || 3 })
              }
              className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-900"
            />
            <span className="text-[11px] text-slate-400 block mt-1">High-priority triage notification</span>
          </div>
        </div>
      </div>

      {/* Low-Stock Thresholds */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Minimum Low-Stock Buffer (Units per Blood Group)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"].map((bg) => (
            <div key={bg} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">{bg}</span>
              <input
                type="number"
                value={settings.min_inventory_thresholds?.[bg] ?? 10}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    min_inventory_thresholds: {
                      ...settings.min_inventory_thresholds,
                      [bg]: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="w-14 text-right p-1.5 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-900"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Participating Facilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
            <Hospital className="w-4 h-4 text-blue-600" />
            <span>Authorized Hospitals ({hospitals.length})</span>
          </h3>
          <div className="space-y-2 text-xs">
            {hospitals.map((h) => (
              <div key={h.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">{h.name}</div>
                <div className="text-[11px] text-slate-400">{h.location} • {h.contact_information}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-red-600" />
            <span>Participating Blood Banks ({bloodBanks.length})</span>
          </h3>
          <div className="space-y-2 text-xs">
            {bloodBanks.map((bb) => (
              <div key={bb.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">{bb.name}</div>
                <div className="text-[11px] text-slate-400">{bb.location} • {bb.contact_information}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
