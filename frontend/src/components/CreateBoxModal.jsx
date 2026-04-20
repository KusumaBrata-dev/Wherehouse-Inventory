import { useState } from "react";
import toast from "react-hot-toast";
import { X, Minus, Plus } from "lucide-react";
import api, { createTransaction } from "../services/api";

export default function CreateBoxModal({ palletId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error("Nama box wajib diisi");
    if (qty < 1) return toast.error("Quantity harus lebih dari 0");

    setLoading(true);
    try {
      // 1. Resolve or Create the Physical Product automatically based on Box Name
      let targetProductId;
      const cleanProductName = form.name.replace(/^Box\s+/i, "").trim() || form.name;
      
      const matchReq = await api.get(`/products?search=${encodeURIComponent(cleanProductName)}`);
      const match = matchReq.data.find(i => i.name.toLowerCase() === cleanProductName.toLowerCase());
      
      if (match) {
        targetProductId = match.id;
      } else {
        const newProduct = await api.post("/products", {
          name: cleanProductName,
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          unit: "pcs"
        });
        targetProductId = newProduct.data.id;
      }

      // 2. Create the Box
      const code = form.code || `BOX-${Date.now().toString().slice(-6)}`;
      const boxRes = await api.post("/locations/boxes", { ...form, code, palletId });
      const newBox = boxRes.data;

      // 3. Add Product Quantity to Box
      await createTransaction({
        productId: targetProductId,
        type: "IN",
        quantity: parseInt(qty),
        boxId: newBox.id,
        note: `Initial stok saat pembuatan Box ${newBox.code}`,
      });

      toast.success(`Box berhasil dibuat dan diisi ${qty} unit`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error("Gagal membuat box atau memproses stok");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal animate-up scroll-styled"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Buat Box & Isi Quantity</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ paddingBottom: 20 }}>
          
          {/* BOX TITLE */}
          <div className="form-group">
            <label className="form-label">Nama Box</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Box LCD TN35"
              autoFocus
              required
            />
          </div>

          {/* BOX CODE */}
          <div className="form-group">
            <label className="form-label">Kode / QR Code (Opsional)</label>
            <input
              className="form-control font-mono"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Kosongkan untuk kode otomatis"
            />
          </div>

          {/* SMALLER QUANTITY INPUT */}
          <div style={{ marginTop: 24, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border)" }}>
             <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, textAlign: "center", fontWeight: 600 }}>JUMLAH QUANTITY</div>
             <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <button type="button" className="btn btn-icon" style={{ width: 40, height: 40, fontSize: 24, background: "var(--danger-bg)", color: "var(--danger)", border: "none" }} onClick={() => setQty(q => Math.max(1, q - 1))}>
                   <Minus size={20} />
                </button>
                <input 
                   type="number" 
                   className="form-control" 
                   value={qty} 
                   onChange={e => setQty(parseInt(e.target.value) || 0)}
                   min={1}
                   style={{ width: 80, height: 50, fontSize: 24, fontWeight: 800, textAlign: "center" }}
                />
                <button type="button" className="btn btn-icon" style={{ width: 40, height: 40, fontSize: 24, background: "var(--success-bg)", color: "var(--success)", border: "none" }} onClick={() => setQty(q => q + 1)}>
                   <Plus size={20} />
                </button>
             </div>
          </div>

          <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={loading || !form.name || qty < 1}
            >
              {loading ? <div className="spinner" /> : "Buat Box & Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
