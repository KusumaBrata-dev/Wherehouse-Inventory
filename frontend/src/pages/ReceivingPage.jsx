import { useState, useEffect, useCallback, useRef } from "react";
import {
  PackagePlus, CheckCircle2, AlertCircle, Save, Loader2,
  ClipboardList, Trash2, ScanLine, Package, MapPin,
  Plus, Minus, ArrowRight, X, Clock
} from "lucide-react";
import api, { getPurchaseOrders, receivePurchaseOrder, directInbound } from "../services/api";
import BarcodeScanner from "../components/BarcodeScanner";

// ── Quick product lookup by SKU/barcode ──────────────────────────────────
async function lookupProduct(query) {
  const res = await api.get(`/products?search=${encodeURIComponent(query)}&limit=5`);
  const items = res.data.products || [];
  return items.find(p =>
    p.sku?.toLowerCase() === query.toLowerCase() ||
    p.barcode?.toLowerCase() === query.toLowerCase()
  ) || items[0] || null;
}

// ── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ startTime }) {
  const [elapsed, setElapsed] = useState('00:00');
  useEffect(() => {
    const iv = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 12,
      background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
      borderRadius: 10, padding: '8px 16px', fontSize: 12
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#10b981', fontWeight: 700 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s ease-in-out infinite' }} />
        RECEIVED
      </span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
      <span style={{ color: '#60a5fa', fontWeight: 600 }}>
        <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />INCOMING
      </span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={11} /> {elapsed}
      </span>
    </div>
  );
}

// ── Main InboundPage ─────────────────────────────────────────────────────
export default function ReceivingPage() {
  const [mode, setMode] = useState('direct'); // 'direct' | 'po'
  const sessionStart = useRef(Date.now());

  // Direct Inbound State
  const [palletCode, setPalletCode] = useState('');
  const [palletLocked, setPalletLocked] = useState(false);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [scanMsg, setScanMsg] = useState('');

  // Scanner State
  const [scannerTarget, setScannerTarget] = useState(null); // 'pallet' | 'product' | null

  // PO Mode State
  const [pendingPos, setPendingPos] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [poLoading, setPoLoading] = useState(false);

  const clearMsg = useCallback(() => { setTimeout(() => setScanMsg(''), 2000); }, []);

  // Load POs on demand
  useEffect(() => {
    if (mode === 'po' && pendingPos.length === 0) {
      setPoLoading(true);
      getPurchaseOrders()
        .then(data => setPendingPos(data.filter(p => p.status === 'PENDING')))
        .catch(() => {})
        .finally(() => setPoLoading(false));
    }
  }, [mode]);

  // ── Scan Handlers ──────────────────────────────────────────────────────
  const handleScan = useCallback(async (decodedText) => {
    setScannerTarget(null); // close scanner immediately

    if (scannerTarget === 'pallet') {
      setPalletCode(decodedText);
      setPalletLocked(true);
      setScanMsg(`✓ Pallet terdaftar: ${decodedText}`);
      clearMsg();
      return;
    }

    if (scannerTarget === 'product') {
      setScanMsg(`⏳ Mencari produk: ${decodedText}...`);
      try {
        const product = await lookupProduct(decodedText);
        if (!product) {
          setScanMsg(`⚠ Produk tidak ditemukan: "${decodedText}"`);
          clearMsg();
          return;
        }
        // Auto-add: if same product+lot already exists, increment qty
        setItems(prev => {
          const existingIdx = prev.findIndex(r => r.productId === product.id && r.lotNumber === '');
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
            setScanMsg(`✓ +1 ${product.name} (Total: ${next[existingIdx].quantity})`);
            clearMsg();
            return next;
          }
          setScanMsg(`✓ Ditambahkan: ${product.name}`);
          clearMsg();
          return [...prev, { productId: product.id, productName: product.name, sku: product.sku, unit: product.unit, quantity: 1, lotNumber: '' }];
        });
      } catch {
        setScanMsg(`⚠ Gagal mencari produk`);
        clearMsg();
      }
    }
  }, [scannerTarget, clearMsg]);

  const openScanner = (target) => setScannerTarget(target);
  const closeScanner = () => setScannerTarget(null);

  // ── Item Management ────────────────────────────────────────────────────
  const addManualRow = () => setItems(prev => [...prev, { productId: null, productName: '', sku: '', unit: '', quantity: 1, lotNumber: '' }]);
  const removeRow = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateQty = (i, delta) => setItems(prev => prev.map((r, idx) => idx === i ? { ...r, quantity: Math.max(1, r.quantity + delta) } : r));
  const updateField = (i, field, val) => setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  // ── Submit Direct Inbound ──────────────────────────────────────────────
  const handleDirectSubmit = async () => {
    const validItems = items.filter(it => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Scan atau tambah minimal satu produk sebelum submit.');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await directInbound({
        palletCode: palletCode || undefined,
        note: note || undefined,
        items: validItems.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          lotNumber: it.lotNumber || '',
        }))
      });
      setSuccess({ palletCode: res.palletCode, boxCode: res.boxCode, count: res.itemCount });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memproses inbound. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit PO ─────────────────────────────────────────────────────────
  const handlePoSubmit = async () => {
    setLoading(true); setError('');
    try {
      await receivePurchaseOrder(selectedPo.id, {
        products: poItems.map(it => ({ productId: it.productId, quantity: it.quantity, boxId: it.boxId || 1 }))
      });
      setSuccess({ palletCode: 'Dari PO', boxCode: selectedPo.poNumber, count: poItems.length });
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
      setPoItems(res.data.products.map(it => ({ productId: it.productId, quantity: it.quantity, productName: it.product.name, sku: it.product.sku })));
    } catch { setError('Gagal memuat detail PO.'); }
    finally { setPoLoading(false); }
  };

  const resetAll = () => {
    setSuccess(null); setError(''); setNote('');
    setPalletCode(''); setPalletLocked(false);
    setItems([]); setSelectedPo(null); setPoItems([]);
    sessionStart.current = Date.now();
  };

  // ── SUCCESS VIEW ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="page-container fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
        <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: 32, borderRadius: '50%', marginBottom: 24 }}>
          <CheckCircle2 size={80} />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Inbound Berhasil!</h1>
        <p style={{ opacity: 0.6, marginBottom: 20 }}>{success.count} produk tercatat masuk ke Incoming Area</p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 20px', textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Pallet</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>{success.palletCode}</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 20px', textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Box / Referensi</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa' }}>{success.boxCode}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 13, marginBottom: 32, background: 'rgba(245,158,11,0.1)', padding: '10px 20px', borderRadius: 10 }}>
          <ArrowRight size={16} />
          Lanjutkan ke <strong>Putaway</strong> untuk memindahkan barang ke rak penyimpanan
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary btn-lg" onClick={resetAll}>
            <PackagePlus size={18} /> Inbound Berikutnya
          </button>
          <a href="/putaway" className="btn btn-outline btn-lg">Putaway →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fadeIn">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="header-info">
          <div className="header-icon-box" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <PackagePlus size={24} />
          </div>
          <div>
            <h1 className="page-title">Inbound — Terima Barang</h1>
            <p className="page-subtitle">Catat kedatangan barang ke staging area (INCOMING) sebelum dipindah ke rak.</p>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${mode === 'direct' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('direct')}>
          <ScanLine size={16} /> Scan / Input Langsung
        </button>
        <button className={`btn ${mode === 'po' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('po')}>
          <ClipboardList size={16} /> Dari Purchase Order
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', marginLeft: 'auto' }}><X size={14} /></button>
        </div>
      )}

      {/* Scan message feedback */}
      {scanMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#34d399' }}>
          {scanMsg}
        </div>
      )}

      {/* ═══ DIRECT MODE ═══ */}
      {mode === 'direct' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status + Pallet Identity */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📦 Identitas Pallet</div>
                <StatusBadge startTime={sessionStart.current} />
              </div>
              {palletLocked && (
                <button onClick={() => { setPalletCode(''); setPalletLocked(false); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#f87171', cursor: 'pointer' }}>
                  <X size={12} style={{ display: 'inline', marginRight: 4 }} />Ganti Pallet
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={palletCode}
                  onChange={e => { setPalletCode(e.target.value); setPalletLocked(!!e.target.value); }}
                  placeholder="Scan atau ketik kode pallet (kosongkan = auto-buat)..."
                  disabled={palletLocked && !!palletCode}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '11px 14px',
                    background: palletLocked ? 'rgba(16,185,129,0.07)' : 'var(--bg-input)',
                    border: `1px solid ${palletLocked ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                    borderRadius: 10, color: 'var(--text-white)', fontSize: 14, outline: 'none',
                    fontFamily: palletLocked ? 'monospace' : 'inherit',
                    fontWeight: palletLocked ? 700 : 400,
                  }}
                />
              </div>
              <button
                onClick={() => openScanner('pallet')}
                className="btn btn-outline"
                style={{ padding: '11px 14px', flexShrink: 0 }}
                title="Scan QR Pallet"
              >
                <ScanLine size={18} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              💡 Kosongkan untuk auto-generate kode pallet baru · Scan pallet fisik untuk reuse
            </div>
          </div>

          {/* Product List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700 }}>
                📋 Daftar Produk
                {items.length > 0 && <span style={{ marginLeft: 8, background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{items.length}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => openScanner('product')}>
                  <ScanLine size={14} /> Scan Produk
                </button>
                <button className="btn btn-ghost btn-sm" onClick={addManualRow}>
                  <Plus size={14} /> Manual
                </button>
              </div>
            </div>

            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.3, border: '2px dashed var(--border)', borderRadius: 12 }}>
                <ScanLine size={40} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Belum ada produk</div>
                <div style={{ fontSize: 13 }}>Tekan "Scan Produk" atau "Manual" untuk menambahkan</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((row, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      {row.productId ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{row.productName}</div>
                          <div style={{ fontSize: 11, color: '#818cf8' }}>{row.sku} · {row.unit}</div>
                        </>
                      ) : (
                        <input
                          placeholder="Nama / SKU produk..."
                          value={row.productName}
                          onChange={e => updateField(i, 'productName', e.target.value)}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-white)', fontSize: 13, width: 220 }}
                        />
                      )}
                    </div>
                    <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 6 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Qty control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => updateQty(i, -1)} style={{ background: 'var(--bg-input)', border: 'none', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)' }}><Minus size={13} /></button>
                      <input
                        type="number" min="1" value={row.quantity}
                        onChange={e => updateField(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: 56, background: 'var(--bg-input)', border: 'none', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '7px 8px', color: 'var(--text-white)', fontSize: 14, textAlign: 'center' }}
                      />
                      <button onClick={() => updateQty(i, 1)} style={{ background: 'var(--bg-input)', border: 'none', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)' }}><Plus size={13} /></button>
                    </div>
                    {/* Lot Number */}
                    <input
                      type="text" value={row.lotNumber} placeholder="No. Lot (opsional)"
                      onChange={e => updateField(i, 'lotNumber', e.target.value)}
                      style={{ flex: 1, minWidth: 120, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-white)', fontSize: 13 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note + Submit */}
          {items.length > 0 && (
            <div className="card">
              <input
                type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Catatan (opsional) — e.g. Kiriman Toko Maju, Surat Jalan #001"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text-white)', fontSize: 14, marginBottom: 16 }}
              />
              <button className="btn btn-primary w-full" style={{ height: 52, fontSize: 15 }} onClick={handleDirectSubmit} disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> Memproses...</> : <><Save size={18} /> Konfirmasi Inbound ke INCOMING ({items.filter(i => i.productId).length} produk)</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ PO MODE ═══ */}
      {mode === 'po' && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Pilih Purchase Order (PENDING)</h3>
          {poLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={28} className="spin" /></div>
          ) : pendingPos.length === 0 ? (
            <div style={{ opacity: 0.5, textAlign: 'center', padding: 40, fontSize: 13 }}>Tidak ada PO yang menunggu konfirmasi.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {pendingPos.map(po => (
                <div key={po.id} onClick={() => handleSelectPo(po)}
                  style={{ padding: '14px 16px', border: `1px solid ${selectedPo?.id === po.id ? '#6366f1' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: selectedPo?.id === po.id ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'all 0.2s' }}>
                  <div style={{ fontWeight: 700 }}>{po.poNumber}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{po.supplier?.name} · {po.products?.length} produk · {new Date(po.createdAt).toLocaleDateString('id-ID')}</div>
                </div>
              ))}
            </div>
          )}

          {selectedPo && poItems.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                <h4 style={{ marginBottom: 12 }}>Produk dalam {selectedPo.poNumber}</h4>
                {poItems.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.productName}</div>
                      <div style={{ fontSize: 11, color: '#818cf8' }}>{it.sku}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => setPoItems(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r))} style={{ background: 'var(--bg-input)', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}><Minus size={12} /></button>
                      <span style={{ padding: '6px 10px', minWidth: 36, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{it.quantity}</span>
                      <button onClick={() => setPoItems(prev => prev.map((r, i) => i === idx ? { ...r, quantity: r.quantity + 1 } : r))} style={{ background: 'var(--bg-input)', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}><Plus size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary w-full" style={{ marginTop: 16, height: 50 }} onClick={handlePoSubmit} disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> Memproses...</> : <><Save size={18} /> Terima PO & Masuk Incoming</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* ═══ BARCODE SCANNER MODAL ═══ */}
      {scannerTarget && (
        <BarcodeScanner
          title={scannerTarget === 'pallet' ? 'Scan Kode Pallet' : 'Scan Barcode Produk'}
          onScan={handleScan}
          onClose={closeScanner}
        />
      )}
    </div>
  );
}
