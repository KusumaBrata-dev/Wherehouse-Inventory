import { useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import api from "../services/api";

export default function CreatePalletModal({ levelId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", code: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error("Nama palet wajib diisi");
    const code = form.code || `PAL-${Date.now().toString().slice(-6)}`;
    setLoading(true);
    try {
      await api.post("/locations/pallets", {
        ...form,
        code,
        rackLevelId: levelId,
      });
      toast.success("Palet berhasil dibuat");
      onCreated();
      onClose();
    } catch (err) {
      toast.error("Gagal membuat palet");
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
          <h3 className="modal-title">Tambah Pallet Baru</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nama Palet</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Pallet Sparepart A"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kode / Barcode</label>
            <input
              className="form-control font-mono"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Kosongkan untuk otomatis"
            />
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
              disabled={loading}
            >
              {loading ? <div className="spinner" /> : "Buat Pallet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
