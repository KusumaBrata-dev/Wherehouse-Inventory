import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getItem, getItemQR, getItemBarcode, createTransaction, createRack, deleteRack } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

function TransactionModal({ item, onClose, onDone }) {
  const [type, setType] = useState('IN');
  const [qty, setQty] = useState(1);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (qty < 1) return toast.error('Qty minimal 1');
    setLoading(true);
    try {
      await createTransaction({ itemId: item.id, type, quantity: qty, referenceNo: ref, note });
      toast.success(`Transaksi ${type} berhasil`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Buat Transaksi — {item.name}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipe Transaksi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'IN', label: 'Barang Masuk', color: 'var(--success)', bg: 'var(--success-bg)' },
                { v: 'OUT', label: 'Barang Keluar', color: 'var(--danger)', bg: 'var(--danger-bg)' },
                { v: 'ADJUST', label: 'Penyesuaian', color: 'var(--warning)', bg: 'var(--warning-bg)' },
              ].map(opt => (
                <button key={opt.v} type="button" id={`tx-type-${opt.v.toLowerCase()}`}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid',
                    borderColor: type === opt.v ? opt.color : 'var(--border)',
                    background: type === opt.v ? opt.bg : 'transparent',
                    color: type === opt.v ? opt.color : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                  onClick={() => setType(opt.v)}
                >{type === opt.v && opt.v === 'IN' ? '↑ ' : type === opt.v && opt.v === 'OUT' ? '↓ ' : ''}{opt.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Jumlah</label>
              <input id="tx-qty" type="number" className="form-control" value={qty} min={1} onChange={e => setQty(parseInt(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">No. Referensi</label>
              <input id="tx-ref" type="text" className="form-control font-mono" value={ref} onChange={e => setRef(e.target.value)} placeholder="PO-001" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea id="tx-note" className="form-control" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Keterangan tambahan..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button id="tx-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /> Memproses...</> : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txModal, setTxModal] = useState(false);
  const [addRack, setAddRack] = useState(false);
  const [rackForm, setRackForm] = useState({ row: '', level: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getItem(id);
      setItem(data);
    } catch {
      toast.error('Item tidak ditemukan');
      navigate('/items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAddRack = async (e) => {
    e.preventDefault();
    if (!rackForm.row || !rackForm.level) return toast.error('Row dan Level wajib diisi');
    const rackCode = `${rackForm.row.toUpperCase()}-${rackForm.level}`;
    try {
      await createRack({ itemId: id, rackCode, row: rackForm.row, level: parseInt(rackForm.level), notes: rackForm.notes });
      toast.success('Rack ditambahkan');
      setAddRack(false);
      setRackForm({ row: '', level: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  };

  const handleDeleteRack = async (rackId) => {
    try {
      await deleteRack(rackId);
      toast.success('Rack dihapus');
      load();
    } catch (err) {
      toast.error('Gagal menghapus rack');
    }
  };

  if (loading) return (
    <div className="page-container loading-screen" style={{ minHeight: 400 }}>
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
    </div>
  );
  if (!item) return null;

  const qty = item.stock?.quantity ?? 0;
  const level = qty === 0 ? 'empty' : item.minStock > 0 && qty <= item.minStock ? 'low' : 'ok';

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/items" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> Kembali</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-white)' }}>{item.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.sku} · {item.category?.name || 'Tanpa Kategori'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setTxModal(true)}>
          <ArrowLeftRight size={16} /> Transaksi
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Stock Info */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>📊 Informasi Stok</div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: level === 'empty' ? 'var(--danger)' : level === 'low' ? 'var(--warning)' : 'var(--success)', lineHeight: 1 }}>
              {qty}
            </div>
            <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 4 }}>{item.unit}</div>
            {level === 'low' && <div className="badge badge-warning" style={{ marginTop: 8, display: 'inline-flex' }}>⚠️ Stok Menipis (Min: {item.minStock})</div>}
            {level === 'empty' && <div className="badge badge-danger" style={{ marginTop: 8, display: 'inline-flex' }}>🚫 Stok Habis</div>}
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Satuan</span>
              <span>{item.unit}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Stok Minimum</span>
              <span>{item.minStock}</span>
            </div>
            {item.description && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Deskripsi</span>
                <p style={{ marginTop: 4 }}>{item.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>QR Code</div>
          <img
            src={getItemQR(id)}
            alt={`QR Code ${item.sku}`}
            style={{ width: 200, height: 200, margin: '0 auto 16px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <a href={getItemQR(id)} download={`qr-${item.sku}.png`} className="btn btn-ghost btn-sm">
            ⬇ Download QR
          </a>
        </div>

        {/* Barcode */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Barcode</div>
          <img
            src={getItemBarcode(id)}
            alt={`Barcode ${item.sku}`}
            style={{ width: '100%', maxWidth: 280, margin: '0 auto 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', padding: 12 }}
          />
          <a href={getItemBarcode(id)} download={`barcode-${item.sku}.png`} className="btn btn-ghost btn-sm">
            ⬇ Download Barcode
          </a>
        </div>
      </div>

      {/* Rack Locations */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">📍 Lokasi Rack</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddRack(a => !a)}>
            <Plus size={14} /> Tambah Rack
          </button>
        </div>

        {addRack && (
          <form onSubmit={handleAddRack} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Row (Huruf)</label>
              <input id="rack-row" className="form-control font-mono" style={{ width: 72, textAlign: 'center' }} value={rackForm.row} onChange={e => setRackForm(f => ({ ...f, row: e.target.value }))} placeholder="A" maxLength={2} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Level (Angka)</label>
              <input id="rack-level" type="number" className="form-control" style={{ width: 80 }} value={rackForm.level} onChange={e => setRackForm(f => ({ ...f, level: e.target.value }))} placeholder="1" min={1} />
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Catatan</label>
              <input id="rack-notes" className="form-control" value={rackForm.notes} onChange={e => setRackForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsional" />
            </div>
            <button id="rack-save" type="submit" className="btn btn-success">Simpan</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAddRack(false)}>Batal</button>
          </form>
        )}

        {item.rackLocations.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <p>Belum ada lokasi rack untuk item ini</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {item.rackLocations.map(r => (
              <div key={r.id} style={{
                padding: '12px 20px',
                background: 'var(--bg-surface)',
                border: '2px solid var(--primary)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{r.rackCode}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Row {r.row} · Level {r.level}</div>
                  {r.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.notes}</div>}
                </div>
                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteRack(r.id)} title="Hapus rack">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {txModal && <TransactionModal item={item} onClose={() => setTxModal(false)} onDone={load} />}
    </div>
  );
}

function ArrowLeftRight({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4" /><path d="M4 7h16" />
      <path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
    </svg>
  );
}
