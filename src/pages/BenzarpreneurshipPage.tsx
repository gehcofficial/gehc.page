import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShoppingCart, X, Minus, Plus, Store, CheckCircle, Search, Share2, Copy, Package,
  HeartHandshake, Target, ChevronLeft,
} from 'lucide-react';
import type {
  Product, ProductCategory, QRISInfo, Campaign, CampaignDonation, Fulfillment,
} from '../types/benzar';
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_LABELS, FULFILLMENT_LABELS } from '../types/benzar';
import { useMediaSlots } from '../hooks/useMediaSlots';
import { IMG_PROPS } from '../config/media';

const CATEGORIES: ProductCategory[] = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];

const rupiah = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

type CartLine = { product: Product; qty: number };

function hashParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#\/?/, '');
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  if (!q) return null;
  return new URLSearchParams(q).get(key);
}

export default function BenzarpreneurshipPage() {
  const slots = useMediaSlots();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [subCategory, setSubCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showQRIS, setShowQRIS] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [qrisInfo, setQrisInfo] = useState<QRISInfo | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<{ campaign: Campaign; donations: CampaignDonation[]; grandTotal: number; donorCount: number } | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Checkout form
  const [form, setForm] = useState({
    fulfillment: 'PICKUP' as Fulfillment,
    name: '', phone: '', email: '', address: '', notes: '', promoCode: '',
  });
  const [promo, setPromo] = useState<{ code: string; name: string; discount: number } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [guestAsk, setGuestAsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);

  // Track / my orders
  const [showTrack, setShowTrack] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [tracked, setTracked] = useState<{ order: any; statusLabel?: string } | null>(null);
  const [trackErr, setTrackErr] = useState<string | null>(null);
  const [myOrders, setMyOrders] = useState<any[]>([]);

  const fetchProducts = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (activeCategory !== 'ALL') qs.set('category', activeCategory);
      if (subCategory) qs.set('subCategory', subCategory);
      qs.set('onSale', showArchive ? 'all' : '1');
      const r = await fetch(`/api/benzar/products?${qs.toString()}`);
      const d = await r.json();
      setProducts(d.products || []);
    } catch { /* skip */ }
    finally { setLoading(false); }
  }, [search, activeCategory, subCategory, showArchive]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 250);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  useEffect(() => {
    fetch('/api/benzar/qris').then((r) => r.json()).then(setQrisInfo).catch(() => {});
    fetch('/api/benzar/campaigns').then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCampaigns(d.campaigns || [])).catch(() => {});
    fetch('/api/benzar/orders/my', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) { setLoggedIn(false); return; }
        if (!r.ok) return;
        setLoggedIn(true);
        const d = await r.json();
        setMyOrders(d.orders || []);
      })
      .catch(() => {});
    // Deep link: ?item=<id> / ?campaign=<slug>
    const itemId = hashParam('item');
    const slug = hashParam('campaign');
    if (itemId) {
      fetch(`/api/benzar/products/${itemId}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (d?.product) { setSelectedProduct(d.product); setGalleryIdx(0); }
      }).catch(() => {});
    }
    if (slug) void openCampaign(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.subCategory).filter(Boolean) as string[])),
    [products],
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { product, qty: 1 }];
    });
    setSelectedProduct(null);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => (c.product.id === productId ? { ...c, qty: c.qty + delta } : c))
      .filter((c) => c.qty > 0));
  };

  const cartSubtotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const deliveryFee = form.fulfillment === 'DELIVERY' ? Number(qrisInfo?.deliveryFee || 0) : 0;
  const discount = promo?.discount || 0;
  const cartTotal = Math.max(0, cartSubtotal - discount) + deliveryFee;

  const openCheckout = () => {
    setCheckoutErr(null);
    setShowCheckout(true);
    if (loggedIn) setGuestAsk(false);
  };

  const validatePromo = async () => {
    setPromoErr(null);
    setPromo(null);
    if (!form.promoCode.trim()) return;
    try {
      const r = await fetch('/api/benzar/promos/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ code: form.promoCode.trim(), subtotal: cartSubtotal }),
      });
      const d = await r.json();
      if (!r.ok) { setPromoErr(d.error || 'Promo tidak valid.'); return; }
      setPromo({ code: d.promo.code, name: d.promo.name, discount: d.discount });
    } catch { setPromoErr('Gagal memeriksa promo.'); }
  };

  const doCheckout = async () => {
    setSubmitting(true);
    setCheckoutErr(null);
    try {
      const r = await fetch('/api/benzar/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
          fulfillment: form.fulfillment,
          deliveryFee,
          notes: form.notes,
          promoCode: promo?.code || '',
          guestName: loggedIn ? undefined : form.name,
          guestPhone: loggedIn ? undefined : form.phone,
          guestEmail: loggedIn ? undefined : form.email,
          shippingAddr: form.fulfillment === 'DELIVERY' ? { name: form.name, phone: form.phone, address: form.address } : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setCheckoutErr(d.error || 'Gagal membuat pesanan.'); return; }
      setOrderCode(d.orderCode);
      setShowCheckout(false);
      setShowQRIS(true);
      setCart([]);
      setPromo(null);
      setForm((f) => ({ ...f, promoCode: '', notes: '' }));
    } catch { setCheckoutErr('Gagal membuat pesanan.'); }
    finally { setSubmitting(false); }
  };

  const onCheckoutSubmit = () => {
    if (!loggedIn) { setGuestAsk(true); return; }
    void doCheckout();
  };

  const trackOrder = async () => {
    setTrackErr(null);
    setTracked(null);
    try {
      const qs = new URLSearchParams({ code: trackCode.trim() });
      if (trackPhone.trim()) qs.set('phone', trackPhone.trim());
      const r = await fetch(`/api/benzar/orders/track?${qs.toString()}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) { setTrackErr(d.error || 'Pesanan tidak ditemukan.'); return; }
      setTracked(d);
    } catch { setTrackErr('Gagal melacak pesanan.'); }
  };

  async function openCampaign(slug: string) {
    try {
      const r = await fetch(`/api/benzar/campaigns/${slug}`);
      if (!r.ok) return;
      const d = await r.json();
      setActiveCampaign({ campaign: d.campaign, donations: d.donations || [], grandTotal: d.grandTotal || 0, donorCount: d.donorCount || 0 });
    } catch { /* skip */ }
  }

  const shareProduct = async (p: Product) => {
    const link = `${window.location.origin}/#/benzarpreneurship?item=${p.id}`;
    const text = `🛍️ ${p.name}\n${rupiah(p.price)}\n${link}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text, url: link });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch { /* dibatalkan */ }
  };

  const copyProductLink = async (p: Product) => {
    const link = `${window.location.origin}/#/benzarpreneurship?item=${p.id}`;
    try { await navigator.clipboard.writeText(link); } catch { /* skip */ }
  };

  const images = (selectedProduct?.images as any[]) || [];

  return (
    <div className="min-h-screen bg-[#FAFAF5]">
      {/* Header */}
      <div className="relative bg-[#1B1B1B] text-white py-12 px-4 overflow-hidden">
        <img src={slots.benzar.hero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" {...IMG_PROPS} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B1B1B] to-[#2D2D2D]/80" />
        <div className="relative max-w-[1200px] mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Store className="w-8 h-8 text-[#F6AE4A]" />
            <h1 className="text-3xl font-black">Benzarpreneurship</h1>
          </div>
          <p className="text-white/60 text-sm">Usaha & Dana GEHC Youth — Merchandise · Fundraising · Donation</p>
        </div>
      </div>

      {/* WA Float */}
      <a
        href={`https://wa.me/62${String(qrisInfo?.whatsapp || '81288646114').replace(/^0/, '')}?text=${encodeURIComponent('Halo GEHC Benzarpreneurship, saya ingin bertanya tentang produk')}`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-40 bg-green-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-green-600 hover:scale-110 transition-all"
        title="Chat WhatsApp"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
      </a>

      {/* Cart Float */}
      {cartCount > 0 && (
        <button
          onClick={openCheckout}
          className="fixed bottom-6 right-6 z-40 bg-[#F6AE4A] text-[#1B1B1B] px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold hover:scale-105 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>{cartCount}</span>
          <span className="text-xs">•</span>
          <span>{rupiah(cartSubtotal)}</span>
        </button>
      )}

      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D9D7D0] bg-white text-sm focus:outline-none focus:border-[#F6AE4A]"
            />
          </div>
          <button
            onClick={() => setShowArchive((v) => !v)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${showArchive ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
          >
            {showArchive ? 'Sedang dijual + arsip' : 'Sedang dijual'}
          </button>
          <button
            onClick={() => setShowTrack(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#D9D7D0] bg-white text-[#8C8880] inline-flex items-center gap-1.5"
          >
            <Package className="w-4 h-4" /> Pesanan Saya
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => { setActiveCategory('ALL'); setSubCategory(''); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeCategory === 'ALL' ? 'bg-[#1B1B1B] text-white' : 'bg-white text-[#8C8880] border border-[#D9D7D0]'}`}
          >
            Semua
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSubCategory(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeCategory === cat ? 'text-white' : 'bg-white text-[#8C8880] border border-[#D9D7D0]'}`}
              style={activeCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Sub-categories */}
        {subCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setSubCategory('')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${!subCategory ? 'bg-[#F6AE4A]/20 border-[#F6AE4A] text-[#8C6A1F]' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}
            >
              Semua sub
            </button>
            {subCategories.map((sc) => (
              <button
                key={sc}
                onClick={() => setSubCategory(sc)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${subCategory === sc ? 'bg-[#F6AE4A]/20 border-[#F6AE4A] text-[#8C6A1F]' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}
              >
                {sc}
              </button>
            ))}
          </div>
        )}

        {/* Campaigns */}
        {campaigns.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <HeartHandshake className="w-5 h-5 text-[#6366F1]" />
              <h2 className="text-lg font-black text-[#1B1B1B]">Campaign Donasi</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c) => {
                const pct = c.target > 0 ? Math.min(100, Math.round(((c.grandTotal || 0) / c.target) * 100)) : 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => void openCampaign(c.slug)}
                    className="text-left bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-[#6366F1]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1]">Campaign</span>
                    </div>
                    <h3 className="font-bold text-[#1B1B1B] mb-1 line-clamp-2">{c.title}</h3>
                    <div className="h-2 bg-[#EFEDE8] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-[#6366F1]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-[#8C8880]">
                      <b className="text-[#1B1B1B]">{rupiah(c.grandTotal || 0)}</b> dari {rupiah(c.target)} · {c.donorCount || 0} donatur
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Products */}
        {loading ? (
          <div className="text-center py-20 text-[#8C8880]">Memuat produk...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-[#8C8880]">Belum ada produk tersedia.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => { setSelectedProduct(product); setGalleryIdx(0); }}
                className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
              >
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  <img
                    src={(product.images as any[])?.[0]?.url || slots.benzar.productPlaceholder}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    {...IMG_PROPS}
                  />
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[product.category] + '20', color: CATEGORY_COLORS[product.category] }}
                    >
                      {CATEGORY_LABELS[product.category]}
                    </span>
                    {product.subCategory && <span className="text-[10px] font-bold text-[#8C8880]">{product.subCategory}</span>}
                    {product.isPreorder && <span className="text-[10px] font-bold text-indigo-600">Pre-order</span>}
                    {!product.isOnSale && <span className="text-[10px] font-bold text-[#8C8880]">Arsip</span>}
                    {product.stock <= 0 && <span className="text-[10px] font-bold text-red-500">Stok Habis</span>}
                  </div>
                  <h3 className="font-bold text-[#1B1B1B] mb-1">{product.name}</h3>
                  <p className="text-xs text-[#8C8880] line-clamp-2 mb-3">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-[#F6AE4A]">{rupiah(product.price)}</span>
                    {product.stock > 0 && product.isOnSale && (
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

      {/* Product Detail */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">{selectedProduct.name}</h2>
              <button onClick={() => setSelectedProduct(null)} className="text-[#8C8880] hover:text-[#1B1B1B]"><X className="w-5 h-5" /></button>
            </div>
            <div className="h-56 bg-gray-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
              <img
                src={images[galleryIdx]?.url || slots.benzar.productPlaceholder}
                alt={selectedProduct.name}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto">
                {images.map((im, i) => (
                  <button key={i} onClick={() => setGalleryIdx(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${i === galleryIdx ? 'border-[#F6AE4A]' : 'border-transparent'}`}>
                    <img src={im.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-sm text-[#8C8880] mb-4 whitespace-pre-line">{selectedProduct.description}</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-black text-[#F6AE4A]">{rupiah(selectedProduct.price)}</span>
              <span className="text-xs text-[#8C8880]">Stok: {selectedProduct.stock}{selectedProduct.isPreorder ? ' · Pre-order' : ''}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => void shareProduct(selectedProduct)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880]">
                <Share2 className="w-3.5 h-3.5" /> Bagikan
              </button>
              <button onClick={() => void copyProductLink(selectedProduct)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880]">
                <Copy className="w-3.5 h-3.5" /> Salin link
              </button>
            </div>
            <button
              onClick={() => addToCart(selectedProduct)}
              disabled={selectedProduct.stock <= 0 || !selectedProduct.isOnSale}
              className="w-full bg-[#F6AE4A] text-[#1B1B1B] py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E5A03F]"
            >
              {selectedProduct.stock > 0 && selectedProduct.isOnSale ? 'Tambah ke Keranjang' : 'Tidak tersedia'}
            </button>
          </div>
        </div>
      )}

      {/* Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Keranjang Belanja</h2>
              <button onClick={() => setShowCheckout(false)} className="text-[#8C8880] hover:text-[#1B1B1B]"><X className="w-5 h-5" /></button>
            </div>
            {cart.length === 0 ? (
              <p className="text-center text-[#8C8880] py-8">Keranjang kosong</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
                  {cart.map((c) => (
                    <div key={c.product.id} className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.product.name}</p>
                        <p className="text-xs text-[#8C8880]">{rupiah(c.product.price)} × {c.qty}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQty(c.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-[#D9D7D0] flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold w-6 text-center">{c.qty}</span>
                        <button onClick={() => updateCartQty(c.product.id, 1)} className="w-7 h-7 rounded-lg bg-white border border-[#D9D7D0] flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fulfillment */}
                <div className="mb-3">
                  <label className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Metode</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(['PICKUP', 'DELIVERY', 'DINE_IN', 'TAKEAWAY'] as Fulfillment[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setForm((s) => ({ ...s, fulfillment: f }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${form.fulfillment === f ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}
                      >
                        {FULFILLMENT_LABELS[f]}{f === 'DELIVERY' && Number(qrisInfo?.deliveryFee || 0) > 0 ? ` (+${rupiah(Number(qrisInfo?.deliveryFee || 0))})` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guest / login */}
                {!loggedIn && (
                  <div className="rounded-xl bg-[#FFF7E8] border border-[#F6AE4A]/40 p-3 mb-3 space-y-2">
                    <p className="text-[11px] font-bold text-[#8C6A1F]">Pesan sebagai tamu — isi nama & nomor HP.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nama" className="px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm" />
                      <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="No. HP" className="px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm" />
                    </div>
                    <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email (opsional)" className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm" />
                  </div>
                )}

                {form.fulfillment === 'DELIVERY' && (
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                    placeholder="Alamat pengiriman"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm mb-3"
                  />
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    value={form.promoCode}
                    onChange={(e) => setForm((s) => ({ ...s, promoCode: e.target.value.toUpperCase() }))}
                    placeholder="Kode promo"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm"
                  />
                  <button onClick={() => void validatePromo()} className="px-3 py-2 rounded-lg bg-[#1B1B1B] text-white text-xs font-bold">Pakai</button>
                </div>
                {promoErr && <p className="text-[11px] text-red-600 mb-2">{promoErr}</p>}
                {promo && <p className="text-[11px] text-emerald-700 mb-2">Promo <b>{promo.name}</b> — diskon {rupiah(promo.discount)}</p>}

                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Catatan (opsional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm mb-3"
                />

                <div className="border-t border-[#D9D7D0] pt-3 mb-3 space-y-1 text-sm">
                  <div className="flex justify-between text-[#8C8880]"><span>Subtotal</span><span>{rupiah(cartSubtotal)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-emerald-700"><span>Diskon</span><span>-{rupiah(discount)}</span></div>}
                  {deliveryFee > 0 && <div className="flex justify-between text-[#8C8880]"><span>Ongkir</span><span>{rupiah(deliveryFee)}</span></div>}
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-[#F6AE4A]">{rupiah(cartTotal)}</span></div>
                </div>
                {checkoutErr && <p className="text-[11px] text-red-600 mb-2">{checkoutErr}</p>}
                <button
                  onClick={onCheckoutSubmit}
                  disabled={submitting}
                  className="w-full bg-[#F6AE4A] text-[#1B1B1B] py-3 rounded-xl font-bold hover:bg-[#E5A03F] disabled:opacity-50"
                >
                  {submitting ? 'Memproses…' : 'Buat Pesanan'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Guest login suggestion */}
      {guestAsk && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setGuestAsk(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <Package className="w-10 h-10 text-[#F6AE4A] mx-auto mb-3" />
            <h3 className="text-lg font-black mb-2">Simpan riwayat pesanan?</h3>
            <p className="text-xs text-[#8C8880] mb-4">Login agar riwayat & status pesanan tersimpan dan bisa dilacak kapan saja.</p>
            <div className="flex gap-2">
              <button onClick={() => { setGuestAsk(false); void doCheckout(); }} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880]">
                Abaikan
              </button>
              <a
                href={`#/login?next=${encodeURIComponent('#/benzarpreneurship')}`}
                className="flex-1 py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold text-center"
              >
                Login dulu
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Order created + QRIS */}
      {showQRIS && orderCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowQRIS(false); setOrderCode(null); }}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-black mb-2">Pesanan Dibuat!</h2>
            <p className="text-sm text-[#8C8880] mb-1">Kode Pesanan: <span className="font-mono font-bold text-[#1B1B1B]">{orderCode}</span></p>
            {qrisInfo && (
              <div className="my-4">
                <img src={slots.benzar.qris || qrisInfo.imageUrl} alt="QRIS" className="w-48 h-48 mx-auto border rounded-xl" />
                <p className="text-xs text-[#8C8880] mt-2">{qrisInfo.instructions}</p>
                {qrisInfo.whatsapp && (
                  <a
                    href={`https://wa.me/62${String(qrisInfo.whatsapp).replace(/^0/, '')}?text=${encodeURIComponent(`Halo GEHC, saya sudah bayar pesanan ${orderCode}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600"
                  >
                    Kirim Bukti ke WA
                  </a>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowQRIS(false); setOrderCode(null); setShowTrack(true); setTrackCode(orderCode); }}
                className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880]"
              >
                Lacak Pesanan
              </button>
              <button onClick={() => { setShowQRIS(false); setOrderCode(null); }} className="flex-1 bg-[#1B1B1B] text-white py-2.5 rounded-xl text-xs font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track / My orders */}
      {showTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTrack(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Pesanan Saya</h2>
              <button onClick={() => setShowTrack(false)} className="text-[#8C8880] hover:text-[#1B1B1B]"><X className="w-5 h-5" /></button>
            </div>
            {!loggedIn && (
              <>
                <div className="flex gap-2 mb-3">
                  <input value={trackCode} onChange={(e) => setTrackCode(e.target.value.toUpperCase())} placeholder="Kode pesanan (BZP-…)" className="flex-1 px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm" />
                  <input value={trackPhone} onChange={(e) => setTrackPhone(e.target.value)} placeholder="No. HP" className="w-32 px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm" />
                </div>
                <button onClick={() => void trackOrder()} className="w-full bg-[#1B1B1B] text-white py-2.5 rounded-xl text-sm font-bold mb-3">Lacak</button>
                {trackErr && <p className="text-[11px] text-red-600 mb-3">{trackErr}</p>}
              </>
            )}
            {tracked && (
              <div className="rounded-2xl border border-[#EFEDE8] p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold">{tracked.order.orderCode}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880]">
                    {tracked.statusLabel || STATUS_LABELS[tracked.order.status as keyof typeof STATUS_LABELS] || tracked.order.status}
                  </span>
                </div>
                <p className="text-xs text-[#8C8880] mb-2">Total: <b className="text-[#1B1B1B]">{rupiah(tracked.order.total)}</b></p>
                {(tracked.order.timeline || []).map((t: any, i: number) => (
                  <p key={i} className="text-[11px] text-[#8C8880]">
                    • {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status} — {new Date(t.at).toLocaleString('id-ID')}{t.note ? ` · ${t.note}` : ''}
                  </p>
                ))}
              </div>
            )}
            {loggedIn && myOrders.length === 0 && <p className="text-center text-[#8C8880] py-6 text-sm">Belum ada pesanan.</p>}
            {loggedIn && myOrders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-[#EFEDE8] p-3 mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{o.orderCode}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880]">
                    {STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#8C8880] mt-1">{rupiah(o.total)} · {new Date(o.createdAt).toLocaleDateString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign detail */}
      {activeCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setActiveCampaign(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setActiveCampaign(null)} className="inline-flex items-center gap-1 text-xs font-bold text-[#8C8880] mb-3">
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <h2 className="text-xl font-black mb-2">{activeCampaign.campaign.title}</h2>
            <p className="text-sm text-[#8C8880] mb-4 whitespace-pre-line">{activeCampaign.campaign.description}</p>
            <div className="h-3 bg-[#EFEDE8] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-[#6366F1]"
                style={{ width: `${activeCampaign.campaign.target > 0 ? Math.min(100, Math.round((activeCampaign.grandTotal / activeCampaign.campaign.target) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-xs text-[#8C8880] mb-4">
              <b className="text-[#1B1B1B] text-base">{rupiah(activeCampaign.grandTotal)}</b> dari {rupiah(activeCampaign.campaign.target)} · {activeCampaign.donorCount} donatur
            </p>
            <button onClick={() => setDonateOpen(true)} className="w-full bg-[#6366F1] text-white py-3 rounded-xl font-bold mb-4 hover:bg-[#4F46E5]">
              Donasi Sekarang
            </button>
            <div className="space-y-2">
              {activeCampaign.donations.filter((d) => d.status === 'VERIFIED').slice(0, 12).map((d) => (
                <div key={d.id} className="rounded-xl bg-[#FAF9F5] p-3">
                  <p className="text-xs font-bold text-[#1B1B1B]">{d.donorName} · {rupiah(d.amount)}</p>
                  {d.message && <p className="text-[11px] text-[#8C8880] italic">"{d.message}"</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Donate form */}
      {donateOpen && activeCampaign && (
        <DonateForm
          slug={activeCampaign.campaign.slug}
          defaultName={loggedIn ? '' : ''}
          onClose={() => setDonateOpen(false)}
          onDone={() => { setDonateOpen(false); void openCampaign(activeCampaign.campaign.slug); }}
        />
      )}

      {/* Footer */}
      <footer className="bg-[#1B1B1B] text-white py-8 px-4 mt-12">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Store className="w-5 h-5 text-[#F6AE4A]" />
            <span className="font-bold">Benzarpreneurship GEHC Youth</span>
          </div>
          <p className="text-white/50 text-xs mb-4">Usaha & Dana untuk Pemuridan & Pelayanan Pemuda</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            {(qrisInfo?.picPhones?.length ? qrisInfo.picPhones : [{ name: 'BZP', phone: qrisInfo?.whatsapp || '081288646114' }]).map((pic) => (
              <a
                key={pic.phone}
                href={`https://wa.me/62${String(pic.phone).replace(/^0/, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-green-400 hover:text-green-300"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                {pic.name || 'PIC'} · {pic.phone}
              </a>
            ))}
            <span className="text-white/30">•</span>
            <span className="text-white/50">GEHC Youth — Cikarang</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const DonateForm: React.FC<{ slug: string; defaultName: string; onClose: () => void; onDone: () => void }> = ({ slug, onClose, onDone }) => {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/benzar/campaigns/${slug}/donations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ amount: Number(amount) || 0, donorName: name, message, isAnonymous: anonymous }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Gagal mengirim donasi.'); return; }
      onDone();
    } catch { setErr('Gagal mengirim donasi.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-3">Donasi</h3>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Nominal (Rp)" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm mb-2" />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[10000, 25000, 50000, 100000].map((n) => (
            <button key={n} onClick={() => setAmount(String(n))} className="px-3 py-1.5 rounded-full border border-[#D9D7D0] text-xs font-bold text-[#8C8880]">
              {rupiah(n)}
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama" disabled={anonymous} className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm mb-2 disabled:bg-[#FAF9F5]" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pesan/doa (opsional)" rows={2} className="w-full px-3 py-2 rounded-lg border border-[#D9D7D0] text-sm mb-2" />
        <label className="flex items-center gap-2 text-xs text-[#8C8880] mb-3">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Donasi sebagai anonim
        </label>
        {err && <p className="text-[11px] text-red-600 mb-2">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880]">Batal</button>
          <button onClick={() => void submit()} disabled={busy || !(Number(amount) > 0)} className="flex-1 py-2.5 rounded-xl bg-[#6366F1] text-white text-sm font-bold disabled:opacity-50">
            {busy ? 'Mengirim…' : 'Kirim Donasi'}
          </button>
        </div>
      </div>
    </div>
  );
};
