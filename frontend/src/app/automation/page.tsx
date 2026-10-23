"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Cpu,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Zap,
  Activity,
  Workflow,
} from "lucide-react";

export default function AutomationPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchData = async () => {
    // Automation feature disabled from RBAC
    router.push("/dashboard");
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTrigger = async (wfId: string) => {
    try {
      setTriggeringId(wfId);
      setStatusMessage(null);
      const res = await api.triggerWorkflow(wfId);
      setStatusMessage(`Workflow '${wfId}' triggered successfully.`);
      await fetchData();
    } catch (err: any) {
      setStatusMessage(`Trigger error: ${err.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Workflow Automation Hub
            </h1>
            <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-red-300">
              5 Active Workflows
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Automated event orchestration connecting BloodBridge APIs, scheduled triggers, and staff notifications.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid of 6 Production Workflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-md border border-red-200">
                  {wf.id}
                </span>
                <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  <span>Configured</span>
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {wf.name}
                </h3>
                <div className="text-xs text-slate-500 mt-1 space-y-1">
                  <div><strong>Trigger:</strong> {wf.trigger}</div>
                  <div><strong>Action:</strong> {wf.target}</div>
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded truncate">
                {wf.webhook_endpoint}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleTrigger(wf.id)}
                disabled={triggeringId === wf.id}
                className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-60"
              >
                <Play className={`w-3.5 h-3.5 ${triggeringId === wf.id ? "animate-spin" : ""}`} />
                <span>{triggeringId === wf.id ? "Triggering..." : "Simulate / Drill Trigger"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Execution Log Table */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>Recent Automation Execution Log</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-2.5">Time</th>
                <th className="p-2.5">Workflow Name</th>
                <th className="p-2.5">Event Type</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Payload Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No automation events recorded yet. Click &quot;Simulate / Drill Trigger&quot; above to invoke a workflow.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                      {evt.workflow_name}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {evt.event_type}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {evt.status}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                      {JSON.stringify(evt.payload)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
