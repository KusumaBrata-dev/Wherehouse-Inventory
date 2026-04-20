import { useState, useRef } from 'react';
import { Search, ScanLine, ArrowRight, CheckCircle, Package, MapPin, Loader2, RotateCcw, ChevronRight, Inbox } from 'lucide-react';
import api from '../services/api';

const STATUS = {
  IDLE: 'idle',
  SCANNING_ITEM: 'scanning_item',
  ITEM_FOUND: 'item_found',
  SCANNING_DEST: 'scanning_dest',
  DEST_FOUND: 'dest_found',
  MOVING: 'moving',
  DONE: 'done',
  ERROR: 'error',
};

export default function PutawayPage() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [itemCode, setItemCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [itemData, setItemData] = useState(null);
  const [destData, setDestData] = useState(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const itemRef = useRef(null);
  const destRef = useRef(null);

  const reset = () => {
    setStatus(STATUS.IDLE);
    setItemCode('');
    setDestCode('');
    setItemData(null);
    setDestData(null);
    setError('');
    setSuggestions([]);
    setResult(null);
    setTimeout(() => itemRef.current?.focus(), 100);
  };

  // Step 1: Scan item at Incoming Area
  const handleScanItem = async (e) => {
    e.preventDefault();
    if (!itemCode.trim()) return;
    setStatus(STATUS.SCANNING_ITEM);
    setError('');
    try {
      const res = await api.get(`/scan/${encodeURIComponent(itemCode.trim())}`);
      const data = res.data;

      if (!['pallet', 'box'].includes(data.type)) {
        setError(`Kode ini adalah ${data.type === 'product' ? 'SKU Produk' : data.type}. Scan kode Pallet atau Box yang ada di Incoming Area.`);
        setStatus(STATUS.IDLE);
        return;
      }

      // Warn if item is already STORED (not in INCOMING)
      if (data.status === 'STORED') {
        setError(`Item ${data.code} sudah tersimpan di rak (${data.location?.fullCode || 'lokasi diketahui'}). Gunakan menu "Pindah Stok" untuk relokasi.`);
        setStatus(STATUS.IDLE);
        return;
      }

      setItemData(data);
      setStatus(STATUS.ITEM_FOUND);

      // Load auto-suggest locations (excludes Incoming Area automatically)
      try {
        const sugRes = await api.get('/locations/suggest');
        if (sugRes.data.available) {
          setSuggestions([sugRes.data]);
        }
      } catch {
        // Suggestions are optional
      }

      setTimeout(() => destRef.current?.focus(), 200);
    } catch (err) {
      setError(err.response?.data?.error || 'Item tidak ditemukan. Pastikan kode benar.');
      setStatus(STATUS.IDLE);
    }
  };

  // Step 2: Scan destination location
  const handleScanDest = async (e) => {
    e.preventDefault();
    if (!destCode.trim()) return;
    setStatus(STATUS.SCANNING_DEST);
    setError('');
    try {
      const res = await api.get(`/scan/${encodeURIComponent(destCode.trim())}`);
      const data = res.data;

      if (data.type !== 'level') {
        setError(`"${destCode}" bukan kode lokasi yang valid. Gunakan format L1-A-03-02 atau scan QR rak.`);
        setStatus(STATUS.ITEM_FOUND);
        setDestCode('');
        return;
      }

      if (data.palletCount > 0) {
        setError(`Lokasi ${data.code} sudah berisi ${data.palletCount} pallet. Pilih lokasi yang kosong.`);
        setStatus(STATUS.ITEM_FOUND);
        setDestCode('');
        return;
      }

      setDestData(data);
      setStatus(STATUS.DEST_FOUND);
    } catch (err) {
      setError(err.response?.data?.error || 'Lokasi tidak ditemukan.');
      setStatus(STATUS.ITEM_FOUND);
      setDestCode('');
    }
  };

  // Step 3: Confirm move (Putaway)
  const handleConfirmMove = async () => {
    if (!itemData || !destData) return;
    setStatus(STATUS.MOVING);
    setError('');
    try {
      // Resolve palletId — whether scanning a pallet or a box
      let palletId;
      if (itemData.type === 'pallet') {
        palletId = itemData.id;
      } else if (itemData.type === 'box') {
        // Box data from /scan includes palletId
        palletId = itemData.palletId;
        if (!palletId) {
          setError('Box ini tidak terkait pallet. Scan kode Pallet-nya langsung.');
          setStatus(STATUS.DEST_FOUND);
          return;
        }
      }

      await api.patch(`/locations/pallets/${palletId}/move`, {
        newLevelId: destData.id
      });

      setResult({
        item: itemData.code || itemData.name,
        from: itemData.location?.fullCode || 'Incoming Area',
        to: destData.code
      });
      setStatus(STATUS.DONE);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memindahkan. Coba lagi.');
      setStatus(STATUS.DEST_FOUND);
    }
  };

  const useSuggestion = (sug) => {
    setDestCode(sug.code || '');
    destRef.current?.focus();
  };

  return (
    <div className="putaway-page">
      <div className="putaway-header">
        <div className="putaway-header-icon">
          <Inbox size={28} />
        </div>
        <div>
          <h1>Putaway</h1>
          <p>Incoming Area → Rak Penyimpanan</p>
        </div>
        {status !== STATUS.IDLE && (
          <button className="btn-ghost btn-sm" onClick={reset} title="Reset">
            <RotateCcw size={16} /> Reset
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="putaway-steps">
        <div className={`putaway-step ${[STATUS.SCANNING_ITEM, STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING, STATUS.DONE].includes(status) ? 'active' : ''} ${[STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING, STATUS.DONE].includes(status) ? 'done' : ''}`}>
          <div className="step-circle">1</div>
          <span>Scan Item</span>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        <div className={`putaway-step ${[STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING, STATUS.DONE].includes(status) ? 'active' : ''} ${[STATUS.DEST_FOUND, STATUS.MOVING, STATUS.DONE].includes(status) ? 'done' : ''}`}>
          <div className="step-circle">2</div>
          <span>Scan Tujuan</span>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        <div className={`putaway-step ${[STATUS.MOVING, STATUS.DONE].includes(status) ? 'active' : ''} ${status === STATUS.DONE ? 'done' : ''}`}>
          <div className="step-circle">3</div>
          <span>Konfirmasi</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* DONE State */}
      {status === STATUS.DONE && result && (
        <div className="putaway-success">
          <CheckCircle size={48} className="success-icon" />
          <h2>Putaway Berhasil!</h2>
          <div className="move-summary">
            <div className="move-item">
              <Package size={18} />
              <span className="move-code">{result.item}</span>
            </div>
            <div className="move-path">
              <span className="from-loc">{result.from}</span>
              <ArrowRight size={16} />
              <span className="to-loc">{result.to}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={reset}>
            <ScanLine size={18} /> Putaway Berikutnya
          </button>
        </div>
      )}

      {/* STEP 1: Scan Item */}
      {![STATUS.DONE].includes(status) && (
        <div className="putaway-card">
          <div className="card-label">
            <ScanLine size={16} />
            <span>Langkah 1 — Scan Kode Pallet / Box di Incoming Area</span>
          </div>
          <form onSubmit={handleScanItem} className="scan-form">
            <input
              ref={itemRef}
              className="scan-input"
              placeholder="Scan atau ketik kode pallet/box..."
              value={itemCode}
              onChange={e => setItemCode(e.target.value)}
              disabled={[STATUS.SCANNING_ITEM, STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status)}
              autoFocus
            />
            {![STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status) && (
              <button type="submit" className="btn btn-primary" disabled={status === STATUS.SCANNING_ITEM}>
                {status === STATUS.SCANNING_ITEM ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                Cari
              </button>
            )}
          </form>

          {/* Item Found Card */}
          {itemData && (
            <div className="found-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="found-badge">{itemData.type === 'pallet' ? '🪵 Pallet' : '📦 Box'}</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: itemData.status === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                  color: itemData.status === 'RECEIVED' ? '#10b981' : '#6366f1'
                }}>
                  {itemData.status === 'RECEIVED' ? '⏳ INCOMING' : '✅ STORED'}
                </span>
              </div>
              <div className="found-code">{itemData.code}</div>
              <div className="found-detail">
                {itemData.products?.length > 0 ? (
                  <ul className="product-list">
                    {itemData.products.map(p => (
                      <li key={p.productId}><span>{p.name}</span><span className="qty-badge">{p.quantity} {p.unit}</span></li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">Tidak ada produk di dalam</span>
                )}
              </div>
              {itemData.location && (
                <div className="found-location">
                  <MapPin size={12} /> {itemData.location.fullPath || 'Incoming Area'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Scan Destination */}
      {[STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND].includes(status) && (
        <div className="putaway-card">
          <div className="card-label">
            <MapPin size={16} />
            <span>Langkah 2 — Scan Lokasi Tujuan (contoh: L1-A-03-02)</span>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !destData && (
            <div className="suggestions">
              <span className="suggestions-label">💡 Rekomendasi lokasi kosong:</span>
              <div className="suggestion-chips">
                {suggestions.map(s => (
                  <button key={s.id} className="chip" onClick={() => useSuggestion(s)}>
                    {s.path}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleScanDest} className="scan-form">
            <input
              ref={destRef}
              className="scan-input"
              placeholder="Scan QR lokasi rak (L1-A-03-02)..."
              value={destCode}
              onChange={e => setDestCode(e.target.value)}
              disabled={[STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status)}
            />
            {status !== STATUS.DEST_FOUND && (
              <button type="submit" className="btn btn-primary" disabled={status === STATUS.SCANNING_DEST}>
                {status === STATUS.SCANNING_DEST ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                Verifikasi
              </button>
            )}
          </form>

          {/* Destination Found */}
          {destData && (
            <div className="found-card found-card-dest">
              <div className="found-badge dest-badge">📍 Lokasi</div>
              <div className="found-code">{destData.code}</div>
              <div className="found-detail muted">{destData.floorName} — Kosong, siap diisi</div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Confirm Move */}
      {status === STATUS.DEST_FOUND && itemData && destData && (
        <div className="putaway-card putaway-confirm">
          <div className="card-label">
            <CheckCircle size={16} />
            <span>Langkah 3 — Konfirmasi Pemindahan</span>
          </div>
          <div className="confirm-summary">
            <div className="confirm-item">
              <Package size={20} />
              <div>
                <div className="confirm-label">Item</div>
                <div className="confirm-value">{itemData.code}</div>
              </div>
            </div>
            <ArrowRight size={20} className="confirm-arrow" />
            <div className="confirm-item">
              <MapPin size={20} />
              <div>
                <div className="confirm-label">Ke Lokasi</div>
                <div className="confirm-value">{destData.code}</div>
                <div className="confirm-sub">{destData.floorName}</div>
              </div>
            </div>
          </div>
          <button className="btn btn-success btn-lg confirm-btn" onClick={handleConfirmMove}>
            <CheckCircle size={18} /> Konfirmasi Putaway
          </button>
        </div>
      )}

      {status === STATUS.MOVING && (
        <div className="putaway-card loading-card">
          <Loader2 size={32} className="spin" />
          <span>Memindahkan item...</span>
        </div>
      )}
    </div>
  );
}
