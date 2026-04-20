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

// ── Products ─────────────────────────────────────────────────────────────
export const getProducts = (params) => api.get('/products', { params }).then(r => r.data);
export const getProduct  = (id)     => api.get(`/products/${id}`).then(r => r.data);
export const createProduct = (data) => api.post('/products', data).then(r => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id)   => api.delete(`/products/${id}`).then(r => r.data);
export const getProductQR  = (id)   => `/api/products/${id}/qr`;
export const getProductBarcode = (id) => `/api/products/${id}/barcode`;
export const exportProductsExcel = () => `/api/products/export/excel`;

// ── Stock ─────────────────────────────────────────────────────────────────
export const getStock = () => api.get('/stock').then(r => r.data);

// ── Scan ─────────────────────────────────────────────────────────────────
export const scanProduct = (sku) => api.get(`/scan/${encodeURIComponent(sku)}`).then(r => r.data);

// ── Transactions ──────────────────────────────────────────────────────────
export const getTransactions = (params) => api.get('/transactions', { params }).then(r => r.data);
export const createTransaction = (data)  => api.post('/transactions', data).then(r => r.data);
export const exportTransactions = (params) => {
  const query = new URLSearchParams(params).toString();
  return `/api/transactions/export?${query}`;
};

// ── Users ─────────────────────────────────────────────────────────────────
export const getUsers  = ()        => api.get('/users').then(r => r.data);
export const createUser = (data)   => api.post('/users', data).then(r => r.data);
export const updateUser = (id, d)  => api.put(`/users/${id}`, d).then(r => r.data);
export const deleteUser = (id)     => api.delete(`/users/${id}`).then(r => r.data);

// ── Locations ─────────────────────────────────────────────────────────────
export const getFloors     = ()        => api.get('/locations/floors').then(r => r.data);
export const getLocations   = (floorId) => api.get('/locations', { params: { floorId } }).then(r => r.data);
export const createPallet   = (data)    => api.post('/locations/pallets', data).then(r => r.data);
export const createBox      = (data)    => api.post('/locations/boxes', data).then(r => r.data);
export const deleteBox      = (id)      => api.delete(`/locations/boxes/${id}`).then(r => r.data);
export const searchGlobal  = (q)       => api.get('/locations/search', { params: { q } }).then(r => r.data);
export const getBoxInventory = ()      => api.get('/locations/box-inventory').then(r => r.data);
export const getLocationQR = (type, id) => `/api/locations/qr?type=${type}&id=${id}`;
export const getOccupancyStats = ()    => api.get('/locations/stats/occupancy').then(r => r.data);

// ── Boxes ────────────────────────────────────────────────────────────────
export const updateBox = (id, data) => api.put('/locations/boxes/' + id, data).then(r => r.data);

// ── Suppliers (WMS Milestone 1) ──────────────────────────────────────────
export const getSuppliers   = ()        => api.get('/suppliers').then(r => r.data);
export const createSupplier = (data)    => api.post('/suppliers', data).then(r => r.data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data);
export const deleteSupplier = (id)      => api.delete(`/suppliers/${id}`).then(r => r.data);

// ── Purchase Orders (WMS Milestone 1) ─────────────────────────────────────
export const getPurchaseOrders = ()      => api.get('/purchase-orders').then(r => r.data);
export const getPurchaseOrder  = (id)    => api.get(`/purchase-orders/${id}`).then(r => r.data);
export const createPurchaseOrder = (data) => api.post('/purchase-orders', data).then(r => r.data);
export const cancelPurchaseOrder = (id) => api.put(`/purchase-orders/${id}/cancel`).then(r => r.data);
export const receivePurchaseOrder = (id, data) => api.post(`/purchase-orders/${id}/receive`, data).then(r => r.data);

// ── Rack ──────────────────────────────────────────────────────────────────
export const getRack   = (productId)  => api.get(`/rack/${productId}`).then(r => r.data);
export const createRack = (data)   => api.post('/rack', data).then(r => r.data);
export const updateRack = (id, d)  => api.put(`/rack/${id}`, d).then(r => r.data);
export const deleteRack = (id)     => api.delete(`/rack/${id}`).then(r => r.data);

// ── Direct Inbound (no PO) ────────────────────────────────────────────────
export const directInbound = (data) => api.post('/locations/inbound', data).then(r => r.data);

export default api;
