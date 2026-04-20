import { useEffect, useState } from 'react';
import { getTransactions, exportTransactions } from '../services/api';
import toast from 'react-hot-toast';
import { Download, Filter, ArrowUp, ArrowDown, ArrowRightLeft, RefreshCw } from 'lucide-react';

export default function TransactionsPage() {
  const [data, setData] = useState({ transactions: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', startDate: '', endDate: '', page: 1 });

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    params.page = filters.page;
    params.limit = 30;

    getTransactions(params)
      .then(setData)
      .catch(() => toast.error('Gagal memuat transaksi'))
      .finally(() => setLoading(false));
  }, [filters]);

  const handleExport = () => {
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    const url = exportTransactions(params);
    window.open(url, '_blank');
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div><h1>Riwayat Transaksi</h1><p>Catatan semua pergerakan stok produk</p></div>
        <button id="export-btn" className="btn btn-success" onClick={handleExport}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select id="filter-type" className="form-control" style={{ width: 160 }} value={filters.type} onChange={e => set('type', e.target.value)}>
          <option value="">Semua Tipe</option>
          <option value="IN">Masuk (IN)</option>
          <option value="OUT">Keluar (OUT)</option>
          <option value="MOVE">Pindah (MOVE)</option>
          <option value="ADJUST">Penyesuaian</option>
        </select>
        <input id="filter-start" type="date" className="form-control" style={{ width: 180 }} value={filters.startDate} onChange={e => set('startDate', e.target.value)} />
        <span style={{ color: 'var(--text-muted)' }}>—</span>
        <input id="filter-end" type="date" className="form-control" style={{ width: 180 }} value={filters.endDate} onChange={e => set('endDate', e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button 
            className={`btn btn-sm ${filters.type === 'MOVE' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => set('type', filters.type === 'MOVE' ? '' : 'MOVE')}
          >
            <ArrowRightLeft size={14} /> Riwayat Relokasi
          </button>
          
          {(filters.type || filters.startDate || filters.endDate) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ type: '', startDate: '', endDate: '', page: 1 })}>
              <RefreshCw size={14} /> Reset Filter
            </button>
          )}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          Total: <strong style={{ color: 'var(--text-primary)' }}>{data.total}</strong> transaksi
        </span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tanggal & Waktu</th>
              <th>Produk</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>No. Referensi</th>
              <th>User</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
                  ))}
                </tr>
              ))
            ) : data.transactions.map(tx => (
              <tr key={tx.id}>
                <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(tx.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{tx.product.name}</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tx.product.sku}
                    {tx.type === 'MOVE' && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>| RELOCATED</span>}
                  </div>
                </td>
                <td>
                  <span className={`badge ${tx.type === 'IN' ? 'badge-success' : tx.type === 'OUT' ? 'badge-danger' : tx.type === 'MOVE' ? 'badge-primary' : 'badge-warning'}`}>
                    {tx.type === 'IN' && <ArrowUp size={10} />}
                    {tx.type === 'OUT' && <ArrowDown size={10} />}
                    {tx.type === 'MOVE' && <ArrowRightLeft size={10} />}
                    {tx.type}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: tx.type === 'IN' ? 'var(--success)' : tx.type === 'OUT' ? 'var(--danger)' : tx.type === 'MOVE' ? 'var(--primary)' : 'var(--warning)' }}>
                    {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : tx.type === 'MOVE' ? '⇄' : '='}{tx.quantity}
                  </span>
                  <span className="text-muted text-sm"> {tx.product.unit}</span>
                </td>
                <td className="font-mono text-sm">{tx.referenceNo || '—'}</td>
                <td className="text-sm">{tx.user.name}</td>
                <td className="text-sm" style={{ maxWidth: 300, fontSize: 13 }}>
                   {tx.type === 'MOVE' ? (
                     <div style={{ color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.4 }}>
                       {tx.note}
                     </div>
                   ) : (
                     <span className="text-muted">{tx.note || '—'}</span>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>‹ Prev</button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Halaman {filters.page} / {data.totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={filters.page >= data.totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next ›</button>
        </div>
      )}
    </div>
  );
}
