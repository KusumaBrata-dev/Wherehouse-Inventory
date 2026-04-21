import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, ScanLine, Loader2 } from 'lucide-react';

// Audio bleep — short 800Hz beep  
let audioCtx = null;
const playBeep = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'square';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (_) {}
};

const vibrate = (pattern = [60]) => {
  if (navigator.vibrate) navigator.vibrate(pattern);
};

export default function BarcodeScanner({ onScan, onClose, title = 'Scan Barcode / QR Code' }) {
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | error
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScan, setLastScan] = useState('');
  const debounceRef = useRef(null);
  const scannerRef = useRef(null);
  const containerId = 'qr-scan-container';

  const handleSuccess = useCallback((decodedText) => {
    // Debounce: reject identical scan within 1.5s
    if (decodedText === lastScan) return;

    // Clear debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setLastScan(''), 1500);

    setLastScan(decodedText);
    playBeep();
    vibrate([60, 30, 60]);
    onScan(decodedText);
  }, [lastScan, onScan]);

  const startScanner = useCallback(async () => {
    setStatus('starting');
    setErrorMsg('');
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setStatus('error');
        setErrorMsg('Tidak ada kamera yang ditemukan.');
        return;
      }
      // Prefer back camera for warehouse use
      const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];

      const instance = new Html5Qrcode(containerId);
      scannerRef.current = instance;

      await instance.start(
        { deviceId: { exact: cam.id } },
        {
          fps: 10,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.5,
          disableFlip: false,
        },
        handleSuccess,
        () => {} // ignore ongoing errors
      );
      setStatus('scanning');
    } catch (err) {
      setStatus('error');
      setErrorMsg(String(err?.message || err));
    }
  }, [handleSuccess]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_) {}
      try { scannerRef.current.clear(); } catch (_) {}
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startScanner();
    return () => { stopScanner(); if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleClose = () => {
    // Snappy UI: Fire onClose immediately so the modal disappears instantly
    onClose(); 
    // Cleanup happens in the background to avoid UI lag
    stopScanner().catch(() => {});
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 20,
        width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.1))',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(99,102,241,0.2)', borderRadius: 10, padding: 8 }}>
              <ScanLine size={20} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-white)' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Arahkan kamera ke barcode / QR Code</div>
            </div>
          </div>
          <button onClick={handleClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10,
            padding: 8, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div style={{ padding: 20 }}>
          {status === 'starting' && (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" />
              <span style={{ fontSize: 13 }}>Menginisialisasi kamera...</span>
            </div>
          )}

          {status === 'error' && (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 20 }}>
              <Camera size={48} style={{ opacity: 0.3 }} />
              <div style={{ color: '#f43f5e', fontSize: 14 }}>{errorMsg || 'Kamera tidak dapat diakses'}</div>
              <button className="btn btn-primary btn-sm" onClick={startScanner}>
                Coba Lagi
              </button>
            </div>
          )}

          {/* QR Container — always rendered so html5-qrcode can attach */}
          <div
            id={containerId}
            style={{
              width: '100%',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#000',
              display: status === 'scanning' ? 'block' : 'none',
              aspectRatio: '4/3'
            }}
          />

          {/* Live Indicator */}
          {status === 'scanning' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#10b981' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s ease-in-out infinite' }} />
              Kamera aktif — Scan barcode sekarang
            </div>
          )}

          {/* Last scanned indicator */}
          {lastScan && (
            <div style={{ marginTop: 10, padding: '7px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: 12, color: '#10b981', textAlign: 'center' }}>
              ✓ Terbaca: <strong>{lastScan}</strong>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Debounce aktif: 1.5s • Suara + Getaran enabled</span>
          <button onClick={handleClose} className="btn btn-ghost btn-sm">Tutup</button>
        </div>
      </div>
    </div>
  );
}
