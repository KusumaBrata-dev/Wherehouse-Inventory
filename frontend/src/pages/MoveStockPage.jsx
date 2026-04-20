import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ScanLine, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import api from '../services/api';

export default function MoveStockPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sourceCode, setSourceCode] = useState(searchParams.get('sourceCode') || '');
  const [sourceType, setSourceType] = useState(searchParams.get('sourceType') || '');
  const [targetCode, setTargetCode] = useState('');
  
  const [step, setStep] = useState(sourceCode ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Focus effect for scanner input
  useEffect(() => {
    const focusTimer = setInterval(() => {
      const input = document.getElementById(step === 1 ? 'source-scanner' : 'target-scanner');
      if (input && document.activeElement !== input) input.focus();
    }, 500);
    return () => clearInterval(focusTimer);
  }, [step]);

  const handleSourceScan = (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim().toUpperCase();
      e.target.value = '';
      if (!val) return;

      let type = 'LEVEL'; // default fallback for older QRs
      let code = val;
      if (val.includes('|')) {
        [type, code] = val.split('|');
      }

      if (!['LEVEL', 'COLUMN', 'RACK'].includes(type) && !val.includes('-')) {
        setError('QR sumber tidak didukung untuk mass-move. Gunakan QR Level, Kolom, atau Rak (Hierarki).');
        return;
      }
      setSourceCode(code);
      setSourceType(type);
      setStep(2);
      setError(null);
    }
  };

  const handleTargetScan = async (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim().toUpperCase();
      e.target.value = '';
      if (!val) return;

      let type = 'LEVEL';
      let code = val;
      if (val.includes('|')) {
         [type, code] = val.split('|');
      }

      if (type !== 'LEVEL') {
         setError('Tujuan harus berupa spesifik LEVEL rak (Contoh: L1-A-03-02)');
         return;
      }

      setTargetCode(code);
      await processMove(code);
    }
  };

  const processMove = async (targetLevelCode) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.post('/locations/move-bulk', {
        sourceCode,
        sourceType,
        targetLevelCode
      });
      setSuccess(`Berhasil! ${data.palletsMoved} pallet pindah ke ${targetLevelCode}`);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memindahkan pallet');
      setTargetCode(''); // Let them scan again
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setSourceCode('');
    setSourceType('');
    setTargetCode('');
    setStep(1);
    setSuccess(null);
    setError(null);
    navigate('/move-stock', { replace: true });
  };

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: 100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><ArrowRightLeft size={32} color="var(--warning)" /> Bulk Transfer Stock</h1>
          <p className="page-subtitle">Pindah seluruh isi Level / Kolom / Rak dalam satu kali scan ke tujuan baru.</p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* PROGRESS BAR */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: step >= 1 ? 'var(--warning)' : 'var(--border)' }} />
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: step >= 2 ? 'var(--warning)' : 'var(--border)' }} />
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: step === 3 ? 'var(--success)' : 'var(--border)' }} />
        </div>

        {error && (
          <div className="alert alert-danger animate-up" style={{ marginBottom: 24 }}>
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        {/* STEP 1: SCAN SOURCE */}
        {step === 1 && (
          <div className="card text-center animate-up" style={{ padding: 48, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'inline-block', padding: 24, background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)', borderRadius: '50%', marginBottom: 24 }}>
              <ScanLine size={48} />
            </div>
            <h2 style={{ marginBottom: 8 }}>1. Scan Lokasi Sumber</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
              Scan QR Level, Kolom, atau Rak yang ingin dikosongkan.
            </p>
            <input
              id="source-scanner"
              type="text"
              className="scanner-input"
              placeholder="Arahkan scanner ke QR lokasi sumber..."
              onKeyDown={handleSourceScan}
              autoComplete="off"
            />
          </div>
        )}

        {/* STEP 2: SCAN TARGET */}
        {step === 2 && (
          <div className="card text-center animate-up" style={{ padding: 48, background: 'var(--bg-surface)' }}>
            <div style={{ marginBottom: 24 }}>
              <div className="badge badge-warning" style={{ fontSize: 16, padding: '8px 16px', background: 'rgba(234,179,8,0.2)' }}>
                Memindahkan isi dari: <strong>{sourceType} {sourceCode}</strong>
              </div>
            </div>
            
            <div style={{ display: 'inline-block', padding: 24, background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', marginBottom: 24 }}>
              <ScanLine size={48} />
            </div>
            <h2 style={{ marginBottom: 8 }}>2. Scan Lokasi Tujuan</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
              Scan QR Level spesifik untuk meletakkan pallet-pallet tersebut.
            </p>
            
            {loading ? (
              <div style={{ padding: 24 }}>
                 <div className="spinner warning" style={{ margin: '0 auto', marginBottom: 16 }} />
                 <div style={{ fontWeight: 600, color: 'var(--warning)' }}>Memproses Pemindahan Massal...</div>
              </div>
            ) : (
              <input
                id="target-scanner"
                type="text"
                className="scanner-input"
                placeholder="Arahkan scanner ke QR lokasi tujuan (LEVEL)..."
                onKeyDown={handleTargetScan}
                autoComplete="off"
              />
            )}

            {!loading && (
              <div style={{ marginTop: 24 }}>
                <button className="btn btn-ghost" onClick={resetFlow}>Batal & Ulangi</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 3 && success && (
          <div className="card text-center animate-up" style={{ padding: 48, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'inline-block', padding: 24, background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', borderRadius: '50%', marginBottom: 24 }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ marginBottom: 8, color: 'var(--success)' }}>Transfer Selesai!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 16 }}>
              {success}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
               <button className="btn btn-ghost" onClick={() => navigate('/scan')}>Tutup Laporan</button>
               <button className="btn btn-primary" onClick={resetFlow}>Pindah Barang Lagi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
