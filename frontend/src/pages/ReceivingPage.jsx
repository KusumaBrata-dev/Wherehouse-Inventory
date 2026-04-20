import { useState, useEffect, useCallback } from "react";
import {
  PackagePlus, Search, CheckCircle2, AlertCircle, Save, Package,
  ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import api, { getProducts, getPurchaseOrders, receivePurchaseOrder, directInbound } from "../services/api";

// ── Product Search Dropdown ───────────────────────────────────────────────
function ProductSearch({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/products?search=${encodeURIComponent(q)}&limit=10`);
      setResults(res.data.products || []);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const select = (p) => {
    onChange({ productId: p.id, productName: p.name, sku: p.sku, unit: p.unit });
    setQuery(`[${p.sku}] ${p.name}`);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px' }}>
        {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} style={{ opacity: 0.5 }} />}
        <input
          value={value?.productId ? `[${value.sku}] ${value.productName}` : query}
          onChange={e => { setQuery(e.target.value); onChange(null); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Cari produk (sku / nama)..."
          style={{ background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', flex: 1, color: 'var(--text-white)', fontSize: 14 }}
        />
        {value?.productId && (
          <button onClick={() => { onChange(null); setQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
          {results.map(p => (
            <div key={p.id} onClick={() => select(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-white)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--primary-light)' }}>{p.sku} · {p.unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main InboundPage ─────────────────────────────────────────────────────
export default function ReceivingPage() {
  const [mode, setMode] = useState('direct'); // 'direct' | 'po'
  const [items, setItems] = useState([{ product: null, quantity: 1, lotNumber: '' }]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null); // { boxCode, count }
  const [error, setError] = useState('');

  // PO mode states
  const [pendingPos, setPendingPos] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  const [poLoading, setPoLoading] = useState(false);
  const [poItems, setPoItems] = useState([]);
  const [showPoList, setShowPoList] = useState(false);

  // Load POs lazily only when user switches to PO mode
  useEffect(() => {
    if (mode === 'po' && pendingPos.length === 0) {
      setPoLoading(true);
      getPurchaseOrders()
        .then(data => setPendingPos(data.filter(p => p.status === 'PENDING')))
        .catch(() => {})
        .finally(() => setPoLoading(false));
    }
  }, [mode]);

  const addRow = () => setItems(prev => [...prev, { product: null, quantity: 1, lotNumber: '' }]);
  const removeRow = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  };

  // === DIRECT INBOUND SUBMIT ===
  const handleDirectSubmit = async () => {
    const validItems = items.filter(it => it.product?.productId && parseInt(it.quantity) > 0);
    if (validItems.length === 0) {
      setError('Minimal satu produk dengan jumlah valid harus diisi.');
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = {
        note: note || undefined,
        items: validItems.map(it => ({
          productId: it.product.productId,
          quantity: parseInt(it.quantity),
          lotNumber: it.lotNumber || '',
        }))
      };
      const res = await directInbound(payload);
      setSuccess({ boxCode: res.boxCode, count: validItems.length });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memproses inbound. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // === PO INBOUND SUBMIT ===
  const handlePoSubmit = async () => {
    const valid = poItems.filter(it => it.boxId);
    if (valid.length < poItems.length) {
      setError('Mohon pilih Lokasi Box untuk setiap produk.');
      return;
    }
    setLoading(true); setError('');
    try {
      await receivePurchaseOrder(selectedPo.id, { products: poItems });
      setSuccess({ boxCode: 'Dari PO', count: poItems.length });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memproses PO.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPo = async (po) => {
    setPoLoading(true);
    try {
      const res = await api.get(`/purchase-orders/${po.id}`);
      setSelectedPo(res.data);
      setPoItems(res.data.products.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        boxId: '',
        productName: it.product.name,
        sku: it.product.sku,
      })));
      setShowPoList(false);
    } catch { setError('Gagal memuat detail PO.'); }
    finally { setPoLoading(false); }
  };

  const resetAll = () => {
    setSuccess(null); setError(''); setNote('');
    setItems([{ product: null, quantity: 1, lotNumber: '' }]);
    setSelectedPo(null); setPoItems([]);
  };

  // ── SUCCESS STATE ─────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="page-container fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
        <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: 32, borderRadius: '50%', marginBottom: 24 }}>
          <CheckCircle2 size={80} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Inbound Berhasil!</h1>
        <p style={{ opacity: 0.7, marginBottom: 8 }}>{success.count} produk telah masuk ke <strong>Incoming Area</strong></p>
        {success.boxCode !== 'Dari PO' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 24px', marginBottom: 32, fontFamily: 'monospace', fontSize: 18, color: 'var(--primary-light)' }}>
            Box: {success.boxCode}
          </div>
        )}
        <p style={{ opacity: 0.5, fontSize: 13, marginBottom: 32 }}>
          Lanjutkan ke menu <strong>Putaway</strong> untuk memindahkan barang ke rak penyimpanan.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary btn-lg" onClick={resetAll}>
            <PackagePlus size={18} /> Inbound Berikutnya
          </button>
          <a href="/putaway" className="btn btn-outline btn-lg">Ke Putaway →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fadeIn">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="header-info">
          <div className="header-icon-box"><PackagePlus size={24} /></div>
          <div>
            <h1 className="page-title">Inbound — Terima Barang</h1>
            <p className="page-subtitle">Catat kedatangan barang ke Incoming Area (staging) sebelum di-putaway ke rak.</p>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        <button
          className={`btn ${mode === 'direct' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1 }}
          onClick={() => setMode('direct')}
        >
          <Package size={16} /> Input Langsung
        </button>
        <button
          className={`btn ${mode === 'po' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1 }}
          onClick={() => setMode('po')}
        >
          <ClipboardList size={16} /> Dari Purchase Order
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ═══ DIRECT MODE ═══ */}
      {mode === 'direct' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Daftar Produk Masuk</h3>
            <button className="btn btn-outline btn-sm" onClick={addRow}>
              <Plus size={14} /> Tambah Baris
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px auto', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Produk</div>
                  <ProductSearch value={row.product} onChange={(p) => updateRow(i, 'product', p)} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Jumlah</div>
                  <input
                    type="number" min="1" value={row.quantity}
                    onChange={e => updateRow(i, 'quantity', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-white)', fontSize: 14 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>No. Lot (opsional)</div>
                  <input
                    type="text" value={row.lotNumber} placeholder="e.g. LOT-001"
                    onChange={e => updateRow(i, 'lotNumber', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-white)', fontSize: 14 }}
                  />
                </div>
                <button onClick={() => removeRow(i)} disabled={items.length === 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 8, opacity: items.length === 1 ? 0.3 : 1 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Note */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Catatan (opsional)</div>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Contoh: Kiriman dari Toko Maju, surat jalan #001"
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-white)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {/* Info box */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 13, color: '#10b981' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Barang akan masuk ke <strong>Incoming Area</strong> dengan status <strong>RECEIVED</strong>. Lanjutkan dengan Putaway untuk memindahkan ke rak.</span>
          </div>

          <button
            className="btn btn-primary w-full"
            style={{ marginTop: 20, height: 50, fontSize: 15 }}
            onClick={handleDirectSubmit}
            disabled={loading}
          >
            {loading ? <><Loader2 size={18} className="spin" /> Memproses...</> : <><Save size={18} /> Konfirmasi Inbound ke INCOMING</>}
          </button>
        </div>
      )}

      {/* ═══ PO MODE ═══ */}
      {mode === 'po' && (
        <div>
          {/* PO Selector */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowPoList(!showPoList)}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {selectedPo ? `PO: ${selectedPo.poNumber}` : 'Pilih Purchase Order'}
                </div>
                {selectedPo && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Supplier: {selectedPo.supplier?.name}</div>}
              </div>
              {showPoList ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {showPoList && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {poLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={24} className="spin" /></div>
                ) : pendingPos.length === 0 ? (
                  <div style={{ opacity: 0.5, textAlign: 'center', padding: 20, fontSize: 13 }}>Tidak ada Purchase Order yang menunggu.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pendingPos.map(po => (
                      <div key={po.id} onClick={() => handleSelectPo(po)}
                        style={{ padding: '14px 16px', border: `1px solid ${selectedPo?.id === po.id ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: selectedPo?.id === po.id ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'all 0.2s' }}>
                        <div style={{ fontWeight: 700 }}>{po.poNumber}</div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{po.supplier?.name} · {po.products?.length} produk · {new Date(po.createdAt).toLocaleDateString('id-ID')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PO Items */}
          {selectedPo && poItems.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Produk dalam {selectedPo.poNumber}</h3>
              {poItems.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 8, marginBottom: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.productName}</div>
                    <div style={{ fontSize: 11, color: 'var(--primary-light)' }}>{it.sku}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Jumlah</div>
                    <input type="number" min="1" value={it.quantity}
                      onChange={e => setPoItems(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-white)', fontSize: 14 }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#60a5fa' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Penerimaan via PO akan mencatat transaksi IN dan memperbarui stok. Barang masuk ke Incoming Area.</span>
              </div>

              <button className="btn btn-primary w-full" style={{ marginTop: 16, height: 50 }} onClick={handlePoSubmit} disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> Memproses...</> : <><Save size={18} /> Terima PO & Masuk Incoming</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
