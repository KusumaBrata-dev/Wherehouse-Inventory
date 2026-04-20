import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProduct, getProductQR, getProductBarcode, createTransaction, getTransactions } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Minus, Trash2, Map, ArrowLeftRight, X, ChevronRight, Box as BoxIcon, Layers, Move, Edit2, RefreshCw, History, ArrowUp, ArrowDown } from 'lucide-react';

// ─── Modal: Edit Box ──────────────────────────────────────────────────────
function EditBoxModal({ box, onClose, onUpdated }) {
  const [name, setName] = useState(box.name || '');
  const [code, setCode] = useState(box.code || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/locations/boxes/${box.id}`, { name, code });
      toast.success('Box diperbarui');
      onUpdated();
      onClose();
    } catch {
      toast.error('Gagal memperbarui box');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal animate-up" style={{ maxWidth: 380 }}>
        <div className="modal-header">
           <h3 className="modal-title">Edit Box</h3>
           <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
           <div className="form-group">
              <label className="form-label">Nama Box</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
           </div>
           <div className="form-group">
              <label className="form-label">Kode Box</label>
              <input className="form-control font-mono" value={code} onChange={e => setCode(e.target.value)} required />
           </div>
           <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>Simpan</button>
           </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Shared Simple Create Creators ──────────────────────────────────
function CreatePalletModal({ levelId, onClose, onCreated }) {
  const [form, setForm] = useState({ 
    palletName: '', palletCode: '',
    boxName: 'Box 1', boxCode: '' 
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.palletName || !form.boxName) return toast.error('Nama palet dan box wajib diisi');
    
    setLoading(true);
    try {
      const pCode = form.palletCode || `PAL-${Date.now().toString().slice(-6)}`;
      const { data: pallet } = await api.post('/locations/pallets', { 
        name: form.palletName, 
        code: pCode, 
        rackLevelId: levelId 
      });

      const bCode = form.boxCode || `BOX-${Date.now().toString().slice(-5)}1`;
      await api.post('/locations/boxes', { 
        name: form.boxName, 
        code: bCode, 
        palletId: pallet.id 
      });

      toast.success('Palet dan Box berhasil dibuat');
      onCreated();
      onClose();
    } catch (err) {
      toast.error('Gagal membuat palet/box');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal animate-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
           <h3 className="modal-title">📦 Buat Pallet & Box Baru</h3>
           <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
           <div style={{ padding: '12px', background: 'var(--primary-glow)', borderRadius: 12, marginBottom: 16 }}>
              <div className="form-group">
                 <label className="form-label">Nama Palet</label>
                 <input className="form-control" value={form.palletName} onChange={e => setForm({...form, palletName: e.target.value})} placeholder="Contoh: Pallet BNI" autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                 <label className="form-label">Kode Palet (Opsional)</label>
                 <input className="form-control font-mono" value={form.palletCode} onChange={e => setForm({...form, palletCode: e.target.value})} placeholder="Otomatis" />
              </div>
           </div>

           <div style={{ padding: '12px', border: '1px dashed var(--primary)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase' }}>Wajib menyertakan Box pertama:</div>
              <div className="form-group">
                 <label className="form-label">Nama Box</label>
                 <input className="form-control" value={form.boxName} onChange={e => setForm({...form, boxName: e.target.value})} placeholder="Box 1" />
              </div>
           </div>

           <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                 {loading ? <div className="spinner" /> : 'Buat Pallet & Box'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}

function CreateBoxModal({ palletId, productId, product, onClose, onCreated }) {
  const [form, setForm] = useState({ name: `Box ${product.name}`, code: "" });
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error("Nama box wajib diisi");
    if (qty < 1) return toast.error("Quantity harus lebih dari 0");

    setLoading(true);
    try {
      const code = form.code || `BOX-${Date.now().toString().slice(-6)}`;
      const { data: box } = await api.post("/locations/boxes", {
        name: form.name,
        code,
        palletId,
      });

      await api.post("/transactions", {
        productId: productId,
        type: "IN",
        quantity: qty,
        boxId: box.id,
        note: `Initial stock saat pembuatan Box ${box.code}`,
      });

      toast.success(`Box dibuat dan ${qty} ${product.unit} dimasukkan`);
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      toast.error("Gagal membuat box atau mengisi stok");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal animate-up scroll-styled"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Buat Box & Isi Quantity</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ paddingBottom: 24 }}>
          <div className="card" style={{ background: "var(--bg-card)", marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>{product.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{product.sku}</div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginBottom: 24,
              padding: "20px 0",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
              MASUKKAN JUMLAH QUANTITY
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              <button
                type="button"
                className="btn btn-icon"
                style={{ width: 60, height: 60, fontSize: 32 }}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={24} />
              </button>
              <input
                type="number"
                className="form-control"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                style={{
                  width: 120,
                  height: 80,
                  fontSize: 48,
                  fontWeight: 900,
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  color: "var(--primary)",
                }}
              />
              <button
                type="button"
                className="btn btn-icon"
                style={{ width: 60, height: 60, fontSize: 32 }}
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus size={24} />
              </button>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700, color: "var(--text-muted)" }}>
              {product.unit?.toUpperCase()}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nama Box</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Box LCD TN35"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kode / QR Code (Opsional)</label>
            <input
              className="form-control font-mono"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Kosongkan untuk otomatis"
            />
          </div>

          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? "Memproses..." : "Buat Box & Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Transaction ───────────────────────────────────────────────────
function TransactionModal({ product, onClose, onDone }) {
  const [type, setType] = useState('OUT');
  const [qty, setQty] = useState(1);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [boxId, setBoxId] = useState(product.boxProducts && product.boxProducts.length > 0 ? product.boxProducts[0].boxId : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!boxId) return toast.error('Wajib memilih Box target transaksi agar stok sinkron.');
    if (qty < 1) return toast.error('Qty minimal 1');
    setLoading(true);
    try {
      await createTransaction({ productId: product.id, type, quantity: qty, referenceNo: ref, note, boxId: parseInt(boxId) });
      toast.success(`Transaksi ${type} berhasil`);
      if (onDone) onDone();
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
          <h2 className="modal-title">Buat Transaksi — {product.name}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipe Transaksi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ v: 'IN', label: 'Produk Masuk', color: 'var(--success)', bg: 'var(--success-bg)' }, { v: 'OUT', label: 'Produk Keluar', color: 'var(--danger)', bg: 'var(--danger-bg)' }, { v: 'ADJUST', label: 'Penyesuaian', color: 'var(--warning)', bg: 'var(--warning-bg)' }].map(opt => (
                <button key={opt.v} type="button" 
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid', borderColor: type === opt.v ? opt.color : 'var(--border)', background: type === opt.v ? opt.bg : 'transparent', color: type === opt.v ? opt.color : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setType(opt.v)}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 700 }}>Pilih Box (Wajib Sinkron)</label>
            <select className="form-control" value={boxId} onChange={e => setBoxId(e.target.value)} required>
              <option value="" disabled>-- Pilih Box Penyimpanan --</option>
              {product.boxProducts?.map(bp => (
                <option key={bp.boxId} value={bp.boxId}>
                   {bp.box.name} ({bp.quantity} {product.unit}) — {bp.box.code}
                </option>
              ))}
            </select>
            {(!product.boxProducts || product.boxProducts.length === 0) && <p style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>Produk ini belum ditempatkan di box manapun. Gunakan fitur "Taruh di Pallet / Box" terlebih dahulu.</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Jumlah</label>
              <input type="number" className="form-control" value={qty} min={1} onChange={e => setQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label className="form-label">No. Referensi</label>
              <input type="text" className="form-control" value={ref} onChange={e => setRef(e.target.value)} placeholder="PO-001" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea className="form-control" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Keterangan..." />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !boxId}>
              {loading ? 'Memproses...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Assign / Relocate to Location ─────────────────────────────────
function AssignLocationModal({ product, sourceBox = null, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [floors, setFloors] = useState([]);
  const [selFloor, setSelFloor] = useState(null);
  const [selRack, setSelRack] = useState(null);
  const [selSection, setSelSection] = useState(null);
  const [selBox, setSelBox] = useState(null);
  const [qty, setQty] = useState(sourceBox ? sourceBox.quantity : 1);

  const [childModal, setChildModal] = useState(null);
  const [editBox, setEditBox] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const fetchSuggestions = async () => {
    try {
      const res = await api.get('/locations/suggestions/empty');
      setSuggestions(res.data);
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    }
  };

  const fetchFloors = useCallback(async () => {
    const res = await api.get('/locations/floors');
    setFloors(res.data);
  }, []);

  const fetchFloorDetail = useCallback(async (fid) => {
    const res = await api.get(`/locations?floorId=${fid}`);
    const data = res.data[0];
    setSelFloor(data);
    if (selRack) {
      const newRack = data.racks.find(r => r.id === selRack.id);
      setSelRack(newRack || null);
      if (newRack && selSection) {
        const newSec = newRack.sections.find(s => s.id === selSection.id);
        setSelSection(newSec || null);
      }
    }
  }, [selRack, selSection]);

  useEffect(() => { 
    fetchFloors(); 
    fetchSuggestions();
  }, [fetchFloors]);

  const useSuggestion = async (sug) => {
    setLoading(true);
    try {
      const res = await api.get(`/locations?floorId=${sug.floorId}`);
      const data = res.data[0];
      setSelFloor(data);
      
      const rack = data.racks.find(r => r.id === sug.rackId);
      setSelRack(rack);
      
      const sec = rack?.sections.find(s => s.id === sug.sectionId);
      setSelSection(sec);
      
      setSelBox(null);
    } catch (err) {
      toast.error("Gagal memuat detail lokasi saran");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selBox) return toast.error('Pilih Box tujuan');
    if (sourceBox && sourceBox.boxId === selBox.id) return toast.error('Box asal dan tujuan tidak boleh sama');
    
    setLoading(true);
    try {
      if (sourceBox) {
        await api.post('/transactions', { productId: product.id, type: 'MOVE', quantity: qty, boxId: sourceBox.boxId, targetBoxId: selBox.id, note: `Relokasi dari ${sourceBox.box.name}`, });
        toast.success(`Berhasil memindahkan ${qty} ${product.unit} ke ${selBox.name}`);
      } else {
        await createTransaction({ productId: product.id, type: 'IN', quantity: qty, boxId: selBox.id, note: `Manual Assignment ke ${selBox.name}`, });
        toast.success(`Berhasil menaruh ${qty} ${product.unit} di ${selBox.name}`);
      }
      if (onDone) onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setLoading(false);
    }
  };

  const deleteBox = async (bid) => {
    if (!window.confirm('Yakin ingin menghapus box ini? (Hanya bisa jika kosong)')) return;
    try {
      await api.delete(`/locations/boxes/${bid}`);
      toast.success('Box dihapus');
      fetchFloorDetail(selFloor.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus box');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal animate-up" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">{sourceBox ? 'Relokasi / Pindah Produk' : 'Taruh di Lokasi (Pallet/Box)'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {sourceBox && (
          <div style={{ background: 'var(--warning-bg)', padding: '10px 16px', borderRadius: 12, marginBottom: 16, border: '1px solid var(--warning)', fontSize: 12 }}>
             Memindahkan produk dari <strong>{sourceBox.box.name}</strong> 
             ({sourceBox.box.pallet?.rackLevel.section.rack.floor.name} &gt; Rak {sourceBox.box.pallet?.rackLevel.section.rack.letter})
          </div>
        )}
        
        {suggestions.length > 0 && !selFloor && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} /> REKOMENDASI LOKASI KOSONG
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map(s => (
                <button 
                  key={s.id} 
                  className="card hover-card" 
                  onClick={() => useSuggestion(s)}
                  style={{ padding: '10px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--primary-glow)', border: '1px solid var(--primary)' }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{s.path}</div>
                  <ChevronRight size={14} color="var(--primary)" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '8px 0' }}>
          {!selFloor ? (
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {floors.map(f => (
                   <button key={f.id} className="card hover-card" style={{ padding: 20, textAlign: 'center' }} onClick={() => fetchFloorDetail(f.id)}>
                    <Map size={24} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                  </button>
                ))}
             </div>
          ) : (
            <div>
               <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => setSelFloor(null)}>{selFloor.name}</span>
                  {selRack && <><ChevronRight size={12} /> <span style={{ cursor: 'pointer' }} onClick={() => {setSelSection(null); setSelBox(null); setSelRack(null)}}>Rak {selRack.letter}</span></>}
                  {selSection && <><ChevronRight size={12} /> <span style={{ cursor: 'pointer' }} onClick={() => {setSelBox(null); setSelSection(null)}}>Baris {selRack.letter}{selSection.number}</span></>}
               </div>

               {!selRack && (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
                    {selFloor.racks.map(r => (
                       <button key={r.id} className="btn btn-ghost" onClick={() => setSelRack(r)} style={{ height: 60, fontSize: 18, border: '1px solid var(--border)' }}>{r.letter}</button>
                    ))}
                 </div>
               )}

               {selRack && !selSection && (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                    {selRack.sections.map(s => (
                       <button key={s.id} className="btn btn-ghost" onClick={() => setSelSection(s)} style={{ padding: 10, border: '1px solid var(--border)' }}>{selRack.letter}{s.number}</button>
                    ))}
                 </div>
               )}

               {selSection && (
                 <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selSection.levels.map(l => (
                       <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                           <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-muted)' }}>LEVEL {l.number}</div>
                           <button className="btn btn-ghost btn-sm" onClick={() => setChildModal({ type: 'pallet', parentId: l.id })} style={{ padding: '2px 8px', fontSize: 10 }}>+ Pallet & Box</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {l.pallets.map(p => (
                             <div key={p.id} style={{ marginLeft: 12, borderLeft: '2px solid var(--primary-glow)', paddingLeft: 12, paddingBottom: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                 <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={14} /> {p.name}</div>
                                 <button className="btn btn-ghost btn-sm" onClick={() => setChildModal({ type: 'box', parentId: p.id })} style={{ padding: '0px 6px', fontSize: 9 }}>+ Box & Isi</button>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {p.boxes.map(b => (
                                   <div key={b.id} style={{ display: 'flex', gap: 2 }}>
                                    <button 
                                      className={`btn btn-sm ${selBox?.id === b.id ? 'btn-primary' : 'btn-ghost'}`} 
                                      onClick={() => setSelBox(b)}
                                      style={{ fontSize: 11, border: '1px solid var(--border)', flex: 1 }}
                                    >
                                      <BoxIcon size={12} /> {b.name}
                                    </button>
                                    <button className="btn btn-icon btn-sm" style={{ width: 24, height: 28 }} onClick={() => setEditBox(b)}><Edit2 size={10} /></button>
                                    <button className="btn btn-icon btn-sm" style={{ width: 24, height: 28, color: 'var(--danger)' }} onClick={() => deleteBox(b.id)}><Trash2 size={10} /></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {l.pallets.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', border: '1px dashed var(--border)', borderRadius: 8 }}>Level kosong.</div>}
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>

        {selBox && (
          <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-surface)', borderRadius: 16, border: '2px solid var(--primary-glow)' }} className="animate-up">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><BoxIcon size={16} /> Tujuan: {selBox.name}</div>
            <div className="form-group">
              <label className="form-label">Jumlah Unit ({product.unit})</label>
              <input type="number" className="form-control" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} min={1} style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }} />
            </div>
            <button className="btn btn-primary w-full btn-lg" onClick={handleAction} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <div className="spinner" /> : sourceBox ? 'Pindahkan Sekarang' : 'Konfirmasi Penempatan'}
            </button>
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost w-full" onClick={onClose}>Batal</button>
        </div>

        {childModal?.type === 'pallet' && ( <CreatePalletModal levelId={childModal.parentId} onClose={() => setChildModal(null)} onCreated={() => fetchFloorDetail(selFloor.id)} /> )}
        {childModal?.type === 'box' && ( <CreateBoxModal palletId={childModal.parentId} productId={product.id} product={product} onClose={() => setChildModal(null)} onCreated={() => { fetchFloorDetail(selFloor.id); if (onDone) onDone(); }} /> )}
        {editBox && <EditBoxModal box={editBox} onClose={() => setEditBox(null)} onUpdated={() => fetchFloorDetail(selFloor.id)} />}
      </div>
    </div>
  );
}

// ─── Main Component: ProductDetailPage ─────────────────────────────────────────
export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txModal, setTxModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [sourceBox, setSourceBox] = useState(null); 
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('locations'); // 'locations' | 'history'
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProduct(id);
      setProduct(data);
      // Also load initial history
      loadHistory(true);
    } catch {
      toast.error('Produk tidak ditemukan');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (reset = false) => {
    if (loadingHistory) return;
    const pageToLoad = reset ? 1 : historyPage;
    setLoadingHistory(true);
    try {
      const res = await getTransactions({ productId: id, page: pageToLoad, limit: 15 });
      if (reset) {
        setTransactions(res.transactions);
        setHistoryPage(2);
      } else {
        setTransactions(prev => [...prev, ...res.transactions]);
        setHistoryPage(prev => prev + 1);
      }
      setHasMoreHistory(res.transactions.length === 15);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Logic for one-time sync: SUM(BoxProducts) -> Stock.quantity
      const sum = product.boxProducts?.reduce((acc, bp) => acc + bp.quantity, 0) || 0;
      await api.post('/transactions', {
        productId: product.id,
        type: 'ADJUST',
        quantity: sum,
        note: 'Manual Sync: Menyelaraskan Stok Global dengan Total Isi Box',
        // boxId OMITTED for global-only sync
      });
      toast.success('Stok berhasil disinkronkan');
      load();
    } catch (err) {
      toast.error('Gagal sinkron: ' + (err.response?.data?.error || 'Pastikan ada box untuk target sync.'));
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !product) return <div className="page-container loading-screen"><div className="spinner dark" /></div>;

  const qty = product.stock?.quantity ?? 0;
  const levelClass = qty === 0 ? 'empty' : product.minStock > 0 && qty <= product.minStock ? 'low' : 'ok';

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/products" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> Kembali</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{product.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{product.sku} · {product.category?.name || 'Umum'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleSync} disabled={syncing} title="Sync Global Stock with Box Totals">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setTxModal(true)}>
            <ArrowLeftRight size={16} /> Transaksi
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div className="card">
          <div className="card-title">Stok Global</div>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: `var(--${levelClass === 'empty' ? 'danger' : levelClass === 'low' ? 'warning' : 'success'})` }}>{qty}</div>
            <div style={{ color: 'var(--text-muted)' }}>{product.unit}</div>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
           <div className="card-title">QR Code Produk</div>
           <img src={getProductQR(id)} alt="QR" style={{ width: 140, margin: '0 auto', borderRadius: 8 }} />
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
           <div className="card-title">Barcode</div>
           <img src={getProductBarcode(id)} alt="Barcode" style={{ width: '100%', borderRadius: 8, background: 'white', padding: 10 }} />
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 24, marginTop: 40 }}>
        <button 
          className={`tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
          style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: activeTab === 'locations' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'locations' ? '2px solid var(--primary)' : 'none', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Map size={18} /> Penempatan Warehouse
          </div>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : 'none', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} /> Riwayat Mutasi Produk
          </div>
        </button>
      </div>

      {activeTab === 'locations' ? (
        <div className="card animate-fade-in" style={{ border: 'none', padding: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>MAPPING POSISI SAAT INI</span>
            <button className="btn btn-primary btn-sm" onClick={() => { setSourceBox(null); setAssignModal(true); }}><Plus size={14} /> Taruh di Pallet / Box baru</button>
          </div>
          
          <div style={{ padding: '12px 0' }}>
            {(!product.boxProducts || product.boxProducts.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 60, opacity: 0.5, background: 'var(--bg-surface)', borderRadius: 20 }}>
                <Map size={48} style={{ marginBottom: 16 }} />
                <p>Produk ini belum didata posisinya di map gudang.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {product.boxProducts.map(bp => (
                    <div key={bp.boxId} className="card glass hover-card animate-up" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ background: 'var(--primary-glow)', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BoxIcon size={16} color="var(--primary)" />
                            <span style={{ fontWeight: 800, fontSize: 14 }}>{bp.box.name}</span>
                         </div>
                         <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => { setSourceBox(bp); setAssignModal(true); }}>
                            <ArrowLeftRight size={14} /> Pindahkan
                         </button>
                      </div>
                      <div style={{ padding: 16 }}>
                        <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4, letterSpacing: -1 }}>
                          {bp.quantity} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{product.unit}</span>
                        </div>
                        {bp.lotNumber && <div style={{ marginBottom: 12 }}><span className="badge badge-warning" style={{ fontSize: 10 }}>LOT: {bp.lotNumber}</span></div>}
                        
                        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                           <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Full Coordinate Path</div>
                           <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                             <Map size={12} /> {bp.box.pallet?.rackLevel?.section?.rack?.floor?.name} &gt; Rak {bp.box.pallet?.rackLevel?.section?.rack?.letter} &gt; Row {bp.box.pallet?.rackLevel?.section?.number} &gt; Lvl {bp.box.pallet?.rackLevel?.number}
                           </div>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                           <Layers size={12} /> Unit Pallet: <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{bp.box.pallet?.name}</span>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card animate-fade-in" style={{ border: 'none', padding: 0 }}>
           <div className="card-header" style={{ marginBottom: 20 }}>
             <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>MUTASI TERAKHIR ({product.name})</span>
           </div>
           
           <div className="table-container" style={{ border: 'none', background: 'var(--bg-card)' }}>
             <table style={{ borderCollapse: 'separate', borderSpacing: '0 8px', width: '100%' }}>
               <thead>
                 <tr>
                   <th style={{ padding: '12px 20px' }}>Tanggal</th>
                   <th>Tipe</th>
                   <th>Jumlah</th>
                   <th>Operator</th>
                   <th>Catatan Audit</th>
                 </tr>
               </thead>
               <tbody>
                 {loadingHistory ? (
                   <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                 ) : transactions.length === 0 ? (
                   <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Belum ada histori transaksi untuk SKU ini.</td></tr>
                 ) : transactions.map(tx => (
                   <tr key={tx.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                     <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                     </td>
                     <td>
                        <span className={`badge ${tx.type === 'IN' ? 'badge-success' : tx.type === 'OUT' ? 'badge-danger' : 'badge-primary'}`}>
                           {tx.type === 'IN' && <ArrowUp size={10} />}
                           {tx.type === 'OUT' && <ArrowDown size={10} />}
                           {tx.type === 'MOVE' && <ArrowLeftRight size={10} />}
                           {tx.type}
                        </span>
                     </td>
                     <td style={{ fontSize: 18, fontWeight: 800 }}>
                        {tx.type === 'OUT' ? '-' : tx.type === 'IN' ? '+' : ''}{tx.quantity}
                     </td>
                     <td style={{ fontSize: 13 }}>{tx.user?.name}</td>
                     <td style={{ padding: '16px 20px', borderRadius: '0 12px 12px 0', fontSize: 13 }}>
                        {tx.type === 'MOVE' ? (
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            {tx.note}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{tx.note || '—'}</span>
                        )}
                        {tx.referenceNo && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4, fontFamily: 'monospace' }}>REF: {tx.referenceNo}</div>}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {txModal && <TransactionModal product={product} onClose={() => setTxModal(false)} onDone={load} />}
      {assignModal && <AssignLocationModal product={product} sourceBox={sourceBox} onClose={() => setAssignModal(false)} onDone={load} />}
    </div>
  );
}
