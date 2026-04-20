import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { createProduct, updateProduct, deleteProduct, exportProductsExcel } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, X, HardDrive, QrCode } from 'lucide-react';
import QRModal from '../components/QRModal';
import { useAuth } from '../context/AuthContext';

function QRButton({ type, id, name, size = 16 }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button className="btn btn-primary btn-icon btn-sm" onClick={() => setShow(true)} title="Preview QR">
        <QrCode size={size} />
      </button>
      {show && createPortal(
        <QRModal type={type} id={id} name={name} onClose={() => setShow(false)} />,
        document.body
      )}
    </>
  );
}

function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', sku: '', unit: '', categoryId: '', description: '', minStock: 0,
    ...product
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.sku) return toast.error('Nama dan SKU wajib diisi');
    setLoading(true);
    try {
      const payload = {
        ...form,
        minStock: parseInt(form.minStock) || 0,
        categoryId: form.categoryId ? parseInt(form.categoryId) : undefined
      };
      
      if (product?.id) {
        await updateProduct(product.id, payload);
        toast.success('Master Produk diperbarui');
      } else {
        await createProduct(payload);
        toast.success('Master Produk ditambahkan');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-premium scaleIn" style={{ maxWidth: 500 }}>
        <div className="modal-premium-header">
          <h2 className="modal-title">{product?.id ? 'Edit Master Produk' : 'Tambah Master Produk'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-premium-body flex-col gap-12" style={{ padding: '20px 24px' }}>
            <div className="form-group">
              <label className="form-label">Nama Produk</label>
              <input className="form-control" placeholder="Contoh: Sparepart Baut M8" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus required />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Kode SKU</label>
                <input className="form-control font-mono" placeholder="SKU Unik" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                <input className="form-control" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="pcs, kg, box" required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
               <div className="form-group">
                  <label className="form-label">Minimum Stok (Alert)</label>
                  <input type="number" className="form-control" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} min="0" />
               </div>
            </div>

            <div className="form-group">
               <label className="form-label">Deskripsi Tambahan</label>
               <textarea className="form-control" rows="3" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})}></textarea>
            </div>
          </div>
          
          <div className="modal-premium-footer flex-center" style={{ padding: '16px 24px', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Master Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component: Products Page ──────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modal, setModal] = useState({ show: false, product: null });
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/products', { params: { search, page, limit: 25 } }),
        api.get('/categories')
      ]);
      setProducts(pRes.data.products || []);
      setTotalCount(pRes.data.pagination?.total || 0);
      setTotalPages(pRes.data.pagination?.totalPages || 1);
      setCategories(cRes.data);
    } catch (err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus produk ini? Semua stok terkait juga akan terpengaruh.')) return;
    try {
      await deleteProduct(id);
      toast.success('Produk dihapus');
      fetchData();
    } catch (err) {
      toast.error('Gagal menghapus produk');
    }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-wms" style={{ marginBottom: 24 }}>
        <div className="top-title">
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-white)' }}>Master Data Produk</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Kelola informasi produk dan SKU pusat</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <button className="btn btn-ghost" onClick={() => exportProductsExcel()}>
              <HardDrive size={18} style={{ marginRight: 8 }} /> Export Excel
           </button>
           {isAdmin && (
             <button className="btn btn-primary" onClick={() => setModal({ show: true, product: null })}>
               <Plus size={18} style={{ marginRight: 8 }} /> Tambah Produk
             </button>
           )}
        </div>
      </div>

      <div className="card glass" style={{ padding: 20, marginBottom: 20 }}>
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Cari berdasarkan Nama atau SKU..." 
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 24 }}>Info Produk</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th style={{ textAlign: 'center' }}>Min. Stok</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={5} style={{ padding: 20 }}><div className="skeleton-line" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                   <td colSpan={5} style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>
                      <Package size={40} style={{ margin: '0 auto 12px' }} />
                      <p>Tidak ada data produk.</p>
                   </td>
                </tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-white)' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace' }}>{p.sku}</div>
                  </td>
                  <td>
                    <span className="badge badge-gray">{p.category?.name || 'Umum'}</span>
                  </td>
                  <td>{p.unit}</td>
                  <td style={{ textAlign: 'center' }}>{p.minStock}</td>
                  <td style={{ textAlign: 'right', paddingRight: 24 }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <QRButton type="item" id={p.id} name={p.name} />
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal({ show: true, product: p })}>
                        <Edit2 size={16} />
                      </button>
                      {isAdmin && (
                        <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDelete(p.id)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
              Menampilkan {products.length} dari <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span> produk
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

      {modal.show && (
        <ProductModal 
          product={modal.product} 
          onClose={() => setModal({ show: false, product: null })} 
          onSaved={fetchData} 
        />
      )}

      <style>{`
        .skeleton-line { height: 20px; background: var(--border); border-radius: 4px; animation: pulse 1.5s infinite; }
        .text-danger:hover { color: var(--danger) !important; background: var(--danger-bg) !important; }
      `}</style>
    </div>
  );
}
