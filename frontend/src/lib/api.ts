const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface UserSession {
  access_token: string;
  token_type: string;
  role: "admin" | "blood_bank_staff" | "hospital_staff";
  name: string;
  email: string;
  organization_type?: string;
  organization_id?: number;
  organization_name?: string;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bloodbridge_token");
}

export function getCurrentUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("bloodbridge_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  localStorage.setItem("bloodbridge_token", session.access_token);
  localStorage.setItem("bloodbridge_user", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("bloodbridge_token");
  localStorage.removeItem("bloodbridge_user");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const data = await res.json();
      // FastAPI validation errors return detail as an array of { loc, msg }
      if (Array.isArray(data.detail)) {
        errorDetail = data.detail
          .map((d: any) => `${(d.loc || []).filter((p: any) => p !== "body").join(".")}: ${d.msg}`)
          .join("; ");
      } else if (typeof data.detail === "string") {
        errorDetail = data.detail;
      } else {
        errorDetail = JSON.stringify(data.detail ?? data);
      }
    } catch {
      errorDetail = res.statusText;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<UserSession> => {
    const data = await request<UserSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(data);
    return data;
  },

  register: async (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    organization_type?: string;
    hospital_id?: number;
    blood_bank_id?: number;
  }): Promise<UserSession> => {
    const data = await request<UserSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveSession(data);
    return data;
  },

  getPublicOrganizations: () =>
    request<{
      hospitals: Array<{ id: number; name: string; location: string }>;
      blood_banks: Array<{ id: number; name: string; location: string }>;
    }>("/auth/organizations"),

  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  },

  getMe: () => request<any>("/auth/me"),

  // Inventory
  getInventory: (params?: {
    blood_group?: string;
    status?: string;
    blood_bank_id?: number;
    expiry_urgency?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.blood_group) query.set("blood_group", params.blood_group);
    if (params?.status) query.set("status", params.status);
    if (params?.blood_bank_id) query.set("blood_bank_id", params.blood_bank_id.toString());
    if (params?.expiry_urgency) query.set("expiry_urgency", params.expiry_urgency);
    if (params?.search) query.set("search", params.search);
    return request<any[]>(`/inventory?${query.toString()}`);
  },

  getInventorySummary: (blood_bank_id?: number) => {
    const q = blood_bank_id ? `?blood_bank_id=${blood_bank_id}` : "";
    return request<any>(`/inventory/summary${q}`);
  },

  getLowStock: () => request<any>("/inventory/low-stock"),

  getExpiringInventory: (days?: number) => {
    const q = days ? `?days=${days}` : "";
    return request<any[]>(`/inventory/expiring${q}`);
  },

  addInventoryBatch: (batchData: any) =>
    request<any>("/inventory", {
      method: "POST",
      body: JSON.stringify(batchData),
    }),

  updateInventoryBatch: (id: number, data: any) =>
    request<any>(`/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Requests
  getRequests: (params?: {
    status?: string;
    priority?: string;
    blood_group?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.priority) query.set("priority", params.priority);
    if (params?.blood_group) query.set("blood_group", params.blood_group);
    return request<any[]>(`/requests?${query.toString()}`);
  },

  createRequest: (reqData: any) =>
    request<any>("/requests", {
      method: "POST",
      body: JSON.stringify(reqData),
    }),

  updateRequestStatus: (id: number, status: string, notes?: string) =>
    request<any>(`/requests/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, notes }),
    }),

  fulfillRequest: (id: number, units_to_fulfill?: number, notes?: string) =>
    request<any>(`/requests/${id}/fulfill`, {
      method: "POST",
      body: JSON.stringify({ units_to_fulfill, notes }),
    }),

  // Dashboards
  getBloodBankDashboard: () => request<any>("/dashboards/blood-bank"),
  getHospitalDashboard: () => request<any>("/dashboards/hospital"),
  getAdminDashboard: () => request<any>("/dashboards/admin"),

  // Organizations
  getHospitals: () => request<any[]>("/hospitals"),
  getBloodBanks: () => request<any[]>("/blood-banks"),

  // Audit Logs
  getAuditLogs: (params?: { limit?: number; entity_type?: string; action?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.action) query.set("action", params.action);
    return request<any[]>(`/audit-logs?${query.toString()}`);
  },

  // Explainable Risk Engine
  getRisks: () => request<any>("/risks"),
  getRiskForGroup: (bloodGroup: string) => request<any>(`/risks/${encodeURIComponent(bloodGroup)}`),
  generateRisks: () => request<any>("/risks/generate", { method: "POST" }),

  // Multi-Blood-Bank Coordination
  getMultiBankCoordination: (bloodGroup: string, quantityNeeded?: number) => {
    const q = quantityNeeded ? `?quantity_needed=${quantityNeeded}` : "";
    return request<any>(`/inventory/coordination/${encodeURIComponent(bloodGroup)}${q}`);
  },


  // Analytics
  getAnalytics: () => request<any>("/analytics"),

  // Internal Automation & Workflows
  getAutomationWorkflows: () => request<any[]>("/automation/workflows"),
  getAutomationEvents: (limit: number = 50) =>
    request<any[]>(`/automation/events?limit=${limit}`),
  triggerWorkflow: (workflowId: string) =>
    request<any>(`/automation/trigger/${workflowId}`, { method: "POST" }),

  // Notifications
  getNotifications: () => request<any[]>("/notifications"),
  markNotificationRead: (id: number) =>
    request<any>(`/notifications/${id}/read`, { method: "PUT" }),

  // BloodBridge Assistant (Grounded Chatbot)
  chatMessage: (message: string) =>
    request<any>("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  confirmChatAction: (action_type: string, parameters: any) =>
    request<any>("/chat/confirm", {
      method: "POST",
      body: JSON.stringify({ action_type, parameters }),
    }),

  // Donors & Donations
  getDonors: (params?: {
    blood_group?: string;
    status?: string;
    eligible_only?: boolean;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.blood_group) query.set("blood_group", params.blood_group);
    if (params?.status) query.set("status", params.status);
    if (params?.eligible_only) query.set("eligible_only", "true");
    if (params?.search) query.set("search", params.search);
    return request<any[]>(`/donors?${query.toString()}`);
  },

  getQuickMatchDonors: (bloodGroup: string) =>
    request<any[]>(`/donors/quick-match/${encodeURIComponent(bloodGroup)}`),

  getDonorById: (id: number) => request<any>(`/donors/${id}`),

  createDonor: (donorData: any) =>
    request<any>("/donors", {
      method: "POST",
      body: JSON.stringify(donorData),
    }),

  updateDonor: (id: number, donorData: any) =>
    request<any>(`/donors/${id}`, {
      method: "PUT",
      body: JSON.stringify(donorData),
    }),

  recordDonation: (donorId: number, donationData: any) =>
    request<any>(`/donors/${donorId}/donate`, {
      method: "POST",
      body: JSON.stringify(donationData),
    }),

  // System Settings
  getSettings: () => request<any>("/system/settings"),
  updateSetting: (key: string, value: string) =>
    request<any>(`/system/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};

