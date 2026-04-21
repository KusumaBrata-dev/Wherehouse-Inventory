import { useState, useRef } from 'react';
import { Search, ScanLine, ArrowRight, CheckCircle, Package, MapPin, Loader2, RotateCcw, ChevronRight, Inbox, AlertTriangle, Info } from 'lucide-react';
import api from '../services/api';
import BarcodeScanner from '../components/BarcodeScanner';

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState('item');

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

  const handleScanItem = async (code) => {
    const rawCode = typeof code === 'string' ? code : itemCode;
    if (!rawCode?.trim()) return;

    setStatus(STATUS.SCANNING_ITEM);
    setError('');
    setIsScannerOpen(false);

    try {
      const res = await api.get(`/scan/${encodeURIComponent(rawCode.trim())}`);
      const data = res.data;

      if (data.type !== 'pallet' && data.type !== 'box') {
        throw new Error(`Item "${rawCode}" adalah ${data.type}. Scan Pallet atau Box untuk memulai Putaway.`);
      }

      if (data.location?.floor !== 'Incoming Area') {
        throw new Error(`Item ${data.code} sudah berada di rak (${data.location?.fullCode}). Gunakan "Pindah Stok" untuk relokasi.`);
      }

      if (data.status === 'LOCKED') {
        throw new Error(`Item ${data.code} sedang dikunci oleh sesi Inbound aktif.`);
      }
      if (data.status === 'STORED') {
        throw new Error(`Item ${data.code} sudah berstatus STORED.`);
      }

      setItemData(data);
      setStatus(STATUS.ITEM_FOUND);

      // AUTOMATIC: Open Step 2 scanner immediately after Item is found
      setTimeout(() => openScanner('dest'), 600);

      try {
        const sugRes = await api.get('/locations/suggest');
        if (sugRes.data.available) {
          setSuggestions([sugRes.data]);
        }
      } catch (e) {}

      setTimeout(() => destRef.current?.focus(), 200);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Item tidak ditemukan.');
      setStatus(STATUS.IDLE);
    }
  };

  const handleScanDest = async (code) => {
    const rawCode = typeof code === 'string' ? code : destCode;
    if (!rawCode?.trim()) return;

    setStatus(STATUS.SCANNING_DEST);
    setError('');
    setIsScannerOpen(false);

    try {
      const res = await api.get(`/scan/${encodeURIComponent(rawCode.trim())}`);
      const data = res.data;

      if (data.type !== 'level') {
        throw new Error(`"${rawCode}" bukan kode rak yang valid.`);
      }

      if (data.palletCount >= (data.capacity || 20)) {
        throw new Error(`Lokasi ${data.code} sudah penuh.`);
      }

      if (data.id === itemData.rackLevelId) {
        throw new Error('Lokasi tujuan sama dengan lokasi saat ini.');
      }

      setDestData(data);
      setDestCode(data.code);
      setStatus(STATUS.DEST_FOUND);

      // AUTOMATIC: Trigger move immediately after destination is scanned (Fast Mode)
      // Small delay so the user sees the "Dest Found" screen for a split second
      setTimeout(() => {
        handleConfirmMove(data.id);
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lokasi tidak ditemukan.');
      setStatus(STATUS.ITEM_FOUND);
      setDestCode('');
    }
  };

  const handleConfirmMove = async (targetId) => {
    // Use targetId if provided (auto-flow), else use destData.id (manual button click)
    const finalTargetId = targetId || destData?.id;
    if (!itemData || !finalTargetId || status === STATUS.MOVING) return;

    setStatus(STATUS.MOVING);
    setError('');
    try {
      const palletId = itemData.type === 'pallet' ? itemData.id : itemData.palletId;
      await api.patch(`/locations/pallets/${palletId}/move`, { newLevelId: finalTargetId });
      setResult({ item: itemData.code, from: 'Incoming Area', to: destCode || 'Rak' });
      setStatus(STATUS.DONE);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memindahkan pallet.');
      setStatus(STATUS.DEST_FOUND);
    }
  };

  const openScanner = (mode) => {
    setScannerMode(mode);
    setIsScannerOpen(true);
  };

  const useSuggestion = (sug) => {
    setDestCode(sug.code);
    handleScanDest(sug.code);
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

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {status === STATUS.DONE && result && (
        <div className="putaway-success animate-fade">
          <CheckCircle size={48} className="success-icon" />
          <h2>Putaway Berhasil!</h2>
          <div className="move-summary">
            <div className="move-item">
              <Package size={18} />
              <span className="move-code">{result.item}</span>
            </div>
            <div className="move-path">
              <span className="from-loc">Incoming Area</span>
              <ArrowRight size={16} />
              <span className="to-loc">{result.to}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={reset}>
            <ScanLine size={18} /> Putaway Berikutnya
          </button>
        </div>
      )}

      {status !== STATUS.DONE && (
        <>
          <div className="putaway-card">
            <div className="card-label">
              <ScanLine size={16} />
              <span>Langkah 1 — Scan Kode Pallet / Box di Incoming Area</span>
            </div>
            <div className="scan-form">
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={itemRef}
                  className="scan-input"
                  placeholder="Scan atau ketik kode pallet/box..."
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScanItem()}
                  disabled={[STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status)}
                  autoFocus
                />
                <button 
                  className="btn btn-primary" 
                  style={{ position: 'absolute', right: 4, top: 4, height: 32, width: 32, padding: 0 }}
                  onClick={() => openScanner('item')}
                  disabled={[STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status)}
                >
                  <ScanLine size={14} />
                </button>
              </div>
            </div>

            {itemData && (
              <div className="found-card animate-slide-up" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="found-badge">{itemData.type === 'pallet' ? '🪵 Pallet' : '📦 Box'}</div>
                  <span className="badge badge-primary">{itemData.status}</span>
                </div>
                <div className="found-code">{itemData.code}</div>
                <div className="found-detail">
                  {itemData.products?.length > 0 ? (
                    <ul className="product-list">
                      {itemData.products.map((p, idx) => (
                        <li key={idx}>
                          <span>{p.name} {p.lotNumber ? `[Lot: ${p.lotNumber}]` : ''}</span>
                          <span className="qty-badge">{p.quantity} {p.unit}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="muted">Kosong</span>}
                </div>
              </div>
            )}
          </div>

          {[STATUS.ITEM_FOUND, STATUS.SCANNING_DEST, STATUS.DEST_FOUND, STATUS.MOVING].includes(status) && (
            <div className="putaway-card animate-slide-up" style={{ marginTop: 20 }}>
              <div className="card-label">
                <MapPin size={16} />
                <span>Langkah 2 — Scan Lokasi Tujuan (contoh: L1-A-03-02)</span>
              </div>

              {suggestions.length > 0 && !destData && (
                <div className="suggestions">
                  <span className="suggestions-label">💡 Rekomendasi:</span>
                  <div className="suggestion-chips">
                    {suggestions.map(s => (
                      <button key={s.levelId} className="chip" onClick={() => useSuggestion(s)}>
                        {s.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="scan-form">
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={destRef}
                    className="scan-input"
                    placeholder="Scan QR lokasi rak..."
                    value={destCode}
                    onChange={e => setDestCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScanDest()}
                    disabled={status === STATUS.DEST_FOUND || status === STATUS.MOVING}
                  />
                  <button 
                    className="btn btn-primary" 
                    style={{ position: 'absolute', right: 4, top: 4, height: 32, width: 32, padding: 0 }}
                    onClick={() => openScanner('dest')}
                    disabled={status === STATUS.DEST_FOUND || status === STATUS.MOVING}
                  >
                    <ScanLine size={14} />
                  </button>
                </div>
              </div>

              {destData && (
                <div className="found-card found-card-dest animate-fade" style={{ marginTop: 16 }}>
                  <div className="found-badge dest-badge">📍 Lokasi</div>
                  <div className="found-code">{destData.code}</div>
                  <div className="found-detail muted">Kapasitas OK • {destData.floorName}</div>
                </div>
              )}
            </div>
          )}

          {status === STATUS.DEST_FOUND && (
            <div className="putaway-card putaway-confirm animate-bounce-in" style={{ marginTop: 20 }}>
              <button className="btn btn-success btn-lg confirm-btn" style={{ width: '100%', height: 50 }} onClick={handleConfirmMove}>
                <CheckCircle size={18} /> Konfirmasi Putaway
              </button>
            </div>
          )}
        </>
      )}

      {status === STATUS.MOVING && (
        <div className="putaway-card loading-card">
          <Loader2 size={32} className="spin" />
          <span>Memindahkan item...</span>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)}
          onScan={scannerMode === 'item' ? handleScanItem : handleScanDest}
          title={scannerMode === 'item' ? "Scan Pallet / Box" : "Scan QR Lokasi Rak"}
        />
      )}
    </div>
  );
}
