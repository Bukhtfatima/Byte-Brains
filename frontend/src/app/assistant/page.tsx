"use client";

import React, { useState, useRef, useEffect } from "react";
import { api, getCurrentUser } from "@/lib/api";
import {
  Bot,
  Send,
  User,
  ShieldCheck,
  AlertTriangle,
  Database,
  Activity,
  CheckCircle,
  XCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface MessageItem {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sourceType?: string;
  pendingAction?: {
    action_type: string;
    parameters: any;
  };
  confirmed?: boolean;
  structuredData?: any;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello, I am the **BloodBridge Assistant**.\n\nI am directly grounded in your live blood inventory database and explainable risk engine.\n\nAsk me queries or prepare emergency requests below.",
      sourceType: "GUIDE",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickPrompts = [
    "How many O+ units are available?",
    "Which blood groups are low?",
    "Which units expire this week?",
    "Why is O- showing high shortage risk?",
    "How many emergency requests are pending?",
    "Create an emergency request for 6 units of O-",
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.chatMessage(text);
      const assistantMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: res.response_text,
        sourceType: res.source_type,
        pendingAction: res.pending_action,
        structuredData: res.structured_data,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: "I encountered an error querying the platform: " + err.message,
          sourceType: "GUIDE",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, actionType: string, params: any) => {
    try {
      setConfirming(true);
      const res = await api.confirmChatAction(actionType, params);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, confirmed: true } : m
        )
      );

      // Append confirmation success message
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          sender: "assistant",
          text: `✅ **Action Executed:** ${res.message}`,
          sourceType: "LIVE_DATABASE",
        },
      ]);
    } catch (err: any) {
      alert("Action execution failed: " + err.message);
    } finally {
      setConfirming(false);
    }
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case "LIVE_DATABASE":
        return (
          <span className="flex items-center space-x-1 text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
            <Database className="w-3 h-3" />
            <span>Live DB Verified</span>
          </span>
        );
      case "RISK_ENGINE":
        return (
          <span className="flex items-center space-x-1 text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            <span>Explainable Risk Engine</span>
          </span>
        );
      case "ACTION_CONFIRMATION":
        return (
          <span className="flex items-center space-x-1 text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
            <ShieldCheck className="w-3 h-3" />
            <span>Human Approval Gate</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            <HelpCircle className="w-3 h-3" />
            <span>System Guide</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              BloodBridge AI Assistant
            </h1>
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-300">
              Grounded NLP
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Query inventory, ask why shortage warnings exist, and trigger controlled actions with 2-step verification.
          </p>
        </div>
      </div>

      {/* Suggested Queries Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold shrink-0">Try asking:</span>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            className="shrink-0 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 h-[520px] flex flex-col shadow-sm overflow-hidden">
        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div
                key={m.id}
                className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isUser
                      ? "bg-slate-800 text-white"
                      : "bg-red-600 text-white shadow-sm"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`max-w-xl space-y-2 ${isUser ? "items-end text-right" : ""}`}>
                  {!isUser && m.sourceType && (
                    <div className="flex items-center space-x-2">
                      {getSourceBadge(m.sourceType)}
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-red-600 text-white rounded-tr-none"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-tl-none whitespace-pre-line"
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Controlled Action Confirmation Card */}
                  {m.pendingAction && !m.confirmed && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center space-x-1.5 font-bold text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Action Requires Human Authorization</span>
                      </div>
                      <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                        The assistant has structured this clinical action. Do you authorize dispatch to regional systems?
                      </p>
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={() =>
                            handleConfirmAction(m.id, m.pendingAction!.action_type, m.pendingAction!.parameters)
                          }
                          disabled={confirming}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1 disabled:opacity-60"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{confirming ? "Authorizing..." : "Confirm & Execute"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
              <Bot className="w-4 h-4 animate-spin text-red-600" />
              <span>Grounded engine querying database & ML models...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Ask a question or enter action (e.g., 'Will we have enough O+ for the next 7 days?')..."
            className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
