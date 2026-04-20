import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { LogIn, Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password)
      return toast.error("Username dan password harus diisi");
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Login berhasil!");
      
      // Redirect to the intended page or dashboard
      const from = location.state?.from?.pathname + (location.state?.from?.search || "");
      navigate(from || "/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || "Login gagal");
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
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "linear-gradient(135deg, var(--primary), #6366f1)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 16px",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            📦
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-white)",
              marginBottom: 4,
            }}
          >
            WareHouse
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
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
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <>
                <div className="spinner" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Masuk</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
