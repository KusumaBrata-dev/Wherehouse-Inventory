import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wh_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wh_token');
      localStorage.removeItem('wh_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then(r => r.data);

// ── Items ─────────────────────────────────────────────────────────────────
export const getItems = (params) => api.get('/items', { params }).then(r => r.data);
export const getItem  = (id)     => api.get(`/items/${id}`).then(r => r.data);
export const createItem = (data) => api.post('/items', data).then(r => r.data);
export const updateItem = (id, data) => api.put(`/items/${id}`, data).then(r => r.data);
export const deleteItem = (id)   => api.delete(`/items/${id}`).then(r => r.data);
export const getItemQR  = (id)   => `/api/items/${id}/qr`;
export const getItemBarcode = (id) => `/api/items/${id}/barcode`;

// ── Stock ─────────────────────────────────────────────────────────────────
export const getStock = () => api.get('/stock').then(r => r.data);

// ── Scan ─────────────────────────────────────────────────────────────────
export const scanItem = (sku) => api.get(`/scan/${encodeURIComponent(sku)}`).then(r => r.data);

// ── Transactions ──────────────────────────────────────────────────────────
export const getTransactions = (params) => api.get('/transactions', { params }).then(r => r.data);
export const createTransaction = (data)  => api.post('/transactions', data).then(r => r.data);
export const exportTransactions = (params) => {
  const query = new URLSearchParams(params).toString();
  return `/api/transactions/export?${query}`;
};

// ── Suppliers ─────────────────────────────────────────────────────────────
export const getSuppliers  = ()        => api.get('/suppliers').then(r => r.data);
export const createSupplier = (data)   => api.post('/suppliers', data).then(r => r.data);
export const updateSupplier = (id, d)  => api.put(`/suppliers/${id}`, d).then(r => r.data);
export const deleteSupplier = (id)     => api.delete(`/suppliers/${id}`).then(r => r.data);

// ── Users ─────────────────────────────────────────────────────────────────
export const getUsers  = ()        => api.get('/users').then(r => r.data);
export const createUser = (data)   => api.post('/users', data).then(r => r.data);
export const updateUser = (id, d)  => api.put(`/users/${id}`, d).then(r => r.data);
export const deleteUser = (id)     => api.delete(`/users/${id}`).then(r => r.data);

// ── Rack ──────────────────────────────────────────────────────────────────
export const getRack   = (itemId)  => api.get(`/rack/${itemId}`).then(r => r.data);
export const createRack = (data)   => api.post('/rack', data).then(r => r.data);
export const updateRack = (id, d)  => api.put(`/rack/${id}`, d).then(r => r.data);
export const deleteRack = (id)     => api.delete(`/rack/${id}`).then(r => r.data);

export default api;
