import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Package, TrendingDown, AlertTriangle, ArrowLeftRight, ArrowUp, ArrowDown, 
  ChevronRight, Box, Target, Clock, Activity, Layers, Map, PieChart
} from 'lucide-react';
import { getStock, getTransactions, getFloors, getOccupancyStats } from '../services/api';
export default function DashboardPage() {
  const [stockData, setStockData] = useState(null);
  const [recentTx, setRecentTx]   = useState([]);
  const [floors, setFloors]        = useState([]);
  const [occupancy, setOccupancy]  = useState(null);
  const [loading, setLoading]      = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getStock(),
      getTransactions({ limit: 10 }),
      getFloors(),
      getOccupancyStats(),
    ]).then(([stock, tx, floorData, occ]) => {
      setStockData(stock);
      setRecentTx(tx.transactions);
      setFloors(floorData);
      setOccupancy(occ);
    }).finally(() => setLoading(false));
  }, []);

  const summary = stockData?.summary;
  const lowProducts = stockData?.stocks?.filter(s => (s.quantity <= s.product.minStock && s.product.minStock > 0) || s.quantity === 0) || [];

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="spinner dark" style={{ width: 48, height: 48 }} />
    </div>
  );

  return (
    <div className="page-container animate-fade" style={{ padding: '24px 20px' }}>
      
      {/* ── BIG HEADER ── */}
      <div className="page-header dashboard-header">
        <div>
           <h1 className="dashboard-title">Overview Gudang</h1>
           <p className="dashboard-subtitle">Status operasional dan logistik real-time</p>
        </div>
        <div className="dashboard-actions">
           <Link to="/inventory" className="btn btn-ghost dashboard-btn">
              Lihat Semua Stok
           </Link>
           <Link to="/search" className="btn btn-primary dashboard-btn-primary">
              <Target size={20} /> Cari Lokasi Produk
           </Link>
        </div>
      </div>

      {/* ── GIANT KPI CARDS ── */}
      <div className="dashboard-kpi-grid">
        
        <div className="kpi-card glass primary" style={{ padding: '20px 24px' }}>
          <div className="kpi-card-header" style={{ marginBottom: 16 }}>
             <div className="kpi-icon-wrapper" style={{ padding: 10 }}><Package size={24} /></div>
             <Activity size={16} className="kpi-activity-icon" />
          </div>
          <div className="kpi-value" style={{ fontSize: 32 }}>{summary?.total ?? 0}</div>
          <div className="kpi-label">Jenis Produk Terdaftar</div>
        </div>

        <div className="kpi-card glass success" style={{ padding: '20px 24px' }}>
          <div className="kpi-card-header" style={{ marginBottom: 16 }}>
             <div className="kpi-icon-wrapper" style={{ padding: 10 }}><ArrowLeftRight size={24} /></div>
             <ArrowUp size={16} className="kpi-activity-icon" />
          </div>
          <div className="kpi-value" style={{ fontSize: 32 }}>{summary?.totalQty?.toLocaleString('id-ID') ?? 0}</div>
          <div className="kpi-label">Total Fisik Produk</div>
        </div>

          <div className="kpi-card glass warning hover-card" style={{ padding: '20px 24px' }} onClick={() => navigate('/inventory', { state: { filter: 'low' } })}>
          <div className="kpi-card-header" style={{ marginBottom: 16 }}>
             <div className="kpi-icon-wrapper" style={{ padding: 10 }}><AlertTriangle size={24} /></div>
             <ChevronRight size={16} className="kpi-activity-icon" />
          </div>
          <div className="kpi-value" style={{ fontSize: 32 }}>{summary?.lowStock ?? 0}</div>
          <div className="kpi-label">Stok Hampir Habis</div>
        </div>

        <div className="kpi-card glass danger" style={{ padding: '20px 24px' }}>
          <div className="kpi-card-header" style={{ marginBottom: 16 }}>
             <div className="kpi-icon-wrapper" style={{ padding: 10 }}><TrendingDown size={24} /></div>
             <AlertTriangle size={16} className="kpi-activity-icon" />
          </div>
          <div className="kpi-value" style={{ fontSize: 32 }}>{summary?.outOfStock ?? 0}</div>
          <div className="kpi-label">Produk Kosong</div>
        </div>

        <div className="kpi-card glass info" style={{ padding: '20px 24px', borderTop: '4px solid #3b82f6' }}>
          <div className="kpi-card-header" style={{ marginBottom: 16 }}>
             <div className="kpi-icon-wrapper" style={{ padding: 10, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><PieChart size={24} /></div>
             <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{occupancy?.overallPercent}%</div>
          </div>
          <div className="kpi-value" style={{ fontSize: 32 }}>{occupancy?.usedSlots ?? 0} <span style={{ fontSize: 14, opacity: 0.5 }}>/ {occupancy?.totalSlots ?? 0}</span></div>
          <div className="kpi-label">Okupansi Gudang (Slot Terpakai)</div>
        </div>

      </div>

      {/* ── ALERTS & TABLES ── */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: '1fr' }}>

        {/* Low Stock List (The Drill down point) */}
        <div className="card glass" style={{ padding: 24 }}>
          <div className="card-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>⚠️ Alert Stok</h2>
            <Link to="/inventory" className="btn btn-ghost btn-sm">Lihat Semua</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lowProducts.length === 0 ? (
               <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                  <Package size={40} style={{ margin: '0 auto 12px' }} />
                  <p>Seluruh stok tercukupi</p>
               </div>
            ) : (
              lowProducts.slice(0, 8).map(s => (
                <div 
                  key={s.id} 
                  className="card hover-card" 
                  style={{ 
                    padding: 16, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                  }}
                  onClick={() => navigate(`/products/${s.product.id}`)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.product.sku}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.quantity === 0 ? 'var(--danger)' : 'var(--warning)' }}>{s.quantity}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.product.unit}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── RECENT TRANSACTIONS ── */}
      <div className="card glass" style={{ marginTop: 24, padding: 24 }}>
        <div className="card-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={24} color="var(--primary)" />
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Log Transaksi Terakhir</h2>
          </div>
          <Link to="/transactions" className="btn btn-ghost btn-sm">Buka Semua Log</Link>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
           <table style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr style={{ background: 'transparent' }}>
                  <th style={{ padding: '12px 20px', borderRadius: '12px 0 0 12px' }}>Tanggal</th>
                  <th>Nama Produk</th>
                  <th className="hide-mobile">Jenis</th>
                  <th>Jumlah</th>
                  <th className="hide-mobile">Referensi</th>
                  <th className="hide-mobile" style={{ borderRadius: '0 12px 12px 0' }}>Operator</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map(tx => (
                  <tr key={tx.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px', borderRadius: '12px 0 0 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{tx.product.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tx.product.sku}</div>
                    </td>
                    <td className="hide-mobile">
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: 6, 
                        color: tx.type === 'IN' ? 'var(--success)' : 'var(--danger)',
                        fontWeight: 700, fontSize: 13
                      }}>
                        {tx.type === 'IN' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        {tx.type === 'IN' ? 'MASUK' : 'KELUAR'}
                      </div>
                    </td>
                    <td style={{ fontSize: 16, fontWeight: 800 }}>
                      {tx.quantity} 
                      <span className="hide-mobile" style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{tx.product.unit}</span>
                      <div className="show-mobile" style={{ fontSize: 10, color: tx.type === 'IN' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                        {tx.type}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{tx.referenceNo || '—'}</td>
                    <td className="hide-mobile" style={{ borderRadius: '0 12px 12px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                            {tx.user.name[0]}
                         </div>
                         <span style={{ fontSize: 13 }}>{tx.user.name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>

    </div>
  );
}
