const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // For CSV or blob downloads
  if (options.responseType === 'blob') {
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export const api = {
  getHealth: (options) => request('/health', options),
  getDashboard: (options) => request('/dashboard', options),
  
  createCollectionJob: (urls, mode = 'live') =>
    request('/collection-jobs', {
      method: 'POST',
      body: JSON.stringify({ urls, mode }),
    }),
  getCollectionJobs: (page = 1, limit = 10, options) =>
    request(`/collection-jobs?page=${page}&limit=${limit}`, options),
  getCollectionJobById: (id, options) => request(`/collection-jobs/${id}`, options),

  getLeads: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    return request(`/leads?${query.toString()}`, options);
  },
  getLeadById: (id, options) => request(`/leads/${id}`, options),
  updateLead: (id, payload) =>
    request(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteLead: (id) =>
    request(`/leads/${id}`, {
      method: 'DELETE',
    }),

  getQualificationSettings: (options) => request('/qualification-settings', options),
  updateQualificationSettings: (settings) =>
    request('/qualification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // AI Assistant APIs
  getAiStatus: (options) => request('/ai/status', options),
  generateAiSummary: (leadId, forceRegenerate = false, mock = false) =>
    request(`/leads/${leadId}/ai-summary`, {
      method: 'POST',
      body: JSON.stringify({ forceRegenerate, mock }),
    }),
  generateAiOutreach: (leadId, payload = {}) =>
    request(`/leads/${leadId}/ai-outreach`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportLeads: async ({ leadIds, filters }) => {
    const blob = await request('/leads/export', {
      method: 'POST',
      body: JSON.stringify({ leadIds, filters }),
      responseType: 'blob',
    });

    // Trigger browser file download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `leadlens_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
