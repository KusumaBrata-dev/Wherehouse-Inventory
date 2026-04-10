import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LogIn, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Username dan password harus diisi');
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb orb1" />
      <div className="login-bg-orb orb2" />

      <div className="login-card animate-up">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-glow)',
          }}>📦</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-white)', marginBottom: 4 }}>
            WhereHouse
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Inventory Management System
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-group">
              <User className="input-group-icon" size={16} />
              <input
                id="username"
                type="text"
                className="form-control"
                placeholder="Masukkan username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-group">
              <Lock className="input-group-icon" size={16} />
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="Masukkan password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button id="login-submit" type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <><div className="spinner" /><span>Memproses...</span></> : <><LogIn size={18} /><span>Masuk</span></>}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Default Login (Development)
          </p>
          {[
            { user: 'admin', pass: 'admin123', role: 'ADMIN' },
            { user: 'ppic',  pass: 'ppic123',  role: 'PPIC' },
            { user: 'gudang',pass: 'staff123',  role: 'STAFF' },
          ].map(a => (
            <button key={a.user}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => { setUsername(a.user); setPassword(a.pass); }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{a.user}</span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>{a.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
