import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getItems, getSuppliers, deleteItem, createItem, updateItem } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, QrCode, Edit2, Trash2, Filter, Package } from 'lucide-react';

function ItemModal({ item, onClose, onSaved, suppliers }) {
  const [form, setForm] = useState({
    name: '', sku: '', unit: '', description: '', minStock: 0, categoryId: '',
    ...item
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.sku || !form.unit) return toast.error('Nama, SKU, dan Satuan wajib diisi');
    setLoading(true);
    try {
      if (item?.id) {
        const updated = await updateItem(item.id, form);
        toast.success('Item berhasil diperbarui');
        onSaved(updated);
      } else {
        const created = await createItem(form);
        toast.success('Item berhasil ditambahkan');
        onSaved(created);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{item?.id ? 'Edit Item' : 'Tambah Item Baru'}</h2>
          <button className="btn-icon" onClick={onClose}><span>✕</span></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label required">Nama Item</label>
              <input id="item-name" className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Contoh: Bearing 6205" />
            </div>
            <div className="form-group">
              <label className="form-label required">SKU / Kode</label>
              <input id="item-sku" className="form-control font-mono" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="BRG-6205" />
            </div>
            <div className="form-group">
              <label className="form-label required">Satuan</label>
              <select id="item-unit" className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="">Pilih satuan...</option>
                {['pcs', 'unit', 'liter', 'kg', 'meter', 'roll', 'box', 'set', 'lembar', 'botol'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stok Minimum</label>
              <input id="item-min-stock" type="number" className="form-control" value={form.minStock} min={0} onChange={e => set('minStock', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <input id="item-category" className="form-control" value={form.categoryId || ''} onChange={e => set('categoryId', e.target.value)} placeholder="ID Kategori (opsional)" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Deskripsi</label>
              <textarea id="item-desc" className="form-control" rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Keterangan tambahan..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button id="item-save" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Menyimpan...</span></> : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [modalItem, setModalItem] = useState(null);  // null=closed, {}=new, item=edit
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getItems({ search, lowStock: lowStockFilter ? 'true' : undefined });
      setItems(data);
    } catch (err) {
      toast.error('Gagal memuat data item');
    } finally {
      setLoading(false);
    }
  }, [search, lowStockFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDelete = async (id) => {
    try {
      await deleteItem(id);
      toast.success('Item dihapus');
      setDeleteConfirm(null);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  };

  const handleSaved = (savedItem) => {
    loadItems();
  };

  const stockLevel = (item) => {
    const qty = item.stock?.quantity ?? 0;
    const min = item.minStock;
    if (qty === 0) return 'empty';
    if (min > 0 && qty <= min) return 'low';
    return 'ok';
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div><h1>Master Item</h1><p>Kelola data barang dan stok</p></div>
        <button id="add-item-btn" className="btn btn-primary" onClick={() => setModalItem({})}>
          <Plus size={18} /> Tambah Item
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            id="item-search"
            type="text"
            className="form-control"
            placeholder="Cari nama atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          id="low-stock-filter"
          className={`btn ${lowStockFilter ? 'btn-warning' : 'btn-ghost'}`}
          onClick={() => setLowStockFilter(f => !f)}
          style={lowStockFilter ? { background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' } : {}}
        >
          <Filter size={16} /> Stok Menipis
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Kategori</th>
              <th>Satuan</th>
              <th>Stok</th>
              <th>Rack</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j}><div style={{ height: 16, background: 'var(--border)', borderRadius: 4, width: j === 0 ? 160 : 80, animation: 'pulse 1.5s infinite' }} /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <Package size={48} />
                  <h3>Tidak ada item</h3>
                  <p>{search ? `Tidak ada hasil untuk "${search}"` : 'Klik "Tambah Item" untuk mulai'}</p>
                </div>
              </td></tr>
            ) : items.map(item => {
              const level = stockLevel(item);
              const qty = item.stock?.quantity ?? 0;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.description && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{item.description}</div>}
                  </td>
                  <td><span className="font-mono text-sm" style={{ color: 'var(--primary)' }}>{item.sku}</span></td>
                  <td><span className="badge badge-gray">{item.category?.name || '—'}</span></td>
                  <td className="text-sm text-muted">{item.unit}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: level === 'empty' ? 'var(--danger)' : level === 'low' ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {qty}
                      </span>
                      <div className="stock-bar" style={{ width: 60 }}>
                        <div className={`stock-bar-fill ${level}`} style={{ width: item.minStock > 0 ? `${Math.min((qty / (item.minStock * 2)) * 100, 100)}%` : '100%' }} />
                      </div>
                    </div>
                    {level === 'low' && <div className="badge badge-warning" style={{ marginTop: 3, fontSize: 10 }}>Menipis</div>}
                    {level === 'empty' && <div className="badge badge-danger" style={{ marginTop: 3, fontSize: 10 }}>Habis</div>}
                  </td>
                  <td>
                    {item.rackLocations?.length > 0
                      ? <div className="flex gap-2 flex-wrap">{item.rackLocations.map(r => <span key={r.id} className="badge badge-primary font-mono">{r.rackCode}</span>)}</div>
                      : <span className="text-muted text-sm">—</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link to={`/items/${item.id}`} className="btn-icon" title="Lihat QR/Barcode">
                        <QrCode size={15} />
                      </Link>
                      <button className="btn-icon" title="Edit" onClick={() => setModalItem(item)}>
                        <Edit2 size={15} />
                      </button>
                      <button className="btn-icon" title="Hapus"
                        onClick={() => setDeleteConfirm(item)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        Menampilkan {items.length} item
      </div>

      {/* Modals */}
      {modalItem !== null && (
        <ItemModal item={modalItem.id ? modalItem : null} onClose={() => setModalItem(null)} onSaved={handleSaved} />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
            <h3 className="modal-title" style={{ marginBottom: 8 }}>Hapus Item?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Item <strong>{deleteConfirm.name}</strong> akan dihapus permanen beserta semua data stok dan riwayat transaksinya.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Batal</button>
              <button id="confirm-delete" className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)} style={{ background: 'var(--danger)', color: 'white' }}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
