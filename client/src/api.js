import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', withCredentials: true });
export const messageOf = (error) => error.response?.data?.message || 'Unable to complete that request. Please try again.';
export const notify = (text, type = 'success') => window.dispatchEvent(new CustomEvent('crm:notice', { detail: { text, type } }));
api.interceptors.response.use((response) => { const method = response.config.method?.toLowerCase(); if (['post', 'put', 'delete'].includes(method) && !response.config.url.includes('/auth/')) notify(method === 'delete' ? 'Deleted successfully.' : 'Saved successfully.'); return response; });
export default api;
