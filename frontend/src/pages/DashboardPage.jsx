import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStock, getTransactions } from '../services/api';
import { Package, TrendingDown, AlertTriangle, ArrowLeftRight, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SkeletonCard = () => (
  <div className="kpi-card" style={{ opacity: 0.5 }}>
    <div className="kpi-icon" style={{ background: 'var(--border)', width: 52, height: 52, borderRadius: 10 }} />
    <div>
      <div style={{ height: 28, width: 60, background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
      <div style={{ height: 13, width: 100, background: 'var(--border)', borderRadius: 6 }} />
    </div>
  </div>
);

export default function DashboardPage() {
  const [stockData, setStockData] = useState(null);
  const [recentTx, setRecentTx]   = useState([]);
  const [chartData, setChartData]  = useState([]);
  const [loading, setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      getStock(),
      getTransactions({ limit: 10 }),
    ]).then(([stock, tx]) => {
      setStockData(stock);
      setRecentTx(tx.transactions);

      // Build chart data (last 7 days)
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
        const dateStr = d.toISOString().split('T')[0];
        const dayTx = tx.transactions.filter(t => t.date.startsWith(dateStr));
        days.push({
          day: label,
          Masuk: dayTx.filter(t => t.type === 'IN').reduce((s, t) => s + t.quantity, 0),
          Keluar: dayTx.filter(t => t.type === 'OUT').reduce((s, t) => s + t.quantity, 0),
        });
      }
      setChartData(days);
    }).finally(() => setLoading(false));
  }, []);

  const summary = stockData?.summary;
  const lowItems = stockData?.stocks?.filter(s => s.quantity <= s.item.minStock && s.item.minStock > 0) || [];

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Ringkasan stok dan aktivitas gudang hari ini</p>
        </div>
        <Link to="/scan" className="btn btn-primary">
          <span>📷</span> Scan Barang
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {loading ? <>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </> : <>
          <div className="kpi-card primary">
            <div className="kpi-icon"><Package color="var(--primary)" size={24} /></div>
            <div className="kpi-info">
              <div className="kpi-value">{summary?.total ?? 0}</div>
              <div className="kpi-label">Total Jenis Item</div>
            </div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-icon"><ArrowLeftRight color="var(--success)" size={24} /></div>
            <div className="kpi-info">
              <div className="kpi-value">{summary?.totalQty?.toLocaleString('id-ID') ?? 0}</div>
              <div className="kpi-label">Total Stok (semua unit)</div>
            </div>
          </div>
          <div className="kpi-card warning">
            <div className="kpi-icon"><AlertTriangle color="var(--warning)" size={24} /></div>
            <div className="kpi-info">
              <div className="kpi-value">{summary?.lowStock ?? 0}</div>
              <div className="kpi-label">Stok Menipis</div>
            </div>
          </div>
          <div className="kpi-card danger">
            <div className="kpi-icon"><TrendingDown color="var(--danger)" size={24} /></div>
            <div className="kpi-info">
              <div className="kpi-value">{summary?.outOfStock ?? 0}</div>
              <div className="kpi-label">Stok Habis</div>
            </div>
          </div>
        </>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Aktivitas 7 Hari Terakhir</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barSize={24} barGap={4}>
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#131d35', border: '1px solid #1e2d4d', borderRadius: 10, color: '#e2e8f0' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 13, color: '#94a3b8' }} />
              <Bar dataKey="Masuk"  fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Keluar" fill="#f43f5e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock Alert */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Stok Menipis</span>
            <Link to="/items?lowStock=true" className="btn btn-ghost btn-sm">Lihat semua</Link>
          </div>
          {lowItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 16px' }}>
              <p>✅ Semua stok aman</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowItems.slice(0, 6).map(s => (
                <Link key={s.id} to={`/items/${s.item.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'var(--transition)',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--warning)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.item.sku}</div>
                    </div>
                    <div className={`badge ${s.quantity === 0 ? 'badge-danger' : 'badge-warning'}`}>
                      {s.quantity} {s.item.unit}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Transaksi Terbaru</span>
          <Link to="/transactions" className="btn btn-ghost btn-sm">Lihat semua</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Item</th>
                <th>Tipe</th>
                <th>Qty</th>
                <th>Referensi</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><p>Belum ada transaksi</p></div></td></tr>
              ) : recentTx.map(tx => (
                <tr key={tx.id}>
                  <td className="text-sm text-muted">{new Date(tx.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{tx.item.name}</div>
                    <div className="text-xs text-muted font-mono">{tx.item.sku}</div>
                  </td>
                  <td>
                    <span className={`badge ${tx.type === 'IN' ? 'badge-success' : tx.type === 'OUT' ? 'badge-danger' : 'badge-warning'}`}>
                      {tx.type === 'IN' ? <ArrowUp size={10} /> : tx.type === 'OUT' ? <ArrowDown size={10} /> : null}
                      {tx.type}
                    </span>
                  </td>
                  <td className="font-bold">{tx.quantity} <span className="text-muted text-sm">{tx.item.unit}</span></td>
                  <td className="text-sm text-muted font-mono">{tx.referenceNo || '—'}</td>
                  <td className="text-sm">{tx.user.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
