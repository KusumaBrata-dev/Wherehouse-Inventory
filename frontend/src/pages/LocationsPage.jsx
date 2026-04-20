import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ChevronRight,
  Box,
  Layers,
  Package,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRightLeft,
  Settings2,
  X,
  QrCode,
  ArrowUp,
  ArrowDown,
  Trash2,
  Users,
  UserPlus,
  PieChart,
} from "lucide-react";
import { createTransaction } from "../services/api";
import RelocatePalletModal from "../components/RelocatePalletModal";
import { useAuth } from "../context/AuthContext";
import QRModal from "../components/QRModal";
import CreatePalletModal from "../components/CreatePalletModal";
import CreateBoxModal from "../components/CreateBoxModal";

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
      {show &&
        createPortal(
          <QRModal
            type={type}
            id={id}
            name={name}
            onClose={() => setShow(false)}
          />,
          document.body
        )}
    </>
  );
}

// ─── Modal: Create Pallet ──────────────────────────────────────────────────

// ─── Modal: Box Product Edit ──────────────────────────────────────────────────
function BoxProductEditModal({ bi, boxId, boxCode, onClose, onSaved }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState("OUT");

  const handleTransaction = async () => {
    const parsedQty = parseInt(qty) || 1;
    if (parsedQty < 1) return toast.error("Qty harus lebih dari 0");
    if (actionType === "OUT" && parsedQty > bi.quantity) {
      return toast.error(
        `Stok tidak cukup. Tersedia: ${bi.quantity} ${bi.product?.unit || bi.unit}`,
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
        `Berhasil ${actionType === "IN" ? "menambah" : "mengurangi"} ${parsedQty} ${bi.product?.unit || bi.unit}`,
      );
      onSaved();
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
                Ambil / Tambah Produk
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
            {bi.product?.name || bi.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            {bi.product?.sku || bi.sku}
          </div>
          <div
            className="badge badge-primary"
            style={{ fontSize: 14, padding: "6px 16px" }}
          >
            Stok di Box: {bi.quantity} {bi.product?.unit || bi.unit}
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
            {loading ? <div className="spinner" /> : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Create Personal Box ───────────────────────────────────────────
function CreatePersonalBoxModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", code: "", holderId: "" });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/users/list").then(res => setUsers(res.data)).catch(() => toast.error("Gagal memuat list staf"));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.holderId) return toast.error("Semua field wajib diisi");
    
    setLoading(true);
    try {
      await api.post("/locations/boxes/personal", form);
      toast.success("Aset personel berhasil didaftarkan");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Daftarkan Aset Personel</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Pemegang Aset (Staf)</label>
            <select className="form-control" value={form.holderId} onChange={e => setForm({...form, holderId: e.target.value})} required>
              <option value="">Pilih Personel...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kode Aset / QR</label>
            <input className="form-control" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Contoh: LAPTOP-01 / KIT-01" required />
          </div>
          <div className="form-group">
            <label className="form-label">Deskripsi (Opsional)</label>
            <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Contoh: Peralatan Teknisi A" />
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>Daftarkan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Add Product to Box ───────────────────────────────────────────────
function AddProductModal({ boxId, boxCode, initialProduct, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(initialProduct || null);
  const [qty, setQty] = useState(1);

  const search = async () => {
    if (query.length < 2) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/products?search=${query}`);
      setResults(data);
    } catch {
      toast.error("Gagal mencari produk");
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
      onAdded();
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
             {/* NUMERICAL FOCUS: BIG QTY SELECTOR */}
             <div style={{ textAlign: 'center', marginBottom: 24, padding: '20px 0', background: 'rgba(255,255,255,0.03)', borderRadius: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>MASUKKAN JUMLAH QUANTITY</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                   <button className="btn btn-icon" style={{ width: 60, height: 60, fontSize: 32 }} onClick={() => setQty(q => Math.max(1, q - 1))}>-</button>
                   <input 
                      type="number" 
                      className="form-control" 
                      value={qty} 
                      onChange={e => setQty(parseInt(e.target.value) || 0)}
                      style={{ width: 120, height: 80, fontSize: 48, fontWeight: 900, textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--primary)' }}
                   />
                   <button className="btn btn-icon" style={{ width: 60, height: 60, fontSize: 32 }} onClick={() => setQty(q => q + 1)}>+</button>
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--text-muted)' }}>{selectedProduct.unit?.toUpperCase()}</div>
             </div>

             <div className="card" style={{ background: 'var(--bg-card)', marginBottom: 24 }}>
                <div style={{ fontWeight: 700 }}>{selectedProduct.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedProduct.sku}</div>
                <button className="btn btn-link btn-sm" style={{ marginTop: 8, padding: 0 }} onClick={() => setSelectedProduct(null)}>Ganti Produk</button>
             </div>

             <div className="modal-footer" style={{ padding: 0 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Batal</button>
                <button 
                  type="button"
                  className="btn btn-primary" 
                  style={{ flex: 2 }} 
                  onClick={handleAdd} 
                  disabled={loading || qty < 1}
                >
                   {loading ? <div className="spinner" /> : `Simpan ${qty} Quantity`}
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Create Rack ──────────────────────────────────────────────────
function CreateRackModal({ floorId, onClose, onCreated }) {
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!letter) return toast.error("Label Rak (Huruf) wajib diisi");
    setLoading(true);
    try {
      await api.post("/locations/racks", { letter: letter.toUpperCase(), floorId });
      toast.success("Baris Rak berhasil ditambahkan");
      onCreated();
      onClose();
    } catch {
      toast.error("Gagal menambah rak");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Tambah Baris Rak Baru</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Label Rak (Contoh: A, B, C)</label>
            <input
              className="form-control"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="Masukkan satu huruf"
              maxLength={2}
              autoFocus
            />
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? <div className="spinner" /> : "Tambah Rak"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Section (Column) ──────────────────────────────────────
function CreateSectionModal({ rackId, onClose, onCreated }) {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!number) return toast.error("Nomor kolom wajib diisi");
    setLoading(true);
    try {
      await api.post("/locations/sections", { number, rackId });
      toast.success("Kolom Grid berhasil ditambahkan");
      onCreated();
      onClose();
    } catch {
      toast.error("Gagal menambah kolom");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Tambah Kolom Baru</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nomor Kolom (Contoh: 1, 2, 3)</label>
            <input
              className="form-control"
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Masukkan angka"
              autoFocus
            />
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? <div className="spinner" /> : "Tambah Kolom"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Level ────────────────────────────────────────────────
function CreateLevelModal({ sectionId, onClose, onCreated }) {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!number) return toast.error("Nomor level wajib diisi");
    setLoading(true);
    try {
      await api.post("/locations/levels", { number, sectionId });
      toast.success("Level Rak berhasil ditambahkan");
      onCreated();
      onClose();
    } catch {
      toast.error("Gagal menambah level");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Tambah Level Baru</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nomor Level (Contoh: 1, 2, 3)</label>
            <input
              className="form-control"
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Masukkan angka"
              autoFocus
            />
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? <div className="spinner" /> : "Tambah Level"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Locations Page ────────────────────────────────────────────────────────
export default function LocationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { floorId } = useParams();
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = user?.role === "ADMIN" || user?.role === "PPIC";

  const [floor, setFloor] = useState(null);
  const [personalData, setPersonalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPersonal, setShowAddPersonal] = useState(false);

  // Derive selection IDs from URL
  const selRackId = searchParams.get("rackId");
  const selSectionId = searchParams.get("sectionId");
  const selLevelId = searchParams.get("levelId");
  const selPalletId = searchParams.get("palletId");
  const selBoxId = searchParams.get("boxId");

  // Derive selection objects from floor data
  const selRack = useMemo(() => {
    if (!floor || !selRackId) return null;
    return floor.racks.find((r) => r.id === parseInt(selRackId)) || null;
  }, [floor, selRackId]);

  const selSection = useMemo(() => {
    if (!selRack || !selSectionId) return null;
    return selRack.sections.find((s) => s.id === parseInt(selSectionId)) || null;
  }, [selRack, selSectionId]);

  const selLevel = useMemo(() => {
    if (!selSection || !selLevelId) return null;
    return selSection.levels.find((l) => l.id === parseInt(selLevelId)) || null;
  }, [selSection, selLevelId]);

  const selPallet = useMemo(() => {
    if (!selLevel || !selPalletId) return null;
    return selLevel.pallets.find((p) => p.id === parseInt(selPalletId)) || null;
  }, [selLevel, selPalletId]);

  const selBox = useMemo(() => {
    if (!selPallet || !selBoxId) return null;
    return selPallet.boxes.find((b) => b.id === parseInt(selBoxId)) || null;
  }, [selPallet, selBoxId]);

  const [showAddRack, setShowAddRack] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [showAddPallet, setShowAddPallet] = useState(false);
  const [showAddBox, setShowAddBox] = useState(false);
  const [relocatingPallet, setRelocatingPallet] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [addingToBox, setAddingToBox] = useState(null);

  // ─── ADMIN MOVE MODE STATES ───
  const [moveModeActive, setMoveModeActive] = useState(false);
  const [selectedMovePallet, setSelectedMovePallet] = useState(null);
  const isAdmin = user?.role === "ADMIN";

  const handleDeletePallet = async (p) => {
    if (
      !window.confirm(
        `Hapus Pallet "${p.name}"? PERINGATAN: Seluruh box dan stok di dalam pallet ini akan ikut terhapus secara permanen.`,
      )
    )
      return;
    try {
      await api.delete(`/locations/pallets/${p.id}`);
      toast.success("Pallet berhasil dihapus");
      fetchFloorData();
      resetTo("level");
    } catch {
      toast.error("Gagal menghapus pallet");
    }
  };

  const handleDeleteBox = async (b) => {
    if (
      !window.confirm(
        `Hapus Box "${b.name}"? Seluruh histori stok di box ini akan dilepas.`,
      )
    )
      return;
    try {
      await api.delete(`/locations/boxes/${b.id}`);
      toast.success("Box berhasil dihapus");
      fetchFloorData();
      resetTo("pallet");
    } catch {
      toast.error("Gagal menghapus box");
    }
  };

  const handleDeleteRack = async (r) => {
    if (!window.confirm(`Hapus seluruh baris Rak "${r.letter}"? Ini akan menghapus semua level, palet, dan box di dalamnya secara permanen!`)) return;
    try {
      await api.delete(`/locations/racks/${r.id}`);
      toast.success("Rak berhasil dihapus");
      fetchFloorData();
    } catch { toast.error("Gagal menghapus rak"); }
  };

  const handleDeleteSection = async (s) => {
    if (!window.confirm(`Hapus Kolom "${selRack.letter}${s.number}"? Ini akan menghapus semua level dan isi di kolom ini!`)) return;
    try {
      await api.delete(`/locations/sections/${s.id}`);
      toast.success("Kolom berhasil dihapus");
      fetchFloorData();
    } catch { toast.error("Gagal menghapus kolom"); }
  };

  const handleDeleteLevel = async (l) => {
    if (!window.confirm(`Hapus Level ${l.number} dari kolom ini? Seluruh isi di level ini akan ikut terhapus!`)) return;
    try {
      await api.delete(`/locations/levels/${l.id}`);
      toast.success("Level berhasil dihapus");
      fetchFloorData();
    } catch { toast.error("Gagal menghapus level"); }
  };

  const fetchFloorData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await api.get(`/locations?floorId=${floorId}`);
      if (res.data.length > 0) {
        const data = res.data[0];
        setFloor(data);

        // Auto-expand if state passed from Search or Scan
        if (isInitial && routeLocation.state?.targetRack) {
          const s = routeLocation.state;
          const params = new URLSearchParams();
          if (s.targetRack) params.set("rackId", s.targetRack.id);
          if (s.targetSection) params.set("sectionId", s.targetSection.id);
          if (s.targetLevel) params.set("levelId", s.targetLevel.id);
          
          if (s.targetCode) {
            // Find IDs for pallet/box codes
            const rack = data.racks.find(r => r.id === s.targetRack.id);
            const section = rack?.sections.find(sec => sec.id === s.targetSection.id);
            const level = section?.levels.find(l => l.id === s.targetLevel.id);
            
            if (level) {
              if (s.targetType === "pallet") {
                const p = level.pallets.find(p => p.code === s.targetCode);
                if (p) params.set("palletId", p.id);
              } else if (s.targetType === "box") {
                const p = level.pallets.find(p => p.boxes.some(b => b.code === s.targetCode));
                if (p) {
                   params.set("palletId", p.id);
                   const b = p.boxes.find(bx => bx.code === s.targetCode);
                   if (b) params.set("boxId", b.id);
                }
              }
            }
          }
          setSearchParams(params);
        }
      }
    } catch (err) {
      toast.error("Gagal memuat data lokasi");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [floorId, routeLocation.state, setSearchParams]);

  useEffect(() => {
    if (floorId === "personal") {
      setLoading(true);
      api.get("/locations/personal")
        .then(res => setPersonalData(res.data))
        .catch(() => toast.error("Gagal memuat data personel"))
        .finally(() => setLoading(false));
    } else {
      fetchFloorData(true);
    }
  }, [floorId]);

  const view = useMemo(() => {
    if (selBoxId) return "box";
    if (selPalletId) return "pallet";
    if (selLevelId) return "level";
    if (selSectionId) return "section";
    if (selRackId) return "rack";
    return "floor";
  }, [selRackId, selSectionId, selLevelId, selPalletId, selBoxId]);

  const resetTo = (v) => {
    if (v === "dashboard") {
      navigate("/dashboard");
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (v === "floor") {
      params.delete("rackId");
      params.delete("sectionId");
      params.delete("levelId");
      params.delete("palletId");
      params.delete("boxId");
    }
    if (v === "rack") {
      params.delete("sectionId");
      params.delete("levelId");
      params.delete("palletId");
      params.delete("boxId");
    }
    if (v === "section") {
      params.delete("levelId");
      params.delete("palletId");
      params.delete("boxId");
    }
    if (v === "level") {
      params.delete("levelId");
      params.delete("palletId");
      params.delete("boxId");
    }
    if (v === "pallet") {
      params.delete("palletId");
      params.delete("boxId");
    }
    setSearchParams(params);
  };

  const getParentView = () => {
    if (selBoxId) return "pallet";
    if (selPalletId) return "level";
    if (selLevelId) return "section";
    if (selSectionId) return "rack";
    if (selRackId) return "floor";
    return "dashboard";
  };

  const handleQuickTx = async (bi, type, qty) => {
    try {
      await createTransaction({
        productId: bi.productId,
        type,
        quantity: qty,
        boxId: selBox.id,
        note: `Quick ${type} via Locations View`
      });
      fetchFloorData();
      toast.success(`${type === 'IN' ? 'Ditambah' : 'Dikurangi'} ${qty} ${bi.product.unit}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal");
    }
  };

  if (loading)
    return (
      <div
        className="page-container"
        style={{ display: "flex", justifyContent: "center", padding: 100 }}
      >
        <div className="spinner dark" />
      </div>
    );

  if (floorId === "personal") {
    return (
      <div className="page-container animate-fade">
        <div className="page-header" style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Users size={32} color="var(--primary)" /> Penggunaan Aset Operasional
            </h1>
            <p>Daftar produk yang sedang digunakan oleh personel / staf</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddPersonal(true)}>
            <UserPlus size={18} /> Daftarkan Aset Baru
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 24 }}>
          {personalData.map(box => (
            <div key={box.id} className="card animate-up" style={{ padding: 24, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {box.holder?.name?.[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{box.holder?.name}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{box.holder?.role}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div className="badge badge-primary" style={{ marginBottom: 4 }}>{box.code}</div>
                   <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{box.name || 'Personal KIT'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16 }}>
                 <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Daftar Produk Dibawa:</div>
                 {box.products?.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                     {box.products.map(bi => (
                       <div key={bi.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                         <span>{bi.product.name}</span>
                         <span style={{ fontWeight: 700 }}>{bi.quantity} {bi.product.unit}</span>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Tidak ada produk terdaftar</div>
                 )}
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setSearchParams({ boxId: box.id })}>
                  Detail & Kelola
                </button>
                <QRButton type="box" id={box.id} name={box.code} size={18} />
              </div>
            </div>
          ))}
        </div>

        {showAddPersonal && <CreatePersonalBoxModal onClose={() => setShowAddPersonal(false)} onCreated={() => api.get("/locations/personal").then(res => setPersonalData(res.data))} />}
        
        {/* Reuse existing Product/Edit Modals if a personal box is selected */}
        {selBoxId && selBox && (
          <div className="modal-overlay" onClick={() => resetTo('personal')}>
             <div className="modal animate-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
                <div className="modal-header">
                   <div>
                      <h3 className="modal-title">Kelola Produk: {selBox.holder?.name}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Kode Aset: {selBox.code}</p>
                   </div>
                   <button className="btn-icon" onClick={() => resetTo('personal')}><X size={18} /></button>
                </div>
                
                <div style={{ padding: '20px 0' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                      {selBox.products?.map(bi => (
                        <div key={bi.id} className="card" style={{ padding: 16 }}>
                           <div style={{ fontWeight: 700, marginBottom: 4 }}>{bi.product.name}</div>
                           <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{bi.product.sku}</div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>{bi.quantity} {bi.product.unit}</span>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingProduct(bi)}><Settings2 size={14} /></button>
                           </div>
                        </div>
                      ))}
                      <div 
                        className="card" 
                        style={{ border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: 100 }}
                        onClick={() => setAddingToBox(selBox)}
                      >
                         <Plus size={24} />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {editingProduct && (
          <BoxProductEditModal
            bi={editingProduct}
            boxId={selBox.id}
            boxCode={selBox.code}
            onClose={() => setEditingProduct(null)}
            onSaved={() => api.get("/locations/personal").then(res => setPersonalData(res.data))}
          />
        )}
        {addingToBox && (
          <AddProductModal
            boxId={addingToBox.id}
            boxCode={addingToBox.code}
            initialProduct={null}
            onClose={() => setAddingToBox(null)}
            onAdded={() => api.get("/locations/personal").then(res => setPersonalData(res.data))}
          />
        )}
      </div>
    );
  }

  if (!floor)
    return <div className="page-container">Lantai tidak ditemukan</div>;

  return (
    <div className="page-container animate-fade">
      {/* ── Header & Breadcrumbs ── */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => resetTo(getParentView())}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              width: 44,
              height: 44,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              <span
                style={{ cursor: "pointer" }}
                onClick={() => resetTo("floor")}
              >
                {floor.name}
              </span>
              {selRack && (
                <>
                  <ChevronRight size={12} />{" "}
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => resetTo("rack")}
                  >
                    Rak {selRack.letter}
                  </span>
                </>
              )}
              {selSection && (
                <>
                  <ChevronRight size={12} />{" "}
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => resetTo("section")}
                  >
                    Baris {selRack.letter}
                    {selSection.number}
                  </span>
                </>
              )}
              {selLevel && (
                <>
                  <ChevronRight size={12} />{" "}
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => resetTo("level")}
                  >
                    Level {selLevel.number}
                  </span>
                </>
              )}
              {selPallet && (
                <>
                  <ChevronRight size={12} />{" "}
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => resetTo("pallet")}
                  >
                    {selPallet.name}
                  </span>
                </>
              )}
              {selBox && (
                <>
                  <ChevronRight size={12} /> <span>{selBox.name}</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontSize: 28 }}>
                {view === "floor"
                  ? floor.name
                  : view === "rack"
                    ? `Rak ${selRack.letter}`
                    : view === "section"
                      ? `Grid ${selRack.letter}${selSection.number}`
                      : view === "level"
                        ? `Level ${selLevel.number}`
                        : view === "pallet"
                          ? selPallet.name
                          : selBox.name}
              </h1>
              <QRButton
                type={view}
                id={
                  view === "floor"
                    ? floor.id
                    : view === "rack"
                      ? selRack.id
                      : view === "section"
                        ? selSection.id
                        : view === "level"
                          ? selLevel.id
                          : view === "pallet"
                            ? selPallet.id
                            : selBox.id
                }
                name={
                  view === "floor"
                    ? floor.name
                    : view === "rack"
                      ? `Rak-${selRack.letter}`
                      : view === "section"
                        ? `Grid-${selRack.letter}${selSection.number}`
                        : view === "level"
                          ? `L${selLevel.number}`
                          : selPallet?.name || selBox?.name || "Loc"
                }
                size={22}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {view === "level" && isAdmin && (
            <button
              className={`btn ${moveModeActive ? "btn-danger" : "btn-ghost"}`}
              onClick={() => {
                setMoveModeActive(!moveModeActive);
                setSelectedMovePallet(null);
                if (!moveModeActive) toast("Mode Pindah Aktif: Pilih Palet lalu pilih Level tujuan", { icon: "📦" });
              }}
              style={{ fontWeight: 700 }}
            >
              <ArrowRightLeft size={18} /> {moveModeActive ? "Batalkan Pindah" : "Mode Pindah"}
            </button>
          )}
          {canDelete && (
            <>
              {view === "floor" && <button className="btn btn-primary" onClick={() => setShowAddRack(true)}><Plus size={18} /> Tambah Rak</button>}
              {view === "rack" && <button className="btn btn-primary" onClick={() => setShowAddSection(true)}><Plus size={18} /> Tambah Kolom</button>}
              {view === "section" && <button className="btn btn-primary" onClick={() => setShowAddLevel(true)}><Plus size={18} /> Tambah Level</button>}
            </>
          )}
          {view === "level" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddPallet(true)}
            >
              <Plus size={18} /> Tambah Pallet
            </button>
          )}
          {view === "pallet" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddBox(true)}
            >
              <Plus size={18} /> Tambah Box
            </button>
          )}
        </div>
      </div>

      {/* ── STEP 1: Racks (Rows) ── */}
      {view === "floor" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {floor.racks.map((r) => (
            <div
              key={r.id}
              className="card hover-card animate-up"
              style={{
                textAlign: "center",
                padding: 40,
                background: "var(--bg-surface)",
                borderBottom: "4px solid var(--primary)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
              onClick={() => setSearchParams({ rackId: r.id })}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--primary-glow)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                  fontWeight: 900,
                  marginBottom: 16,
                }}
              >
                {r.letter}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  color: "var(--text-white)",
                }}
              >
                Rak {r.letter}
              </div>
              {/* Occupancy Logic */}
              {(() => {
                const totalLevels = r.sections?.reduce((acc, s) => acc + (s.levels?.length || 0), 0) || 0;
                const usedLevels = r.sections?.reduce((acc, s) => acc + (s.levels?.filter(l => l.pallets?.length > 0).length || 0), 0) || 0;
                const occPercent = totalLevels > 0 ? Math.round((usedLevels / totalLevels) * 100) : 0;
                const color = occPercent > 90 ? "var(--danger)" : occPercent > 70 ? "var(--warning)" : "var(--success)";
                
                return (
                  <div style={{ marginTop: 12, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><PieChart size={10} /> Okupansi</span>
                      <span style={{ fontWeight: 700, color }}>{occPercent}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${occPercent}%`, background: color, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, opacity: 0.6 }}>
                      {usedLevels} / {totalLevels} Level Terisi
                    </div>
                  </div>
                );
              })()}
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                {r.sections.length} Baris
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <QRButton type="rack" id={r.id} name={`Rak-${r.letter}`} size={20} />
                {canDelete && (
                  <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => { e.stopPropagation(); handleDeleteRack(r); }} title="Hapus Rak"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 2: Sections (Grid Pillars) ── */}
      {view === "rack" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 16,
          }}
        >
          {selRack.sections.map((s) => (
            <div
              key={s.id}
              className="card hover-card animate-up"
              style={{
                textAlign: "center",
                padding: 24,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setSearchParams({ rackId: selRackId, sectionId: s.id })}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "var(--text-white)",
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.05)",
                  padding: "12px 0",
                  borderRadius: 12,
                }}
              >
                {selRack.letter}
                {s.number}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Baris {s.number}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                <QRButton type="section" id={s.id} name={`Baris-${selRack.letter}${s.number}`} size={18} />
                {canDelete && (
                  <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => { e.stopPropagation(); handleDeleteSection(s); }} title="Hapus Baris"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 3: Levels (Vertical Rack Structure) ── */}
      {view === "section" && (
        <div
          className="vertical-rack-container"
          style={{
            maxWidth: "100%",
            width: 500,
            margin: "0",
            background: "rgba(255,255,255,0.03)",
            padding: "24px 16px",
            borderRadius: 24,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ textAlign: "left", marginBottom: 20 }}>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Struktur Rak Vertikal
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column-reverse",
              gap: 20,
            }}
          >
            {selSection.levels.map((l, idx) => (
              <div
                key={l.id}
                className="card hover-card animate-up"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "24px",
                  background: moveModeActive && selectedMovePallet?.rackLevelId === l.id ? "var(--primary-glow)" : (moveModeActive && selectedMovePallet && selectedMovePallet.rackLevelId !== l.id ? "rgba(255,200,0,0.05)" : "var(--bg-surface)"),
                  borderLeft: moveModeActive && selectedMovePallet?.rackLevelId === l.id ? "12px solid var(--primary)" : (moveModeActive && selectedMovePallet ? "6px dashed var(--warning)" : "6px solid var(--primary)"),
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  flexWrap: "wrap",
                  gap: 16,
                  minHeight: 110,
                  width: "100%",
                  transition: "all 0.2s ease",
                  transform: moveModeActive && selectedMovePallet?.rackLevelId === l.id ? "scale(1.02)" : "scale(1)"
                }}
                onClick={async () => {
                   if (moveModeActive) {
                      if (!selectedMovePallet) {
                         const p = l.pallets[0];
                         if (!p) return toast("Pilih level yang ada paletnya", { icon: "❗" });
                         setSelectedMovePallet(p);
                         toast(`Palet "${p.name}" dipilih. Klik Level tujuan.`, { icon: "🎯" });
                      } else {
                         if (selectedMovePallet.rackLevelId === l.id) {
                            setSelectedMovePallet(null);
                            return toast("Pilihan dibatalkan");
                         }
                         try {
                            const loadingToast = toast.loading("Memindahkan palet...");
                            await api.patch(`/locations/pallets/${selectedMovePallet.id}/move`, { newLevelId: l.id });
                            toast.dismiss(loadingToast);
                            toast.success(`Palet "${selectedMovePallet.name}" berhasil dipindah ke Level ${l.number}`);
                            setSelectedMovePallet(null);
                            setMoveModeActive(false);
                            fetchFloorData();
                         } catch (err) {
                            toast.error("Gagal memindahkan palet");
                         }
                      }
                   } else {
                      setSearchParams({ rackId: selRackId, sectionId: selSectionId, levelId: l.id });
                   }
                }}
              >
                {/* Visual Shelf Line */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: "rgba(255,255,255,0.05)",
                  }}
                />

                {/* Left side: Number & Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 24, flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      background: "var(--primary-glow)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 900,
                      flexShrink: 0
                    }}
                  >
                    {l.number}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--text-white)",
                      }}
                    >
                      Level {l.number}
                    </div>
                    {l.pallets && l.pallets.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        {l.pallets.map((p) => (
                          <div
                            key={p.id}
                            className="badge badge-primary"
                            style={{ fontSize: 11, padding: "4px 10px" }}
                          >
                            <Package size={12} style={{ marginRight: 6 }} />
                            {p.name || p.code}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 8,
                          fontStyle: "italic",
                        }}
                      >
                        (Kosong)
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Summary & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  <div
                    className="badge badge-gray"
                    style={{ height: 32, padding: "0 12px" }}
                  >
                    {l.pallets?.reduce((acc, p) => acc + (p.boxes?.length || 0), 0) || 0} Box
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <QRButton
                      type="level"
                      id={l.id}
                      name={`Level-${l.number}`}
                      size={20}
                    />
                    {canDelete && (
                      <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => { e.stopPropagation(); handleDeleteLevel(l); }} title="Hapus Level"><Trash2 size={16} /></button>
                    )}
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>

          {/* Rack Base Illustration */}
          <div
            style={{
              height: 12,
              background: "var(--border)",
              marginTop: 20,
              borderRadius: 10,
              opacity: 0.5,
            }}
          />
        </div>
      )}

      {/* ── STEP 4: Pallets List ── */}
      {view === "level" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {selLevel.pallets.length === 0 ? (
            <div
              className="card empty-state"
              style={{
                gridColumn: "1/-1",
                padding: 80,
                border: "2px dashed var(--border)",
              }}
            >
              <Layers size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>Belum ada palet di level ini.</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddPallet(true)}
                style={{ marginTop: 12 }}
              >
                + Daftarkan Pallet
              </button>
            </div>
          ) : (
            selLevel.pallets.map((p) => (
              <div
                key={p.id}
                className="card hover-card animate-up"
                style={{
                  padding: 24,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
                onClick={() => setSearchParams({ rackId: selRackId, sectionId: selSectionId, levelId: selLevelId, palletId: p.id })}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 16, alignItems: "center" }}
                  >
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
                    <QRButton type="pallet" id={p.id} name={p.code} size={20} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRelocatingPallet(p);
                      }}
                      title="Relokasi"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-icon text-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePallet(p);
                        }}
                        title="Hapus Pallet"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 20,
                    marginBottom: 4,
                    color: "var(--text-white)",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                    marginBottom: 16,
                  }}
                >
                  ID: {p.code}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span className="badge badge-gray">
                    {p.boxes.length} Box Terpasang
                  </span>
                  <ChevronRight size={18} color="var(--primary)" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── STEP 5: Boxes Grid ── */}
      {view === "pallet" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          {selPallet.boxes.length === 0 ? (
            <div
              className="card empty-state"
              style={{
                gridColumn: "1/-1",
                padding: 80,
                border: "2px dashed var(--border)",
                textAlign: "center"
              }}
            >
              <Box size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p style={{ color: "var(--text-muted)" }}>Palet ini belum memiliki box.</p>
            </div>
          ) : (
            selPallet.boxes.map((b) => (
              <div
                key={b.id}
                className="card hover-card animate-up"
                style={{
                  padding: 24,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
                onClick={() => setSearchParams({ rackId: selRackId, sectionId: selSectionId, levelId: selLevelId, palletId: selPalletId, boxId: b.id })}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      background: "var(--info-bg)",
                      color: "var(--info)",
                      borderRadius: 12,
                    }}
                  >
                    <Box size={24} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <QRButton type="box" id={b.id} name={b.code} size={20} />
                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-icon text-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBox(b);
                        }}
                        title="Hapus Box"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      color: "var(--text-white)",
                    }}
                  >
                    {b.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    BOX ID: {b.code}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "auto",
                  }}
                >
                  <span className="badge badge-primary">
                    {b.products.length} Produk
                  </span>
                  <ChevronRight size={18} color="var(--primary)" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── STEP 6: Products View ── */}
      {view === "box" && (
        <div className="animate-up">
          <div
            className="card glass"
            style={{
              padding: 24,
              marginBottom: 24,
              display: "flex",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div
              style={{
                padding: 16,
                background: "var(--primary-glow)",
                color: "var(--primary)",
                borderRadius: 16,
              }}
            >
              <Box size={32} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0 }}>{selBox.name}</h2>
              <p
                style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}
              >
                {floor.name} &gt; Rak {selRack.letter}
                {selSection.number} &gt; Level {selLevel.number} &gt;{" "}
                {selPallet.name}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <QRButton
                type="box"
                id={selBox.id}
                name={selBox.code}
                size={24}
              />
              {canDelete && (
                <button
                  className="btn btn-ghost btn-icon text-danger"
                  onClick={() => handleDeleteBox(selBox)}
                  title="Hapus Box Ini"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
          {selBox.products.length === 0 ? (
            <div
              style={{
                gridColumn: "1/-1",
                padding: 60,
                textAlign: "center",
                opacity: 0.5,
              }}
            >
              <Package size={48} style={{ margin: "0 auto 16px" }} />
              <p>Box ini tidak berisi produk.</p>
            </div>
          ) : (
            selBox.products.map((bi) => (
              <div
                key={bi.productId}
                className="card glass"
                style={{ padding: 20, borderTop: '4px solid var(--primary)' }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {bi.product.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {bi.product.sku}
                    </div>
                  </div>
                  <QRButton
                    type="product"
                    id={bi.product.id}
                    name={bi.product.sku}
                    size={20}
                  />
                </div>
                
                {/* QUICK QUANTITY ADJUSTMENT */}
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '12px', 
                  borderRadius: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 16 
                }}>
                  <button 
                    className="btn btn-icon btn-sm text-danger" 
                    onClick={() => handleQuickTx(bi, 'OUT', 1)}
                    style={{ background: 'var(--danger-bg)', border: 'none' }}
                  >
                    <Minus size={18} />
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{bi.quantity}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{bi.product.unit}</div>
                  </div>
                  <button 
                    className="btn btn-icon btn-sm text-success" 
                    onClick={() => handleQuickTx(bi, 'IN', 1)}
                    style={{ background: 'var(--success-bg)', border: 'none' }}
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm w-full"
                    onClick={() => setEditingProduct(bi)}
                  >
                    <Settings2 size={14} /> Edit Angka
                  </button>
                </div>
              </div>
            ))
          )}

          {/* DASHED ADD BUTTON */}
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
              minHeight: 180
            }}
            className="hover-card"
            onClick={() => setAddingToBox(selBox)}
          >
            <div style={{ padding: 12, background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%' }}>
              <Plus size={24} />
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-white)",
                fontWeight: 600,
              }}
            >
              Tambah Angka / Isi Box
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Klik untuk tambah produk baru</div>
          </div>
        </div>
      </div>
      )}

      {/* ── Modals ── */}
      {showAddRack && <CreateRackModal floorId={floor.id} onClose={() => setShowAddRack(false)} onCreated={fetchFloorData} />}
      {showAddSection && <CreateSectionModal rackId={selRack.id} onClose={() => setShowAddSection(false)} onCreated={fetchFloorData} />}
      {showAddLevel && <CreateLevelModal sectionId={selSection.id} onClose={() => setShowAddLevel(false)} onCreated={fetchFloorData} />}
      {showAddPallet && (
        <CreatePalletModal
          levelId={selLevel.id}
          onClose={() => setShowAddPallet(false)}
          onCreated={fetchFloorData}
        />
      )}
      {showAddBox && (
        <CreateBoxModal
          palletId={selPallet.id}
          onClose={() => setShowAddBox(false)}
          onCreated={fetchFloorData}
        />
      )}
      {relocatingPallet && (
        <RelocatePalletModal
          pallet={relocatingPallet}
          onClose={() => setRelocatingPallet(null)}
          onMoved={fetchFloorData}
        />
      )}
      {editingProduct && (
        <BoxProductEditModal
          bi={editingProduct}
          boxId={selBox.id}
          boxCode={selBox.code}
          onClose={() => setEditingProduct(null)}
          onSaved={fetchFloorData}
        />
      )}
      {addingToBox && (
        <AddProductModal
          boxId={addingToBox.id}
          boxCode={addingToBox.code}
          initialProduct={null}
          onClose={() => setAddingToBox(null)}
          onAdded={fetchFloorData}
        />
      )}
    </div>
  );
}
