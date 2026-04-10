import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'STAFF', isActive: true, ...user });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.name) return toast.error('Username dan nama wajib diisi');
    if (!user?.id && !form.password) return toast.error('Password wajib diisi untuk user baru');
    setLoading(true);
    try {
      if (user?.id) { await updateUser(user.id, form); toast.success('User diperbarui'); }
      else { await createUser(form); toast.success('User dibuat'); }
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">{user?.id ? 'Edit User' : 'Tambah User'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Username</label>
              <input className="form-control font-mono" value={form.username} onChange={e => set('username', e.target.value)} disabled={!!user?.id} placeholder="admin" />
            </div>
            <div className="form-group">
              <label className="form-label required">Nama Lengkap</label>
              <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Administrator" />
            </div>
            <div className="form-group">
              <label className="form-label">{user?.id ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}</label>
              <input type="password" className="form-control" value={form.password || ''} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="ADMIN">Admin</option>
                <option value="PPIC">PPIC</option>
                <option value="STAFF">Staff Gudang</option>
              </select>
            </div>
            {user?.id && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span className="form-label" style={{ margin: 0 }}>User Aktif</span>
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /> Menyimpan...</> : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ROLE_CONFIG = {
  ADMIN: { label: 'Admin', badge: 'badge-danger' },
  PPIC:  { label: 'PPIC',  badge: 'badge-info' },
  STAFF: { label: 'Staff', badge: 'badge-gray' },
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); }
    catch { toast.error('Gagal memuat users'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus user ini?')) return;
    try { await deleteUser(id); toast.success('User dihapus'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Gagal'); }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1>Manajemen User</h1>
          <p>Kelola akun admin, PPIC, dan staff gudang</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={18} /> Tambah User
        </button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th><th>Dibuat</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
          <tbody>
            {loading ? (
              Array(3).fill(0).map((_, i) => <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>)}</tr>)
            ) : users.map(u => (
              <tr key={u.id}>
                <td className="font-mono" style={{ color: 'var(--primary)' }}>{u.username}</td>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td><span className={`badge ${ROLE_CONFIG[u.role]?.badge}`}>{ROLE_CONFIG[u.role]?.label}</span></td>
                <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-gray'}`}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn-icon" onClick={() => setModal(u)}><Edit2 size={14} /></button>
                    {u.id !== currentUser.id && (
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && <UserModal user={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
