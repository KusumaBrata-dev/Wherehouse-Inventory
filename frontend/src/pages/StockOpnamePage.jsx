import { useState, useRef } from 'react';
import { ScanLine, ClipboardCheck, RotateCcw, Search, Loader2, CheckCircle, AlertTriangle, ChevronRight, MapPin, Package } from 'lucide-react';
import api from '../services/api';

const STATUS = {
  IDLE: 'idle',
  LOADING_LOCATION: 'loading_location',
  COUNTING: 'counting',
  SUBMITTING: 'submitting',
  DONE: 'done',
};

export default function StockOpnamePage() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [locationCode, setLocationCode] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [items, setItems] = useState([]); // { ...item, actualQty: '' }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const scanRef = useRef(null);

  const reset = () => {
    setStatus(STATUS.IDLE);
    setLocationCode('');
    setLocationData(null);
    setItems([]);
    setResult(null);
    setError('');
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  const handleScanLocation = async (e) => {
    e.preventDefault();
    if (!locationCode.trim()) return;
    setStatus(STATUS.LOADING_LOCATION);
    setError('');
    try {
      const res = await api.get(`/opname/location/${encodeURIComponent(locationCode.trim())}`);
      setLocationData(res.data);
      setItems(res.data.items.map(item => ({ ...item, actualQty: String(item.systemQty) })));
      setStatus(STATUS.COUNTING);
    } catch (err) {
      setError(err.response?.data?.error || 'Lokasi tidak ditemukan.');
      setStatus(STATUS.IDLE);
    }
  };

  const updateActual = (index, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], actualQty: value };
      return copy;
    });
  };

  const getDiff = (item) => {
    const actual = parseInt(item.actualQty);
    if (isNaN(actual)) return null;
    return actual - item.systemQty;
  };

  const hasDiscrepancies = items.some(item => getDiff(item) !== 0 && getDiff(item) !== null);
  const discrepancyCount = items.filter(item => getDiff(item) !== 0 && getDiff(item) !== null).length;

  const handleSubmit = async () => {
    setStatus(STATUS.SUBMITTING);
    setError('');
    try {
      const res = await api.post('/opname/adjust', {
        locationCode: locationData.locationCode,
        items: items.map(item => ({
          productId: item.productId,
          boxId: item.boxId,
          systemQty: item.systemQty,
          actualQty: parseInt(item.actualQty) || 0
        }))
      });
      setResult(res.data);
      setStatus(STATUS.DONE);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan adjustment.');
      setStatus(STATUS.COUNTING);
    }
  };

  return (
    <div className="opname-page">
      <div className="putaway-header">
        <div className="putaway-header-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          <ClipboardCheck size={28} />
        </div>
        <div>
          <h1>Stock Opname</h1>
          <p>Validasi stok fisik vs sistem per lokasi</p>
        </div>
        {status !== STATUS.IDLE && (
          <button className="btn-ghost btn-sm" onClick={reset}>
            <RotateCcw size={16} /> Reset
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="putaway-steps">
        <div className={`putaway-step ${status !== STATUS.IDLE ? 'done' : 'active'}`}>
          <div className="step-circle">1</div>
          <span>Scan Lokasi</span>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        <div className={`putaway-step ${status === STATUS.COUNTING || status === STATUS.SUBMITTING ? 'active' : ''} ${status === STATUS.DONE ? 'done' : ''}`}>
          <div className="step-circle">2</div>
          <span>Hitung Fisik</span>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        <div className={`putaway-step ${status === STATUS.DONE ? 'done' : ''}`}>
          <div className="step-circle">3</div>
          <span>Selesai</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* DONE */}
      {status === STATUS.DONE && result && (
        <div className="putaway-success">
          <CheckCircle size={48} className="success-icon" />
          <h2>Opname Selesai!</h2>
          <p className="muted">{result.message}</p>
          <div className="opname-result-summary">
            <div className="result-stat">
              <span className="stat-num">{items.length}</span>
              <span className="stat-label">Item dicek</span>
            </div>
            <div className="result-stat">
              <span className="stat-num discrepancy">{discrepancyCount}</span>
              <span className="stat-label">Penyesuaian</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={reset}>
            <ScanLine size={18} /> Opname Lokasi Berikutnya
          </button>
        </div>
      )}

      {/* STEP 1: Scan Location */}
      {status === STATUS.IDLE && (
        <div className="putaway-card">
          <div className="card-label">
            <MapPin size={16} />
            <span>Scan kode lokasi yang ingin di-opname</span>
          </div>
          <form onSubmit={handleScanLocation} className="scan-form">
            <input
              ref={scanRef}
              className="scan-input"
              placeholder="Scan QR lokasi (contoh: L1-A-03-02)..."
              value={locationCode}
              onChange={e => setLocationCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={status === STATUS.LOADING_LOCATION}>
              {status === STATUS.LOADING_LOCATION ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              Muat Data
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: Count Items */}
      {status === STATUS.COUNTING && locationData && (
        <>
          <div className="opname-location-banner">
            <MapPin size={16} />
            <div>
              <strong>{locationData.locationCode}</strong>
              <span className="muted"> — {locationData.path}</span>
            </div>
            <span className="pallet-count">{locationData.palletCount} pallet</span>
          </div>

          {items.length === 0 ? (
            <div className="putaway-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Package size={40} className="muted" style={{ margin: '0 auto 12px' }} />
              <p className="muted">Lokasi ini kosong di sistem. Opname selesai!</p>
              <button className="btn btn-primary" onClick={reset}>Selesai</button>
            </div>
          ) : (
            <>
              <div className="opname-table-container">
                <table className="opname-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nama Produk</th>
                      <th>Pallet</th>
                      <th>Sistem</th>
                      <th>Aktual</th>
                      <th>Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const diff = getDiff(item);
                      const isOk = diff === 0;
                      const isMissing = diff < 0;
                      return (
                        <tr key={`${item.productId}-${item.boxId}`} className={diff !== 0 && diff !== null ? 'row-discrepancy' : ''}>
                          <td><span className="sku-tag">{item.sku}</span></td>
                          <td>{item.name}</td>
                          <td className="muted">{item.palletCode}</td>
                          <td className="text-center">{item.systemQty} <span className="muted-sm">{item.unit}</span></td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              className="qty-input"
                              value={item.actualQty}
                              onChange={e => updateActual(idx, e.target.value)}
                            />
                          </td>
                          <td className="text-center">
                            {diff === null ? '—' : (
                              <span className={`diff-badge ${isOk ? 'ok' : isMissing ? 'minus' : 'plus'}`}>
                                {isOk ? '✓' : (diff > 0 ? `+${diff}` : diff)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="opname-footer">
                {hasDiscrepancies && (
                  <div className="discrepancy-warning">
                    <AlertTriangle size={16} />
                    <span>{discrepancyCount} item memiliki selisih stok — akan dibuat adjustment</span>
                  </div>
                )}
                {!hasDiscrepancies && (
                  <div className="no-discrepancy">
                    <CheckCircle size={16} />
                    <span>Semua stok sesuai — tidak ada adjustment diperlukan</span>
                  </div>
                )}
                <button className="btn btn-success btn-lg" onClick={handleSubmit}>
                  <CheckCircle size={18} />
                  {hasDiscrepancies ? `Simpan ${discrepancyCount} Adjustment` : 'Selesai Opname'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {status === STATUS.SUBMITTING && (
        <div className="putaway-card loading-card">
          <Loader2 size={32} className="spin" />
          <span>Menyimpan adjustment...</span>
        </div>
      )}
    </div>
  );
}
