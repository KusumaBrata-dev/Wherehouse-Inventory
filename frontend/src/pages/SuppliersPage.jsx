import { useEffect, useState } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';

function SupplierModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', ...supplier });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Nama supplier wajib diisi');
    setLoading(true);
    try {
      if (supplier?.id) { await updateSupplier(supplier.id, form); toast.success('Supplier diperbarui'); }
      else { await createSupplier(form); toast.success('Supplier ditambahkan'); }
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{supplier?.id ? 'Edit Supplier' : 'Tambah Supplier'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label required">Nama Supplier</label>
              <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="PT. Contoh Supplier" />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Kontak</label>
              <input className="form-control" value={form.contactName} onChange={e => set('contactName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">No. Telepon</label>
              <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Alamat</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /> Menyimpan...</> : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setSuppliers(await getSuppliers()); }
    catch { toast.error('Gagal memuat supplier'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus supplier ini?')) return;
    try { await deleteSupplier(id); toast.success('Dihapus'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Gagal'); }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div><h1>Supplier</h1><p>Daftar vendor dan pemasok</p></div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={18} /> Tambah Supplier
        </button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Nama</th><th>Kontak</th><th>Telepon</th><th>Email</th><th>Alamat</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
          <tbody>
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>)}</tr>
              ))
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state"><p>Belum ada supplier</p></div></td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.contactName || '—'}</td>
                <td className="font-mono text-sm">{s.phone || '—'}</td>
                <td className="text-sm">{s.email || '—'}</td>
                <td className="text-sm text-muted">{s.address || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn-icon" onClick={() => setModal(s)}><Edit2 size={14} /></button>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && <SupplierModal supplier={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
