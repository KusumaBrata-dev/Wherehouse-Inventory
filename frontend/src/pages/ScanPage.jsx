import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { scanProduct, createTransaction } from "../services/api";
import api from "../services/api";
import { Html5QrcodeScanner } from "html5-qrcode";
import toast from "react-hot-toast";
import {
  ScanLine,
  Keyboard,
  Camera,
  MapPin,
  X,
  Package,
  Plus,
  Minus,
  ChevronRight,
  Box,
  Layers,
  QrCode,
  Clock,
  ArrowUp,
  ArrowDown,
  Settings2,
  ArrowRightLeft,
  Map,
} from "lucide-react";
import RelocatePalletModal from "../components/RelocatePalletModal";
import CreatePalletModal from "../components/CreatePalletModal";
import QRModal from "../components/QRModal";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Format date helper ────────────────────────────────────────────────────
function fmtDate(d) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component: QR Preview Button ──────────────────────────────────────────
function QRButton({ type, id, name, size = 16 }) {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={(e) => {
          e.stopPropagation();
          setShow(true);
        }}
        title={`Preview QR ${name}`}
        style={{ color: "var(--primary)" }}
      >
        <QrCode size={size} />
      </button>
      {show && (
        <QRModal
          type={type}
          id={id}
          name={name}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}

// ─── Special Box Product Edit Modal ──────────────────────────────────────────
function BoxProductEditModal({ bi, boxId, boxCode, onClose, onSaved }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState("OUT");

  const handleTransaction = async () => {
    const parsedQty = parseInt(qty) || 1;
    if (parsedQty < 1) return toast.error("Qty harus lebih dari 0");
    if (actionType === "OUT" && parsedQty > bi.quantity) {
      return toast.error(
        `Stok tidak cukup. Tersedia: ${bi.quantity} ${bi.unit}`,
      );
    }

    setLoading(true);
    try {
      await createTransaction({
        productId: bi.productId,
        type: actionType,
        quantity: parsedQty,
        boxId: boxId,
        note: `${actionType === "IN" ? "Tambah ke" : "Kurangi dari"} Box ${boxCode}`,
      });
      toast.success(
        `Berhasil ${actionType === "IN" ? "menambah" : "mengurangi"} ${parsedQty} ${bi.unit}`,
      );
      onSaved(bi.productId, actionType === "IN" ? parsedQty : -parsedQty);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal memproses transaksi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal animate-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: 8,
                background: "var(--primary-glow)",
                color: "var(--primary)",
                borderRadius: 8,
              }}
            >
              <Settings2 size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: 16 }}>
                Edit Produk Box
              </h3>
              <p
                style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}
              >
                Box: {boxCode}
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
            padding: "16px",
            background: "var(--bg-base)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text-white)",
              marginBottom: 4,
            }}
          >
            {bi.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            {bi.sku}
          </div>
          <div
            className="badge badge-primary"
            style={{ fontSize: 14, padding: "6px 16px" }}
          >
            Stok di Box: {bi.quantity} {bi.unit}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tipe Aksi</label>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <button
              className={`btn ${actionType === "OUT" ? "btn-danger" : "btn-ghost"}`}
              onClick={() => setActionType("OUT")}
              style={{ flex: 1 }}
            >
              <ArrowDown size={14} /> Kurangi (OUT)
            </button>
            <button
              className={`btn ${actionType === "IN" ? "btn-success" : "btn-ghost"}`}
              onClick={() => setActionType("IN")}
              style={{ flex: 1 }}
            >
              <ArrowUp size={14} /> Tambah (IN)
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Jumlah (Qty)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-icon"
              style={{ width: 48, height: 48, fontSize: 20 }}
              onClick={() => setQty((q) => Math.max(1, parseInt(q) - 1))}
            >
              −
            </button>
            <input
              type="number"
              className="form-control"
              style={{
                textAlign: "center",
                fontSize: 24,
                fontWeight: 800,
                height: 52,
              }}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button
              className="btn btn-icon"
              style={{ width: 48, height: 48, fontSize: 20 }}
              onClick={() => setQty((q) => parseInt(q) + 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="modal-footer" style={{ border: "none", padding: 0 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className={`btn ${actionType === "OUT" ? "btn-danger" : "btn-success"}`}
            style={{ flex: 2 }}
            onClick={handleTransaction}
            disabled={loading || (actionType === "OUT" && bi.quantity < 1)}
          >
            {loading ? <div className="spinner" /> : "Konfirmasi Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProductModal({ boxId, boxCode, initialProduct, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(
    initialProduct || null,
  );
  const [qty, setQty] = useState(1);

  const search = async () => {
    if (query.length < 2) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/products?search=${query}`);
      setResults(data);
    } catch (err) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    try {
      await createTransaction({
        productId: selectedProduct.id,
        type: "IN",
        quantity: qty,
        boxId: boxId,
        note: `Ditambahkan ke Box ${boxCode}`,
      });
      toast.success(`${selectedProduct.name} ditambahkan ke box`);
      onAdded(selectedProduct, qty);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal animate-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Input Quantity - Box {boxCode}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {!selectedProduct ? (
          <div style={{ padding: "8px 0" }}>
            <div className="search-box" style={{ marginBottom: 16 }}>
              <Package size={18} />
              <input
                type="text"
                className="form-control"
                placeholder="Cari Nama / SKU..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <button className="btn btn-primary" onClick={search}>
                Cari
              </button>
            </div>

            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {loading ? (
                <div className="spinner dark" style={{ margin: "20px auto" }} />
              ) : (
                results.map((product) => (
                  <div
                    key={product.id}
                    className="card hover-card"
                    style={{ cursor: "pointer", padding: 12 }}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div style={{ fontWeight: 600 }}>{product.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {product.sku}
                    </div>
                  </div>
                ))
              )}
              {results.length === 0 && !loading && query.length > 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  Tidak ada hasil.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="modal-body animate-fade">
            <div
              style={{
                textAlign: "center",
                marginBottom: 24,
                padding: "20px 0",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                MASUKKAN JUMLAH ANGKA
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                <button
                  className="btn btn-icon"
                  style={{ width: 60, height: 60, fontSize: 32 }}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  -
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
                  className="btn btn-icon"
                  style={{ width: 60, height: 60, fontSize: 32 }}
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                {selectedProduct.unit?.toUpperCase()}
              </div>
            </div>

            <div
              className="card"
              style={{ background: "var(--bg-card)", marginBottom: 24 }}
            >
              <div style={{ fontWeight: 700 }}>{selectedProduct.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontFamily: "monospace",
                }}
              >
                {selectedProduct.sku}
              </div>
              <button
                className="btn btn-link btn-sm"
                style={{ marginTop: 8, padding: 0 }}
                onClick={() => setSelectedProduct(null)}
              >
                Ganti Produk
              </button>
            </div>

            <div className="modal-footer" style={{ padding: 0 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={onClose}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleAdd}
                disabled={loading || qty < 1}
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  `Simpan ${qty} Quantity`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Box History Panel ────────────────────────────────────────────────────
function BoxHistory({ boxId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boxId) return;
    setLoading(true);
    api
      .get(`/locations/boxes/${boxId}/history`)
      .then((r) => setHistory(r.data.history))
      .catch(() => toast.error("Gagal memuat riwayat"))
      .finally(() => setLoading(false));
  }, [boxId]);

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Clock size={16} color="var(--text-muted)" />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--text-secondary)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Jejak Transaksi Box
        </h3>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div className="spinner dark" style={{ margin: "0 auto" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: "center", color: "var(--text-muted)" }}
            >
              Belum ada riwayat
            </div>
          ) : (
            history.map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${tx.type === "IN" ? "var(--success)" : tx.type === "OUT" ? "var(--danger)" : "var(--warning)"}`,
                  borderRadius: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {tx.product.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {fmtDate(tx.date)} by {tx.user.name}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color:
                      tx.type === "IN" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {tx.type === "IN" ? "+" : "-"}
                  {tx.quantity}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Product Card inside Box ─────────────────────────────────────────────────────
function BoxProductCard({ bi, onEdit, onQuickUpdate }) {
  const isEmpty = bi.quantity === 0;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isEmpty ? "var(--danger)" : "var(--border)"}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 12,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          src={`${API_URL}/api/products/${bi.productId}/qr`}
          alt="QR"
          style={{ width: 60, height: 60, objectFit: "contain" }}
        />
      </div>
      <div style={{ padding: "12px", flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 8,
            height: 32,
            overflow: "hidden",
          }}
        >
          {bi.name}
        </div>

        {/* QUICK QUANTITY */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            background: "rgba(0,0,0,0.05)",
            padding: 8,
            borderRadius: 12,
          }}
        >
          <button
            className="btn btn-icon btn-sm"
            onClick={() => onQuickUpdate(bi, "OUT", 1)}
          >
            -
          </button>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{bi.quantity}</div>
          <button
            className="btn btn-icon btn-sm"
            onClick={() => onQuickUpdate(bi, "IN", 1)}
          >
            +
          </button>
        </div>

        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {bi.unit}
        </div>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <button
          className="btn btn-ghost w-full btn-sm"
          style={{ fontSize: 11 }}
          onClick={() => onEdit(bi)}
        >
          <Settings2 size={12} /> Edit Detail
        </button>
      </div>
    </div>
  );
}

// ─── Main ScanPage ─────────────────────────────────────────────────────────────
export default function ScanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState("hardware");
  const [inputVal, setInputVal] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueQty, setIssueQty] = useState(1);
  const [issueNote, setIssueNote] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState(null);
  const [addingToBox, setAddingToBox] = useState(null);
  const [movingPallet, setMovingPallet] = useState(null);
  const [showAddPallet, setShowAddPallet] = useState(false);

  const inputRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (mode === "hardware" && inputRef.current) inputRef.current.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "camera") return;
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 160 },
        aspectRatio: 1.5,
        showTorchButtonIfSupported: true,
      },
      false,
    );
    scanner.render(
      async (dt) => {
        await handleScan(dt);
      },
      (err) => console.log(err),
    );
    scannerRef.current = scanner;
    return () => scanner.clear().catch(console.error);
  }, [mode]);

  const handleScan = useCallback(
    async (code) => {
      const cleaned = code.trim();
      if (!cleaned) return;
      setLoading(true);
      setScanResult(null);
      try {
        const { data } = await api.get(`/scan/${cleaned}`);

        // Locations remain on this page to show Summary Dashboard
        if (data.type === "floor") {
          navigate(`/locations/${data.id}`);
          return;
        }

        setScanResult(data);
        setHistoryKey((k) => k + 1);
      } catch (err) {
        toast.error(`"${cleaned}" tidak ditemukan`);
      } finally {
        setLoading(false);
        setInputVal("");
        if (mode === "hardware" && inputRef.current) inputRef.current.focus();
      }
    },
    [mode, navigate]
  );

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      handleScan(code);
    }
  }, [searchParams, handleScan]);

  useEffect(() => {
    if (location.state?.initialScan) {
      setSearchParams({ code: location.state.initialScan });
    }
  }, [location.state, setSearchParams]);

  const handleIssue = async () => {
    if (!scanResult) return;
    setIssuing(true);
    try {
      await createTransaction({
        productId: scanResult.id,
        type: "OUT",
        quantity: issueQty,
        note: issueNote,
      });
      toast.success("Berhasil");
      setScanResult((prev) => ({
        ...prev,
        quantity: prev.quantity - issueQty,
      }));
    } catch (err) {
      toast.error("Gagal");
    } finally {
      setIssuing(false);
    }
  };

  const onRelocated = (updatedPallet) => {
    if (scanResult?.type === "pallet" && scanResult.id === updatedPallet.id) {
      setScanResult((prev) => ({ ...prev, location: updatedPallet.location }));
    }
    setHistoryKey((k) => k + 1);
  };

  const handleQuickUpdate = async (bi, type, qty) => {
    try {
      await api.post("/transactions", {
        productId: bi.productId,
        type: type,
        quantity: qty,
        boxId: scanResult.id,
        note: `Update Quick via Scan (${type})`,
      });
      const { data } = await api.get(`/scan/${scanResult.code}`);
      setScanResult(data);
      toast.success(
        `${type === "IN" ? "Bertambah" : "Berkurang"} ${qty} ${bi.unit}`,
      );
    } catch (err) {
      toast.error("Gagal update angka");
    }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <h1>Scan Inventaris</h1>
        {scanResult && (
          <button className="btn btn-ghost" onClick={() => setScanResult(null)}>
            <X size={16} /> Tutup
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <ScanLine size={18} />
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder="Scan Barcode / Kode..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan(inputVal)}
          />
        </div>
        <button
          className={`btn ${mode === "camera" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode(mode === "camera" ? "hardware" : "camera")}
        >
          <Camera size={18} />
        </button>
      </div>

      {mode === "camera" && !scanResult && (
        <div
          id="qr-reader"
          className="card"
          style={{ marginBottom: 24, maxWidth: 500, margin: "0 auto" }}
        />
      )}

      {/* ───── HIERARCHY SUMMARY (RACK/COLUMN/LEVEL) ───── */}
      {(scanResult?.type === "rack" ||
        scanResult?.type === "column" ||
        scanResult?.type === "section" ||
        scanResult?.type === "level") && (
        <div className="animate-up" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div
            className="card"
            style={{
              background: "var(--bg-surface)",
              marginBottom: 20,
              borderLeft: "4px solid var(--primary)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    padding: 12,
                    background: "var(--primary-glow)",
                    color: "var(--primary)",
                    borderRadius: 12,
                  }}
                >
                  {scanResult.type === "rack" ? (
                    <Layers size={24} />
                  ) : scanResult.type === "column" || scanResult.type === "section" ? (
                    <MapPin size={24} />
                  ) : (
                    <Box size={24} />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    {scanResult.type === "rack"
                      ? `Rak ${scanResult.letter}`
                      : scanResult.type === "column" || scanResult.type === "section"
                        ? `Kolom ${scanResult.columnNumber} (Rak ${scanResult.rackLetter})`
                        : `Level ${scanResult.number} (Kolom ${scanResult.section?.number} Rak ${scanResult.section?.rack?.letter})`}
                  </h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: 'monospace' }}>
                    {scanResult.code} • {scanResult.floorName}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                 <QRButton
                  type={scanResult.type}
                  id={scanResult.id}
                  name={scanResult.code}
                  size={20}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 24,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {scanResult.palletCount !== undefined ? scanResult.palletCount : scanResult.totalPallets || 0}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Total Pallet
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {scanResult.type === "rack" ? scanResult.columns?.length || 0 : scanResult.type === "column" || scanResult.type === "section" ? scanResult.levels?.length || 0 : scanResult.totalBoxes || 0}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  {scanResult.type === "rack" ? "Total Kolom" : scanResult.type === "column" || scanResult.type === "section" ? "Total Level" : "Total Box"}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* RACK VIEW */}
            {scanResult.type === "rack" && (
              <div className="card" style={{ background: "transparent", padding: 0 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, background: "rgba(255,255,255,0.02)" }}>
                   KOLOM DI RAK INI
                </div>
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                   {scanResult.columns?.map(col => (
                     <div key={col.id} className="card glass hover-card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => handleScan('COLUMN|'+col.code)}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Kolom {col.number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{col.code}</div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                          {col.levels?.map(lvl => (
                            <div key={lvl.id} style={{ flex: 1, height: 4, borderRadius: 2, background: lvl.isEmpty ? 'var(--border)' : 'var(--primary)' }} title={lvl.isEmpty ? 'Kosong' : 'Isi'} />
                          ))}
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* COLUMN VIEW */}
            {(scanResult.type === "column" || scanResult.type === "section") && (
              <div className="card" style={{ background: "transparent", padding: 0 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, background: "rgba(255,255,255,0.02)" }}>
                   LEVEL DI KOLOM INI
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column-reverse', gap: 12 }}>
                   {scanResult.levels?.map(lvl => (
                     <div key={lvl.id} className="card glass hover-card" style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: lvl.isEmpty ? '4px solid var(--border-light)' : '4px solid var(--primary)' }} onClick={() => handleScan('LEVEL|'+lvl.levelCode)}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>Level {lvl.number}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lvl.levelCode}</div>
                        </div>
                        <div className={`badge ${lvl.isEmpty ? 'badge-ghost' : 'badge-primary'}`}>
                           {lvl.isEmpty ? 'Kosong' : `${lvl.palletCount} Pallet`}
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* LEVEL VIEW (PALLET LIST) */}
            {scanResult.type === "level" && (
              <div
                className="card"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    fontWeight: 600,
                    fontSize: 13,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  DAFTAR PALLET ({scanResult.pallets?.length || 0})
                </div>
                <div style={{ padding: 12 }}>
                  {!scanResult.pallets || scanResult.pallets.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      Kosong
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                    {scanResult.pallets.map((p) => (
                      <div
                        key={p.id}
                        className="card hover-card glass"
                        style={{
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer"
                        }}
                        onClick={() => handleScan('LOC:PAL:'+p.id)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {p.name || p.code}
                          </div>
                          <div
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                          >
                            {p.code} • {p.boxCount || 0} Box
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTION CENTER */}
            <div
              className="card"
              style={{
                background: "var(--primary-glow)",
                border: "1px solid var(--primary)",
                padding: 24,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <h3 style={{ margin: "0 0 8px 0", color: "var(--primary)" }}>
                Aksi Lokasi
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 20,
                }}
              >
                Kelola seluruh isi di {scanResult.type === 'column' || scanResult.type === 'section' ? 'kolom' : scanResult.type} ini.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <button
                  className="btn btn-warning w-full"
                  onClick={() => navigate(`/move-stock?sourceCode=${scanResult.code}&sourceType=${(scanResult.type === 'section' ? 'column' : scanResult.type).toUpperCase()}`)}
                >
                  <ArrowRightLeft size={16} /> Bulk Relokasi (Pindah)
                </button>
                {scanResult.type === "level" && (
                  <button
                    className="btn btn-primary w-full"
                    onClick={() => setShowAddPallet(true)}
                  >
                    <Plus size={16} /> Tambah Pallet di Sini
                  </button>
                )}
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => window.print()}
                >
                  <QrCode size={16} /> Print Laporan Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── BOX RESULT ───── */}
      {scanResult?.type === "box" && (
        <div className="animate-up">
          <div
            className="card"
            style={{ background: "var(--bg-surface)", marginBottom: 20 }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  padding: 12,
                  background: "var(--primary-glow)",
                  color: "var(--primary)",
                  borderRadius: 12,
                }}
              >
                <Box size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{scanResult.name}</h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {scanResult.location?.fullPath}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {scanResult.products?.map((bi) => (
              <BoxProductCard
                key={bi.productId}
                bi={bi}
                onEdit={setEditingProduct}
                onQuickUpdate={handleQuickUpdate}
              />
            ))}
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: 24,
                cursor: "pointer",
                minHeight: 180,
              }}
              className="hover-card"
              onClick={() =>
                setAddingToBox({ id: scanResult.id, code: scanResult.code })
              }
            >
              <div
                style={{
                  padding: 12,
                  background: "var(--bg-surface)",
                  borderRadius: "50%",
                  color: "var(--text-muted)",
                }}
              >
                <Plus size={24} />
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Tambah Produk ke Box
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Klik untuk part baru
              </div>
            </div>
          </div>
          <BoxHistory key={historyKey} boxId={scanResult.id} />
        </div>
      )}

      {/* ───── PALLET RESULT ───── */}
      {scanResult?.type === "pallet" && (
        <div className="animate-up">
          <div
            className="card"
            style={{ background: "var(--bg-surface)", marginBottom: 20 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    padding: 12,
                    background: "var(--warning-bg)",
                    color: "var(--warning)",
                    borderRadius: 12,
                  }}
                >
                  <Layers size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{scanResult.name}</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Lokasi: {scanResult.location?.fullPath}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setMovingPallet(scanResult)}
              >
                <ArrowRightLeft size={16} /> Relokasi
              </button>
            </div>
          </div>
          {scanResult.products?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Package size={14} /> Total Produk di Pallet ini:
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                {scanResult.products.map((it) => (
                  <div
                    key={it.productId}
                    className="card glass"
                    style={{ padding: 12 }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {it.quantity}{" "}
                      <span style={{ fontSize: 10, fontWeight: 400 }}>
                        {it.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Box size={14} /> Daftar Box di Pallet ini:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {scanResult.boxes?.map((b) => (
              <div
                key={b.id}
                className="card hover-card"
                onClick={() => handleScan(b.code)}
                style={{ padding: 16, cursor: "pointer" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {b.code}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───── PRODUCT RESULT ───── */}
      {scanResult?.type === "product" && (
        <div
          className="scan-result animate-up"
          style={{ maxWidth: 460, margin: "0 auto" }}
        >
          <h2 style={{ margin: 0 }}>{scanResult.name}</h2>
          <div className="badge badge-primary">{scanResult.sku}</div>

          <div style={{ margin: "32px 0", fontSize: 64, fontWeight: 800 }}>
            {scanResult.quantity}
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "var(--text-muted)",
                marginTop: -8,
              }}
            >
              Stok Total (Global)
            </div>
          </div>

          {scanResult.boxes?.length > 0 && (
            <div style={{ marginBottom: 24, textAlign: "left" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Box size={14} /> Tersedia di {scanResult.boxes.length} Box:
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {scanResult.boxes.map((box) => (
                  <div
                    key={box.id}
                    className="card hover-card"
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Box {box.code}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {box.path}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{box.quantity}</div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          setEditingProduct({
                            productId: scanResult.id,
                            name: scanResult.name,
                            sku: scanResult.sku,
                            unit: scanResult.unit,
                            quantity: box.quantity,
                            boxId: box.id,
                            boxCode: box.code,
                          })
                        }
                      >
                        Kelola
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: "var(--bg-surface)",
              padding: 24,
              borderRadius: 20,
              textAlign: "left",
            }}
          >
            <label className="form-label">
              Transaksi Global (Tanpa Lokasi Box)
            </label>
            <input
              type="number"
              className="form-control"
              value={issueQty}
              onChange={(e) => setIssueQty(parseInt(e.target.value) || 1)}
              style={{ marginBottom: 12, fontSize: 20, textAlign: "center" }}
            />
            <button
              className="btn btn-danger w-full btn-lg"
              onClick={handleIssue}
              disabled={issuing}
            >
              <Package size={18} /> Konfirmasi
            </button>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      {editingProduct && (
        <BoxProductEditModal
          bi={editingProduct}
          boxId={editingProduct.boxId || scanResult.id}
          boxCode={editingProduct.boxCode || scanResult.code}
          onClose={() => setEditingProduct(null)}
          onSaved={(id, delta) => {
            if (scanResult.type === "box") {
              setScanResult((p) => ({
                ...p,
                products: p.products.map((bi) =>
                  bi.productId === id
                    ? { ...bi, quantity: bi.quantity + delta }
                    : bi,
                ),
              }));
            } else {
              setScanResult((p) => ({
                ...p,
                quantity: p.quantity + delta,
                boxes: p.boxes.map((b) =>
                  b.id === editingProduct.boxId
                    ? { ...b, quantity: b.quantity + delta }
                    : b,
                ),
              }));
            }
          }}
        />
      )}
      {addingToBox && (
        <AddProductModal
          boxId={addingToBox.id}
          boxCode={addingToBox.code}
          onClose={() => setAddingToBox(null)}
          onAdded={(product, qty) => {
            if (scanResult?.type === "box") {
              const existing = scanResult.products.find(
                (bi) => bi.productId === product.id,
              );
              if (existing) {
                setScanResult((p) => ({
                  ...p,
                  products: p.products.map((bi) =>
                    bi.productId === product.id
                      ? { ...bi, quantity: bi.quantity + qty }
                      : bi,
                  ),
                }));
              } else {
                setScanResult((p) => ({
                  ...p,
                  products: [
                    ...p.products,
                    {
                      productId: product.id,
                      name: product.name,
                      sku: product.sku,
                      unit: product.unit,
                      quantity: qty,
                    },
                  ],
                }));
              }
            }
          }}
        />
      )}
      {movingPallet && (
        <RelocatePalletModal
          pallet={movingPallet}
          onClose={() => setMovingPallet(null)}
          onMoved={onRelocated}
        />
      )}
      {showAddPallet && scanResult?.type === "level" && (
        <CreatePalletModal
          levelId={scanResult.id}
          onClose={() => setShowAddPallet(false)}
          onCreated={() => handleScan(scanResult.code)}
        />
      )}
    </div>
  );
}
