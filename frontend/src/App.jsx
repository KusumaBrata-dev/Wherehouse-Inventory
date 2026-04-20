import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ScanPage from './pages/ScanPage';
import TransactionsPage from './pages/TransactionsPage';
import UsersPage from './pages/UsersPage';
import LocationsPage from './pages/LocationsPage';
import SearchPage from './pages/SearchPage';
import InventoryPage from './pages/InventoryPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import ReceivingPage from './pages/ReceivingPage';
import PutawayPage from './pages/PutawayPage';
import StockOpnamePage from './pages/StockOpnamePage';
import MoveStockPage from './pages/MoveStockPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
      <span>Memuat sistem...</span>
    </div>
  );
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="search"       element={<SearchPage />} />
          <Route path="scan"         element={<ScanPage />} />
          <Route path="locations/:floorId" element={<LocationsPage />} />
          <Route path="inventory"     element={<InventoryPage />} />
          <Route path="products"      element={<ProductsPage />} />
          <Route path="products/:id"  element={<ProductDetailPage />} />
          <Route path="transactions"  element={<TransactionsPage />} />
          <Route path="users"         element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
          
          {/* WMS Milestone 1 */}
          <Route path="suppliers"    element={<SuppliersPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="receiving"    element={<ReceivingPage />} />

          {/* WMS Milestone 2 — Scan-based Operations */}
          <Route path="putaway"      element={<PutawayPage />} />
          <Route path="stock-opname" element={<StockOpnamePage />} />
          <Route path="move-stock"   element={<MoveStockPage />} />

          {/* Redirect old items link to products */}
          <Route path="items"         element={<Navigate to="/products" replace />} />
          <Route path="items/:id"     element={<Navigate to="/products/:id" replace />} />
          <Route path="items-redirect" element={<Navigate to="/inventory" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
