"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Info,
  Layers,
} from "lucide-react";

export default function RiskMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getRisks();
      setAssessments(res.assessments || []);
    } catch (err: any) {
      setError(err.message || "Failed to load risk engine data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, []);

  const handleRecalculate = async () => {
    try {
      setGenerating(true);
      await api.generateRisks();
      await fetchRisks();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "HIGH":
        return (
          <span className="flex items-center space-x-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>HIGH SHORTAGE RISK</span>
          </span>
        );
      case "MEDIUM":
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>ELEVATED VULNERABILITY</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SUFFICIENT BUFFER</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Explainable Risk Engine
            </h1>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-slate-300">
              Zero Black-Box
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Multifactor evaluation correlating current inventory, projected usage, pending requests, and expiry windows.
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={generating}
          className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
          <span>{generating ? "Evaluating Factors..." : "Re-evaluate Regional Risks"}</span>
        </button>
      </div>

      {/* Philosophy Banner */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start space-x-3 text-xs text-slate-600 dark:text-slate-300">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">Explainability Mandate:</span> BloodBridge does not provide cryptic AI scores. Every operational alert displays verified contributing parameters so clinical directors can trace the exact underlying reasons.
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading explainable risk models...</div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>
      ) : (
        <div className="space-y-4">
          {assessments.map((a: any) => {
            const isHigh = a.risk_level === "HIGH";
            const isMedium = a.risk_level === "MEDIUM";

            return (
              <div
                key={a.blood_group}
                className={`p-6 rounded-xl border bg-white dark:bg-slate-900 transition-shadow hover:shadow-md ${
                  isHigh
                    ? "border-red-300 dark:border-red-900 ring-1 ring-red-500/20 bg-red-50/20"
                    : isMedium
                    ? "border-amber-200 dark:border-amber-900/40"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {a.blood_group}
                    </span>
                    <div>
                      {getRiskBadge(a.risk_level)}
                      <span className="text-xs text-slate-400 ml-2">
                        Updated {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs">
                    <div>
                      <span className="text-slate-400 block">Available</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {a.current_inventory} units
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">7d Demand</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {a.predicted_demand} units
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Expiring (7d)</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {a.expiring_units} units
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Active Requests</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {a.active_requests}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explainable Contributing Factors */}
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Contributing Factors & Mathematical Drivers:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {a.reasons?.map((r: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actionable Suggestions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400">
                    Recommended action: {isHigh ? "Initiate donor mobilization and query regional blood bank coordination." : "Maintain normal FIFO allocation."}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
