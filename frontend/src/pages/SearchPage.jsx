import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Search, MapPin, Package, Box as BoxIcon, Layers, ChevronRight, ArrowRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const setQuery = (q) => {
    setSearchParams(prev => {
      if (!q) {
        prev.delete("q");
      } else {
        prev.set("q", q);
      }
      return prev;
    }, { replace: true });
  };

  useEffect(() => {
    if (location.state?.initialQuery) {
      setQuery(location.state.initialQuery);
    }
  }, [location.state]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/locations/search?q=${query}`);
        setResults(data);
      } catch (err) {
        toast.error('Pencarian gagal');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result) => {
    if (result.type === 'user') {
      toast(`Staf: ${result.name}`, { icon: '👤' });
      return;
    }
    
    if (!result.coords) return toast.error("Kordinat lokasi tidak ditemukan");

    const params = new URLSearchParams();
    if (result.coords.rackId) params.set("rackId", result.coords.rackId);
    if (result.coords.sectionId) params.set("sectionId", result.coords.sectionId);
    if (result.coords.levelId) params.set("levelId", result.coords.levelId);
    if (result.coords.palletId) params.set("palletId", result.coords.palletId);
    if (result.coords.boxId) params.set("boxId", result.coords.boxId);
    
    navigate(`/locations/${result.floorId}?${params.toString()}`);
  };

  // Grouping results
  const grouped = results.reduce((acc, res) => {
    const type = res.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(res);
    return acc;
  }, {});

  const typeLabels = {
    product: "Produk / Item",
    box: "Box / Aset",
    pallet: "Pallet",
    user: "Personel (Staf)"
  };

  const typeIcons = {
    product: <Package size={20} />,
    box: <BoxIcon size={20} />,
    pallet: <Layers size={20} />,
    user: <Users size={20} />
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header" style={{ marginBottom: 40, borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>Deep Search</h1>
          <p style={{ fontSize: 16 }}>Pencarian mendalam untuk melacak kordinat produk, pallet, dan box secara presisi.</p>
        </div>
      </div>

      <div className="search-box-wrapper" style={{ maxWidth: 800, margin: '0 auto 60px' }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', 
          height: 72, borderRadius: 24, background: 'var(--bg-card)', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border-light)' 
        }}>
          <Search size={32} color="var(--primary)" />
          <input
            type="text"
            className="form-control"
            placeholder="Cari SKU, Nama Produk, Nomor Lot, atau Kode Pallet..."
            style={{ fontSize: 22, height: '100%', background: 'none', border: 'none', boxShadow: 'none', color: 'var(--text-white)' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && <div className="spinner dark" />}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {results.length === 0 && query && !loading && (
          <div style={{ textAlign: 'center', padding: 80, opacity: 0.5 }}>
             <Package size={64} style={{ margin: '0 auto 20px' }} />
             <p style={{ fontSize: 18 }}>Hasil pencarian untuk "{query}" tidak ditemukan di gudang ini.</p>
          </div>
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="animate-up" style={{ marginBottom: 40 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, color: 'var(--text-secondary)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></div>
                {typeLabels[type]} ({items.length})
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
                {items.map((res) => (
                  <div 
                    key={res.id} 
                    className="card hover-card animate-fade-in" 
                    style={{ 
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, padding: 24, 
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 20,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onClick={() => handleResultClick(res)}
                  >
                    {/* Hover Glow */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: res.type === 'product' ? 'var(--success)' : res.type === 'box' ? '#3b82f6' : 'var(--warning)' }}></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-white)', marginBottom: 4 }}>{res.name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                           <span className="badge badge-gray" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>{res.code}</span>
                           {res.lot && <span className="badge badge-warning" style={{ fontSize: 10 }}>LOT: {res.lot}</span>}
                           {res.category && <span className="badge badge-primary" style={{ fontSize: 10 }}>{res.category}</span>}
                        </div>
                      </div>
                      <div className="btn-icon" style={{ background: 'var(--primary-glow)', border: 'none' }}>
                        <MapPin size={18} color="var(--primary)" />
                      </div>
                    </div>

                    <div style={{ 
                      marginTop: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', 
                      borderRadius: 12, border: '1px dashed var(--border)',
                      display: 'flex', alignItems: 'center', gap: 10 
                    }}>
                      <Layers size={14} color="var(--text-muted)" />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {res.path || "Lokasi Belum Terdaftar"}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {res.boxCode && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          📦 Box: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{res.boxCode}</span>
                        </div>
                      )}
                      {res.palletCode && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          🏗️ Pallet: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{res.palletCode}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
