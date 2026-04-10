import { useEffect, useState, useRef, useCallback } from 'react';
import { scanItem, createTransaction } from '../services/api';
import { Html5QrcodeScanner } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { ScanLine, Keyboard, Camera, MapPin, X, Package, Minus } from 'lucide-react';

export default function ScanPage() {
  const [mode, setMode] = useState('hardware'); // 'hardware' | 'camera'
  const [inputVal, setInputVal] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueQty, setIssueQty] = useState(1);
  const [issueNote, setIssueNote] = useState('');
  const inputRef = useRef(null);
  const scannerRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  // ── Hardware scanner: focus input on mount
  useEffect(() => {
    if (mode === 'hardware' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  // ── Camera scanner init
  useEffect(() => {
    if (mode !== 'camera') return;

    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 280, height: 180 },
      aspectRatio: 1.5,
      showTorchButtonIfSupported: true,
    }, false);

    scanner.render(
      async (decodedText) => {
        // QR might be JSON: { sku, name }
        let sku = decodedText;
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.sku) sku = parsed.sku;
        } catch (_) {}
        await handleScan(sku);
      },
      (err) => console.debug('Scan error:', err)
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(console.error);
    };
  }, [mode]);

  const handleScan = useCallback(async (sku) => {
    const cleaned = sku.trim();
    if (!cleaned) return;

    setLoading(true);
    setScanResult(null);
    try {
      const data = await scanItem(cleaned);
      setScanResult(data);
      setIssueQty(1);
      setIssueNote('');
      // vibrate on mobile
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (err) {
      toast.error(err.response?.data?.error || `Item "${cleaned}" tidak ditemukan`);
      setScanResult(null);
    } finally {
      setLoading(false);
      setInputVal('');
      if (mode === 'hardware' && inputRef.current) inputRef.current.focus();
    }
  }, [mode]);

  // Hardware scanner: submit on Enter or auto-submit after pause
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(scanTimeoutRef.current);
      handleScan(inputVal);
    }
  };

  const handleInputChange = (e) => {
    setInputVal(e.target.value);
    clearTimeout(scanTimeoutRef.current);
    // Hardware scanners type fast — auto-submit after 300ms silence
    scanTimeoutRef.current = setTimeout(() => {
      if (e.target.value.length > 2) handleScan(e.target.value);
    }, 400);
  };

  const handleIssue = async () => {
    if (!scanResult) return;
    if (issueQty < 1 || issueQty > scanResult.quantity) {
      return toast.error(`Qty tidak valid. Stok tersedia: ${scanResult.quantity}`);
    }
    setIssuing(true);
    try {
      await createTransaction({
        itemId: scanResult.id,
        type: 'OUT',
        quantity: issueQty,
        note: issueNote || `Ambil via scan — ${scanResult.primaryRack || ''}`,
      });
      toast.success(`✅ ${issueQty} ${scanResult.unit} berhasil diambil`);
      setScanResult(prev => ({ ...prev, quantity: prev.quantity - issueQty }));
      setIssueQty(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membuat transaksi');
    } finally {
      setIssuing(false);
    }
  };

  const currentQtyColor = scanResult
    ? scanResult.quantity === 0 ? 'var(--danger)'
    : scanResult.isLowStock ? 'var(--warning)' : 'var(--success)'
    : 'var(--text-white)';

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1>Scan Barang</h1>
          <p>Scan QR atau Barcode untuk melihat & mengambil stok</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="scan-mode-tabs">
        <button
          id="tab-hardware"
          className={`scan-tab${mode === 'hardware' ? ' active' : ''}`}
          onClick={() => { setScanResult(null); setMode('hardware'); }}
        >
          <Keyboard size={16} /> Hardware Scanner
        </button>
        <button
          id="tab-camera"
          className={`scan-tab${mode === 'camera' ? ' active' : ''}`}
          onClick={() => { setScanResult(null); setMode('camera'); }}
        >
          <Camera size={16} /> Kamera HP
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: scanResult ? '1fr 1fr' : '1fr', gap: 24, maxWidth: scanResult ? 'none' : 560 }}>
        {/* Scanner Area */}
        <div>
          {mode === 'hardware' ? (
            <div className="card hardware-scan-input">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🔍</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Tempelkan kursor di sini lalu scan barcode menggunakan hardware scanner
                </p>
              </div>
              <input
                ref={inputRef}
                id="hardware-scan-input"
                type="text"
                className="form-control hardware-scan-field"
                placeholder="Scan atau ketik SKU..."
                value={inputVal}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: 'var(--text-muted)' }}>
                  <div className="spinner dark" />
                  <span>Mencari item...</span>
                </div>
              )}
              <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)' }}>
                💡 <strong>Tip:</strong> Hardware scanner (Honeywell, Panda) otomatis mengirim Enter setelah scan. Kamu juga bisa ketik SKU manual dan tekan Enter.
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div id="qr-reader" style={{ width: '100%' }} />
              {loading && (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <div className="spinner dark" /> Mencari item...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className="scan-result animate-up">
            <button
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={() => setScanResult(null)}
            >
              <X size={18} />
            </button>

            {/* Rack Location */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lokasi Rack</div>
              {scanResult.rackLocations.length === 0 ? (
                <div className="scan-result-rack" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  <MapPin size={18} /> Belum diatur
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {scanResult.rackLocations.map(r => (
                    <div key={r.id} className="scan-result-rack">
                      <MapPin size={16} /> {r.rackCode}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Item Info */}
            <div className="scan-result-item">{scanResult.name}</div>
            <div className="scan-result-sku">{scanResult.sku} · {scanResult.category || 'Tanpa Kategori'}</div>

            {/* Stock Qty */}
            <div style={{ marginBottom: 24 }}>
              <div className="scan-result-qty" style={{ color: currentQtyColor }}>{scanResult.quantity}</div>
              <div className="scan-result-unit">{scanResult.unit}</div>
              <div className="scan-result-label">Stok saat ini</div>
              {scanResult.isLowStock && scanResult.quantity > 0 && (
                <div className="badge badge-warning" style={{ margin: '0 auto' }}>⚠️ Stok Menipis</div>
              )}
              {scanResult.quantity === 0 && (
                <div className="badge badge-danger" style={{ margin: '0 auto' }}>🚫 Stok Habis</div>
              )}
            </div>

            {/* Issue / Ambil Item */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                <Minus size={14} style={{ display: 'inline', marginRight: 4 }} />
                Ambil Item (OUT)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  id="issue-qty"
                  type="number"
                  className="form-control"
                  value={issueQty}
                  min={1}
                  max={scanResult.quantity}
                  onChange={e => setIssueQty(parseInt(e.target.value) || 1)}
                  style={{ width: 90, textAlign: 'center', fontWeight: 700, fontSize: 16 }}
                  disabled={scanResult.quantity === 0}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Catatan (opsional)"
                  value={issueNote}
                  onChange={e => setIssueNote(e.target.value)}
                  disabled={scanResult.quantity === 0}
                />
              </div>
              <button
                id="issue-btn"
                className="btn btn-danger w-full"
                onClick={handleIssue}
                disabled={issuing || scanResult.quantity === 0}
              >
                {issuing
                  ? <><div className="spinner" /> Memproses...</>
                  : <><Package size={16} /> Ambil {issueQty} {scanResult.unit}</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
