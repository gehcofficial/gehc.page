import React, { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, X, Minus, Plus, Store, CreditCard, CheckCircle, Package } from 'lucide-react';
import type { Product, ProductCategory, QRISInfo } from '../types/benzar';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types/benzar';

const CATEGORIES: ProductCategory[] = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];

export default function BenzarpreneurshipPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showQRIS, setShowQRIS] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [qrisInfo, setQrisInfo] = useState<QRISInfo | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const r = await fetch('/api/benzar/products');
      const d = await r.json();
      setProducts(d.products || []);
    } catch { /* skip */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    fetch('/api/benzar/qris').then(r => r.json()).then(setQrisInfo).catch(() => {});
  }, []);

  const filtered = activeCategory === 'ALL'
    ? products
    : products.filter(p => p.category === activeCategory);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1 }];
    });
    setSelectedProduct(null);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.product.id !== productId) return c;
        const newQty = c.qty + delta;
        if (newQty <= 0) return null;
        return { ...c, qty: newQty };
      }).filter(Boolean) as { product: Product; qty: number }[];
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.product.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const handleCheckout = async () => {
    try {
      const r = await fetch('/api/benzar/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: cart.map(c => ({ productId: c.product.id, qty: c.qty })), shipping: 'PICKUP' }),
      });
      if (r.ok) {
        const d = await r.json();
        setOrderCode(d.orderCode);
        setShowCheckout(false);
        setShowQRIS(true);
        setCart([]);
      } else {
        const e = await r.json();
        alert(e.error || 'Gagal membuat pesanan');
      }
    } catch { alert('Gagal membuat pesanan'); }
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-[#FAFAF5]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1B1B1B] to-[#2D2D2D] text-white py-12 px-4">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Store className="w-8 h-8 text-[#F6AE4A]" />
            <h1 className="text-3xl font-black">Benzarpreneurship</h1>
          </div>
          <p className="text-white/60 text-sm">Usaha & Dana GEHC Youth — Merchandise · Fundraising · Donation</p>
        </div>
      </div>

      {/* Cart Float Button */}
      {cartCount > 0 && (
        <button
          onClick={() => setShowCheckout(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#F6AE4A] text-[#1B1B1B] px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold hover:scale-105 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>{cartCount}</span>
          <span className="text-xs">•</span>
          <span>{formatRupiah(cartTotal)}</span>
        </button>
      )}

      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === 'ALL' ? 'bg-[#1B1B1B] text-white' : 'bg-white text-[#8C8880] border border-[#D9D7D0]'
            }`}
          >
            Semua
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeCategory === cat ? 'text-white' : 'bg-white text-[#8C8880] border border-[#D9D7D0]'
              }`}
              style={activeCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-20 text-[#8C8880]">Memuat produk...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#8C8880]">Belum ada produk tersedia.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(product => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
              >
                {/* Image placeholder */}
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  {product.images && (product.images as any[]).length > 0 ? (
                    <img
                      src={(product.images as any[])[0]?.url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[product.category] + '20', color: CATEGORY_COLORS[product.category] }}
                    >
                      {CATEGORY_LABELS[product.category]}
                    </span>
                    {product.stock <= 0 && (
                      <span className="text-[10px] font-bold text-red-500">Stok Habis</span>
                    )}
                  </div>
                  <h3 className="font-bold text-[#1B1B1B] mb-1">{product.name}</h3>
                  <p className="text-xs text-[#8C8880] line-clamp-2 mb-3">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-[#F6AE4A]">{formatRupiah(product.price)}</span>
                    {product.stock > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        className="bg-[#F6AE4A] text-[#1B1B1B] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#E5A03F]"
                      >
                        + Keranjang
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">{selectedProduct.name}</h2>
              <button onClick={() => setSelectedProduct(null)} className="text-[#8C8880] hover:text-[#1B1B1B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-48 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
              {selectedProduct.images && (selectedProduct.images as any[]).length > 0 ? (
                <img src={(selectedProduct.images as any[])[0]?.url} alt={selectedProduct.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Package className="w-16 h-16 text-gray-300" />
              )}
            </div>
            <p className="text-sm text-[#8C8880] mb-4">{selectedProduct.description}</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-black text-[#F6AE4A]">{formatRupiah(selectedProduct.price)}</span>
              <span className="text-xs text-[#8C8880]">Stok: {selectedProduct.stock}</span>
            </div>
            <button
              onClick={() => addToCart(selectedProduct)}
              disabled={selectedProduct.stock <= 0}
              className="w-full bg-[#F6AE4A] text-[#1B1B1B] py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E5A03F]"
            >
              {selectedProduct.stock > 0 ? 'Tambah ke Keranjang' : 'Stok Habis'}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Keranjang Belanja</h2>
              <button onClick={() => setShowCheckout(false)} className="text-[#8C8880] hover:text-[#1B1B1B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {cart.length === 0 ? (
              <p className="text-center text-[#8C8880] py-8">Keranjang kosong</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {cart.map(c => (
                    <div key={c.product.id} className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.product.name}</p>
                        <p className="text-xs text-[#8C8880]">{formatRupiah(c.product.price)} × {c.qty}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQty(c.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-[#D9D7D0] flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center">{c.qty}</span>
                        <button onClick={() => updateCartQty(c.product.id, 1)} className="w-7 h-7 rounded-lg bg-white border border-[#D9D7D0] flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#D9D7D0] pt-3 mb-4">
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-[#F6AE4A]">{formatRupiah(cartTotal)}</span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-[#F6AE4A] text-[#1B1B1B] py-3 rounded-xl font-bold hover:bg-[#E5A03F]"
                >
                  Buat Pesanan
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* QRIS Payment Modal */}
      {showQRIS && orderCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowQRIS(false); setOrderCode(null); }}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-black mb-2">Pesanan Dibuat!</h2>
            <p className="text-sm text-[#8C8880] mb-1">Kode Pesanan: <span className="font-mono font-bold text-[#1B1B1B]">{orderCode}</span></p>
            {qrisInfo && (
              <div className="my-4">
                <img src={qrisInfo.imageUrl} alt="QRIS" className="w-48 h-48 mx-auto border rounded-xl" />
                <p className="text-xs text-[#8C8880] mt-2">{qrisInfo.instructions}</p>
              </div>
            )}
            <button
              onClick={() => { setShowQRIS(false); setOrderCode(null); }}
              className="bg-[#1B1B1B] text-white px-6 py-2 rounded-xl text-sm font-bold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
