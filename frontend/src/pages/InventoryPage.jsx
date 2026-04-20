import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, Filter, Package, MapPin, ChevronRight, ArrowUpDown, Info, FileUp, Database, AlertCircle, CheckCircle2, History } from 'lucide-react';

export default function InventoryPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'low', 'out'
  const [summary, setSummary] = useState({ total: 0, lowStock: 0, outOfStock: 0, totalQty: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Load filter state from navigation if coming from dashboard
  useEffect(() => {
    if (location.state?.filter) {
      setFilterType(location.state.filter);
    }
  }, [location]);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      // SSP: Pass search and page to backend
      const { data } = await api.get('/stock', { params: { page, search, filter: filterType } });
      setStocks(data.stocks || []);
      setSummary(data.summary || { total: 0, lowStock: 0, outOfStock: 0, totalQty: 0 });
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      toast.error('Gagal memuat data inventaris');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // Handle Search with debounce or simpler: reset to page 1
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1); // Reset to page 1 on new search
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);

  const handleImport = async (e) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImporting(true);
    setImportStats(null);
    const loadingToast = toast.loading('Mengimpor data dari Odoo...');
    
    try {
      const { data } = await api.post('/stock/import-odoo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.dismiss(loadingToast);
      toast.success('Import Odoo berhasil!');
      setImportStats(data.stats);
      fetchStock();
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err.response?.data?.error || 'Gagal mengimpor data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Daftar Inventaris & Stok</h1>
            <p>Seluruh produk yang terdaftar di sistem gudang</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
             <FileUp size={18} style={{ marginRight: 8 }} /> Import from Odoo
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="card glass" style={{ padding: 20, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 300 }}>
          <Search size={18} />
          <input
            type="text"
            className="form-control"
            placeholder="Cari nama produk atau SKU..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
           <button 
             className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}`}
             onClick={() => setFilterType('all')}
           >Semua</button>
           <button 
             className={`btn ${filterType === 'low' ? 'btn-warning' : 'btn-ghost'}`}
             onClick={() => setFilterType('low')}
             style={filterType === 'low' ? { background: 'var(--warning)', color: 'white' } : {}}
           >Stok Menipis</button>
           <button 
             className={`btn ${filterType === 'out' ? 'btn-danger' : 'btn-ghost'}`}
             onClick={() => setFilterType('out')}
           >Stok Habis</button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ margin: 0, border: 'none' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
              <tr>
                <th style={{ padding: '16px 24px' }}>Produk & SKU</th>
                <th>Kategori</th>
                <th>Lokasi Penyimpanan</th>
                <th style={{ textAlign: 'center' }}>Total Stok</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={6} style={{ padding: 20 }}><div className="skeleton-line" /></td></tr>
                ))
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 100, textAlign: 'center', opacity: 0.5 }}>
                     <Package size={48} style={{ margin: '0 auto 16px' }} />
                     <p>Tidak ada produk yang ditemukan.</p>
                  </td>
                </tr>
              ) : stocks.map(s => {
                const isLow = s.quantity <= (s.product.minStock || 10) && s.quantity > 0;
                const isOut = s.quantity === 0;
                
                return (
                  <tr key={s.id} className="hover-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '20px 24px' }}>
                       <div style={{ fontWeight: 700, fontSize: 15 }}>{s.product.name}</div>
                       <div style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace' }}>{s.product.sku}</div>
                    </td>
                    <td>
                       <span className="badge badge-gray">{s.product.category?.name || 'Uncategorized'}</span>
                    </td>
                    <td>
                       <div 
                         style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-white)', cursor: 'pointer' }}
                         className="hover-primary"
                         onClick={async () => {
                           const loadingToast = toast.loading('Mencari lokasi...');
                           try {
                             const { data } = await api.get(`/locations/search?q=${s.product.sku}`);
                             toast.dismiss(loadingToast);
                             if (data.length === 0) {
                               toast.error('Lokasi tidak ditemukan di pemetaan warehouse');
                             } else if (data.length === 1) {
                               const result = data[0];
                               const floorId = result.location.section.rack.floorId;
                               navigate(`/locations/${floorId}`, { 
                                 state: { 
                                   targetRack: result.location.section.rack,
                                   targetSection: result.location.section,
                                   targetLevel: result.location,
                                   targetType: result.type,
                                   targetCode: result.code
                                 } 
                               });
                             } else {
                               // If multiple locations, go to search page with those results
                               navigate('/search', { state: { initialQuery: s.product.sku } });
                             }
                           } catch (err) {
                             toast.dismiss(loadingToast);
                             toast.error('Gagal memuat lokasi');
                           }
                         }}
                       >
                          <MapPin size={14} color="var(--primary)" /> 
                          <span style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.locationPath || 'Cek Lokasi Warehouse'}
                          </span>
                          <ChevronRight size={12} />
                       </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <div style={{ fontSize: 18, fontWeight: 800 }}>{s.quantity}</div>
                       <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.product.unit}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       {isOut ? (
                         <span className="badge badge-danger">OUT OF STOCK</span>
                       ) : isLow ? (
                         <span className="badge badge-warning" style={{ color: 'white' }}>LOW STOCK</span>
                       ) : (
                         <span className="badge badge-success">IN STOCK</span>
                       )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                       <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/products/${s.product.id}`)}>
                          <Info size={16} style={{ marginRight: 6 }} /> Detail
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div style={{ 
          padding: '16px 24px', 
          background: 'rgba(0,0,0,0.1)', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
           <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Menampilkan {stocks.length} dari <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{summary.total}</span> produk
           </div>
           <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 8px' }}>
                Halaman <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{page}</span> / {totalPages}
              </span>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
           </div>
        </div>
      </div>
      
      {/* Import Odoo Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
           <div className="modal animate-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div className="modal-header">
                 <h3 className="modal-title">Import Data dari Odoo</h3>
                 <button className="btn-icon" onClick={() => setShowImportModal(false)}><ChevronRight size={18} /></button>
              </div>

              {!importStats ? (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                   <div style={{ width: 64, height: 64, background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <Database size={32} />
                   </div>
                   <h3>Upload Excel Export Odoo</h3>
                   <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
                      Format kolom wajib: Location, Product ([SKU] Name), Lot, Inventoried Qty, Reserved Qty.
                   </p>
                   
                   <label className="btn btn-primary btn-lg" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      {importing ? 'Memproses...' : 'Pilih File Excel (.xlsx)'}
                      <input type="file" hidden accept=".xlsx" onChange={handleImport} disabled={importing} />
                   </label>
                </div>
              ) : (
                <div className="animate-fade">
                   <div style={{ background: 'var(--success-bg)', padding: 16, borderRadius: 12, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <CheckCircle2 color="var(--success)" />
                      <div>
                         <div style={{ fontWeight: 700, color: 'var(--success)' }}>Import Berhasil!</div>
                         <div style={{ fontSize: 12 }}>{importStats.updated} data telah diperbarui/sinkron.</div>
                      </div>
                   </div>

                   <div className="card" style={{ padding: 16, background: 'var(--bg-base)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                         <span>Produk Baru Terdaftar:</span>
                         <span style={{ fontWeight: 700 }}>{importStats.created}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: importStats.errors.length > 0 ? 'var(--danger)' : 'inherit' }}>
                         <span>Gagal / Error:</span>
                         <span style={{ fontWeight: 700 }}>{importStats.errors.length}</span>
                      </div>
                   </div>

                   {importStats.errors.length > 0 && (
                     <div style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                        {importStats.errors.map((err, i) => (
                           <div key={i} style={{ marginBottom: 4 }}>• Baris {err.row}: {err.error}</div>
                        ))}
                     </div>
                   )}

                   <button className="btn btn-ghost w-full" style={{ marginTop: 24 }} onClick={() => { setShowImportModal(false); setImportStats(null); }}>Tutup</button>
                </div>
              )}
           </div>
        </div>
      )}

      <style>{`
        .hover-row:hover { background: rgba(255,255,255,0.02); }
        .hover-primary:hover { color: var(--primary) !important; }
        .skeleton-line { height: 20px; background: var(--border); border-radius: 4px; animation: pulse 1.5s infinite; }
        .w-full { width: 100%; }
      `}</style>
    </div>
  );
}
