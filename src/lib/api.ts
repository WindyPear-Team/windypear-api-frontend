import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getAuthLoginURL = (referralCode?: string | null, agreementAccepted = false) => {
  return getOAuthLoginURL("/auth/login", referralCode, agreementAccepted);
};

export const getOAuthLoginURL = (loginURL: string, referralCode?: string | null, agreementAccepted = false) => {
  const code = (referralCode || localStorage.getItem("referral_code") || "").trim();
  const params = new URLSearchParams();
  if (code) {
    params.set("ref", code);
  }
  if (agreementAccepted) {
    params.set("agreement_accepted", "true");
  }
  const query = params.toString();
  return query ? `${loginURL}?${query}` : loginURL;
};

// Add a request interceptor to include the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
