import React, { useEffect, useState, useCallback } from 'react';
import {
  Package, ShoppingCart, Plus, Edit2, Trash2, Search, Eye, X, Ticket, HeartHandshake,
  CalendarClock, Settings as SettingsIcon, Megaphone, Check, Loader2, History, Ruler, Wand2, Power, Users,
} from 'lucide-react';
import { DriveUploadButton } from './DriveUploadButton';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_LABELS, STATUS_COLORS, FULFILLMENT_LABELS } from '../../types/benzar';
import type {
  Product, ProductCategory, Order, OrderStatus, Fulfillment, Promo, Campaign, CampaignDonation,
  SalesShift, SalesShiftAssignment, BzpSettings, BzpSubcategory, ProductVariant, BzpSizeChart,
} from '../../types/benzar';

const CATEGORIES: ProductCategory[] = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];
const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'VERIFIED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
const FULFILLMENTS: Fulfillment[] = ['PICKUP', 'DELIVERY', 'DINE_IN', 'TAKEAWAY'];
const rupiah = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const input = 'w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm';
const label = 'text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block';

interface Props { eventId?: string; division?: string }

export default function BenzarStoreTab(_props: Props) {
  const [tab, setTab] = useState<'products' | 'orders' | 'promos' | 'campaigns' | 'shifts' | 'catalog' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [shifts, setShifts] = useState<SalesShift[]>([]);
  const [subcats, setSubcats] = useState<BzpSubcategory[]>([]);
  const [settings, setSettings] = useState<BzpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState<{ campaign: Campaign; donations: CampaignDonation[]; grandTotal: number } | null>(null);
  const [editingShift, setEditingShift] = useState<SalesShift | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const fetchProducts = useCallback(async () => {
    try { const r = await fetch('/api/benzar/products?includeInactive=1&onSale=all', { credentials: 'include' }); const d = await r.json(); setProducts(d.products || []); } catch { /* skip */ }
  }, []);
  const fetchOrders = useCallback(async () => {
    try { const r = await fetch('/api/benzar/orders', { credentials: 'include' }); const d = await r.json(); setOrders(d.orders || []); } catch { /* skip */ }
  }, []);
  const fetchPromos = useCallback(async () => {
    try { const r = await fetch('/api/benzar/promos', { credentials: 'include' }); const d = await r.json(); setPromos(d.promos || []); } catch { /* skip */ }
  }, []);
  const fetchCampaigns = useCallback(async () => {
    try { const r = await fetch('/api/benzar/campaigns?all=1', { credentials: 'include' }); const d = await r.json(); setCampaigns(d.campaigns || []); } catch { /* skip */ }
  }, []);
  const fetchShifts = useCallback(async () => {
    try { const r = await fetch('/api/benzar/sales-shifts', { credentials: 'include' }); const d = await r.json(); setShifts(d.shifts || []); } catch { /* skip */ }
  }, []);
  const fetchSettings = useCallback(async () => {
    try { const r = await fetch('/api/benzar/settings', { credentials: 'include' }); const d = await r.json(); setSettings(d.settings); } catch { /* skip */ }
  }, []);
  const fetchSubcats = useCallback(async () => {
    try { const r = await fetch('/api/benzar/subcategories?all=1', { credentials: 'include' }); const d = await r.json(); setSubcats(d.subcategories || []); } catch { /* skip */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProducts(), fetchOrders(), fetchPromos(), fetchCampaigns(), fetchShifts(), fetchSettings(), fetchSubcats()]).finally(() => setLoading(false));
  }, [fetchProducts, fetchOrders, fetchPromos, fetchCampaigns, fetchShifts, fetchSettings, fetchSubcats]);

  const filteredProducts = products
    .filter((p) => filterCategory === 'ALL' || p.category === filterCategory)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredOrders = orders.filter((o) => filterStatus === 'ALL' || o.status === filterStatus);

  const openCampaignDetail = async (slug: string) => {
    const r = await fetch(`/api/benzar/campaigns/${slug}`, { credentials: 'include' });
    if (!r.ok) return;
    const d = await r.json();
    setCampaignDetail({ campaign: d.campaign, donations: d.donations || [], grandTotal: d.grandTotal || 0 });
  };

  const TABS: Array<{ id: typeof tab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'products', label: 'Produk', icon: <Package className="w-4 h-4" />, count: products.length },
    { id: 'orders', label: 'Pesanan', icon: <ShoppingCart className="w-4 h-4" />, count: orders.length },
    { id: 'promos', label: 'Promo', icon: <Ticket className="w-4 h-4" />, count: promos.length },
    { id: 'campaigns', label: 'Campaign', icon: <HeartHandshake className="w-4 h-4" />, count: campaigns.length },
    { id: 'shifts', label: 'Jadwal Jual', icon: <CalendarClock className="w-4 h-4" />, count: shifts.length },
    { id: 'catalog', label: 'Katalog', icon: <Ruler className="w-4 h-4" />, count: subcats.length },
    { id: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? 'bg-[#F6AE4A] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#8C8880] border border-[#D9D7D0]'}`}
          >
            {t.icon} {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat data BZP…</p>
      ) : (
        <>
          {tab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..." className={`${input} pl-9`} />
                </div>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className={`${input} w-auto`}>
                  <option value="ALL">Semua Kategori</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#E5A03F]">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#D9D7D0]/50 text-left text-[10px] uppercase tracking-wider text-[#8C8880]">
                        <th className="px-4 py-3">Produk</th>
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3 text-right">Harga Jual</th>
                        <th className="px-4 py-3 text-right">Modal</th>
                        <th className="px-4 py-3 text-right">Stok</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8C8880]">Belum ada produk</td></tr>
                      ) : filteredProducts.map((p) => (
                        <tr key={p.id} className="border-b border-[#D9D7D0]/30 hover:bg-[#FAF9F5]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {p.images?.[0]?.url
                                ? <img src={p.images[0].url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                                : <span className="w-9 h-9 rounded-lg bg-[#FAF9F5] grid place-items-center"><Package className="w-4 h-4 text-[#D9D7D0]" /></span>}
                              <div className="min-w-0">
                                <p className="font-bold truncate">{p.name}</p>
                                <p className="text-[10px] text-[#8C8880] truncate max-w-[200px]">
                                  {p.subCategory || '—'}{p.isPreorder ? ' · pre-order' : ''}{p.fundraisingType ? ` · ${p.fundraisingType}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[p.category as ProductCategory] + '20', color: CATEGORY_COLORS[p.category as ProductCategory] }}>
                              {CATEGORY_LABELS[p.category as ProductCategory]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{rupiah(p.price)}</td>
                          <td className="px-4 py-3 text-right text-xs">{p.buyPrice ? <span className="text-[#8C8880]">{rupiah(p.buyPrice)}</span> : <span className="text-[#D9D7D0]">—</span>}</td>
                          <td className="px-4 py-3 text-right"><span className={`font-bold ${p.stock <= 5 ? 'text-red-500' : ''}`}>{p.stock}</span></td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? (p.isOnSale ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAF9F5] text-[#8C8880]') : 'bg-red-50 text-red-600'}`}>
                              {p.isActive ? (p.isOnSale ? 'Dijual' : 'Arsip') : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                title={p.isActive ? 'Nonaktifkan (sembunyikan dari katalog)' : 'Aktifkan (tampil di katalog)'}
                                onClick={() => void toggleActive(p)}
                                className={`p-1.5 rounded-lg hover:bg-gray-100 ${p.isActive ? 'text-emerald-600' : 'text-[#C9C5BD]'}`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button title="Caption WA" onClick={() => void copyCaption(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100"><Megaphone className="w-3.5 h-3.5" /></button>
                              <button title="Edit" onClick={() => { setEditingProduct(p); setShowProductForm(true); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button title="Arsipkan" onClick={() => void archiveProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className={`${input} w-auto`}>
                <option value="ALL">Semua Status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#D9D7D0]/50 text-left text-[10px] uppercase tracking-wider text-[#8C8880]">
                        <th className="px-4 py-3">Kode</th>
                        <th className="px-4 py-3">Pembeli</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Metode</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8C8880]">Belum ada pesanan</td></tr>
                      ) : filteredOrders.map((o) => (
                        <tr key={o.id} className="border-b border-[#D9D7D0]/30 hover:bg-[#FAF9F5]">
                          <td className="px-4 py-3 font-mono text-xs font-bold">{o.orderCode}</td>
                          <td className="px-4 py-3">
                            <p>{o.user?.name || o.guestName || '-'}</p>
                            {!o.userId && <p className="text-[10px] text-[#8C8880]">Tamu · {o.guestPhone || '-'}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{rupiah(o.total)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status as OrderStatus]?.bg} ${STATUS_COLORS[o.status as OrderStatus]?.text}`}>
                              {STATUS_LABELS[o.status as OrderStatus]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">{FULFILLMENT_LABELS[(o.fulfillment as Fulfillment) || 'PICKUP']}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => setSelectedOrder(o)} className="p-1.5 rounded-lg hover:bg-gray-100"><Eye className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'promos' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setEditingPromo(null); setShowPromoForm(true); }} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold"><Plus className="w-4 h-4" /> Promo Baru</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {promos.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada promo.</p>}
                {promos.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm">{p.code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAF9F5] text-[#8C8880]'}`}>{p.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                    <p className="text-xs text-[#8C8880] mb-1">{p.name}</p>
                    <p className="text-xs"><b>{p.type === 'PERCENT' ? `${p.value}%` : rupiah(p.value)}</b> · {p.audience}{p.minSpend ? ` · min ${rupiah(p.minSpend)}` : ''}</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setEditingPromo(p); setShowPromoForm(true); }} className="text-[11px] font-bold text-sky-700">Edit</button>
                      <button onClick={() => void deletePromo(p.id)} className="text-[11px] font-bold text-red-600">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setEditingCampaign(null); setShowCampaignForm(true); }} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold"><Plus className="w-4 h-4" /> Campaign Baru</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {campaigns.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada campaign.</p>}
                {campaigns.map((c) => {
                  const pct = c.target > 0 ? Math.min(100, Math.round(((c.grandTotal || 0) / c.target) * 100)) : 0;
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm line-clamp-1">{c.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAF9F5] text-[#8C8880]'}`}>{c.isActive ? 'Aktif' : 'Tutup'}</span>
                      </div>
                      <p className="text-[10px] text-[#8C8880] mb-2">/{c.slug}</p>
                      <div className="h-2 bg-[#EFEDE8] rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-[#6366F1]" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-[#8C8880] mb-3"><b className="text-[#1B1B1B]">{rupiah(c.grandTotal || 0)}</b> / {rupiah(c.target)} · {c.donorCount || 0} donatur</p>
                      <div className="flex gap-2">
                        <button onClick={() => void openCampaignDetail(c.slug)} className="text-[11px] font-bold text-sky-700">Donasi</button>
                        <button onClick={() => { setEditingCampaign(c); setShowCampaignForm(true); }} className="text-[11px] font-bold text-[#8C8880]">Edit</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'shifts' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setEditingShift(null); setShowShiftForm(true); }} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold"><Plus className="w-4 h-4" /> Shift Baru</button>
              </div>
              <div className="space-y-2">
                {shifts.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada jadwal penjualan.</p>}
                {shifts.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">{s.title}</span>
                      <span className="text-[11px] text-[#8C8880]">{s.date} · {s.startTime}–{s.endTime}</span>
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => { setEditingShift(s); setShowShiftForm(true); }} className="text-[11px] font-bold text-sky-700">Kelola</button>
                        <button onClick={() => void deleteShift(s.id)} className="text-[11px] font-bold text-red-600">Hapus</button>
                      </div>
                    </div>
                    {!!(s.roles || []).length && <p className="text-[11px] text-[#8C8880] mt-1">Butuh: {(s.roles || []).map((r) => `${r.role}×${r.qty}`).join(', ')}</p>}
                    {!!(s.assignments || []).length && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(s.assignments || []).map((a) => (
                          <span key={a.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : a.status === 'DECLINED' ? 'bg-red-50 text-red-600' : 'bg-[#FAF9F5] text-[#8C8880]'}`}>
                            {a.name} · {a.role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'catalog' && <CatalogPanel subcats={subcats} onChanged={fetchSubcats} notify={notify} />}

          {tab === 'settings' && <SettingsPanel settings={settings} onSaved={fetchSettings} notify={notify} />}
        </>
      )}

      {showProductForm && (
        <ProductFormModal
          product={editingProduct}
          subcats={subcats}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
          onSaved={(msg) => { setShowProductForm(false); setEditingProduct(null); fetchProducts(); notify(msg || 'Produk tersimpan'); }}
        />
      )}

      {showPromoForm && (
        <PromoFormModal
          promo={editingPromo}
          products={products}
          subcats={subcats}
          onClose={() => { setShowPromoForm(false); setEditingPromo(null); }}
          onSaved={() => { setShowPromoForm(false); setEditingPromo(null); fetchPromos(); notify('Promo tersimpan'); }}
        />
      )}

      {showCampaignForm && (
        <CampaignFormModal
          campaign={editingCampaign}
          onClose={() => { setShowCampaignForm(false); setEditingCampaign(null); }}
          onSaved={() => { setShowCampaignForm(false); setEditingCampaign(null); fetchCampaigns(); notify('Campaign tersimpan'); }}
        />
      )}

      {showShiftForm && (
        <ShiftFormModal
          shift={editingShift}
          onClose={() => { setShowShiftForm(false); setEditingShift(null); }}
          onSaved={() => { setShowShiftForm(false); setEditingShift(null); fetchShifts(); notify('Shift tersimpan'); }}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onChanged={() => { fetchOrders(); notify('Pesanan diperbarui'); }}
        />
      )}

      {campaignDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCampaignDetail(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black">{campaignDetail.campaign.title}</h3>
              <button onClick={() => setCampaignDetail(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-[#8C8880] mb-3">Terkumpul <b className="text-[#6366F1]">{rupiah(campaignDetail.grandTotal)}</b> dari {rupiah(campaignDetail.campaign.target)}</p>
            <div className="space-y-2">
              {campaignDetail.donations.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada donasi.</p>}
              {campaignDetail.donations.map((d) => (
                <div key={d.id} className="rounded-xl border border-[#EFEDE8] p-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{d.donorName} · {rupiah(d.amount)}</p>
                    {d.message && <p className="text-[11px] text-[#8C8880] italic truncate">"{d.message}"</p>}
                  </div>
                  <select
                    value={d.status}
                    onChange={async (e) => {
                      await fetch(`/api/benzar/donations/${d.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: e.target.value }) });
                      void openCampaignDetail(campaignDetail.campaign.slug);
                    }}
                    className="text-[10px] px-2 py-1 rounded-lg border border-[#D9D7D0]"
                  >
                    {['PENDING', 'PAID', 'VERIFIED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] bg-[#1B1B1B] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">{toast}</div>
      )}
    </div>
  );

  async function toggleActive(p: Product) {
    const r = await fetch(`/api/benzar/products/${p.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(d.error || 'Gagal mengubah status'); return; }
    fetchProducts();
    notify(!p.isActive ? 'Produk diaktifkan' : 'Produk dinonaktifkan');
  }

  async function archiveProduct(id: string) {
    if (!confirm('Arsipkan produk ini? (tidak tampil di katalog)')) return;
    await fetch(`/api/benzar/products/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchProducts();
    notify('Produk diarsipkan');
  }

  async function deletePromo(id: string) {
    if (!confirm('Hapus promo ini?')) return;
    await fetch(`/api/benzar/promos/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchPromos();
  }

  async function deleteShift(id: string) {
    if (!confirm('Hapus shift ini?')) return;
    await fetch(`/api/benzar/sales-shifts/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchShifts();
  }

  async function copyCaption(id: string) {
    try {
      const r = await fetch(`/api/benzar/caption/${id}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await navigator.clipboard.writeText(d.caption || '');
      notify('Caption disalin — tempel ke WhatsApp');
    } catch { notify('Gagal membuat caption'); }
  }
}

// ---------------- Product form ----------------
function ProductFormModal({ product, subcats, onClose, onSaved }: { product: Product | null; subcats: BzpSubcategory[]; onClose: () => void; onSaved: (msg?: string) => void }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ? String(product.price) : '',
    buyPrice: product?.buyPrice ? String(product.buyPrice) : '',
    stock: product?.stock != null ? String(product.stock) : '0',
    category: (product?.category || 'MERCHANDISE') as ProductCategory,
    subCategory: product?.subCategory || '',
    subcategoryId: product?.subcategoryId || '',
    fundraisingType: product?.fundraisingType || '',
    isActive: product?.isActive ?? true,
    isOnSale: product?.isOnSale ?? true,
    isPreorder: product?.isPreorder ?? false,
    cogs: product?.cogs ? String(product.cogs) : '',
    operatingCost: product?.operatingCost ? String(product.operatingCost) : '',
    yieldQty: product?.yieldQty ? String(product.yieldQty) : '',
    dineIn: product?.fulfillmentOptions?.dineIn ?? false,
    takeaway: product?.fulfillmentOptions?.takeaway ?? false,
    delivery: product?.fulfillmentOptions?.delivery ?? false,
  });
  // Editor varian
  const [optNames, setOptNames] = useState<string[]>(() => (product?.options || []).map((o) => o.name));
  const [optValues, setOptValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const o of product?.options || []) m[o.name] = (o.values || []).join(', ');
    return m;
  });
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants || []);
  const [saved, setSaved] = useState<Product | null>(product);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyImgs, setBusyImgs] = useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!saved?.id) return;
    fetch(`/api/benzar/products/${saved.id}/history`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((d) => setHistory(d.history || []))
      .catch(() => {});
  }, [saved?.id]);

  const bulkModal = (() => {
    const cogs = Number(form.cogs) || 0;
    const op = Number(form.operatingCost) || 0;
    const qty = Number(form.yieldQty) || 0;
    if (cogs > 0 && qty > 0) return Math.round((cogs + op) / qty);
    return null;
  })();

  const hasVariantMode = variants.length > 0 || optNames.some((n) => n.trim());
  const totalVariantStock = variants.reduce((n, v) => n + (Number(v.stock) || 0), 0);
  const images = (saved?.images || []) as Array<{ driveFileId?: string; url: string; name?: string; caption?: string }>;

  const save = async () => {
    setSaving(true);
    try {
      const body: any = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        category: form.category,
        subCategory: form.subCategory,
        subcategoryId: form.subcategoryId || null,
        isActive: form.isActive,
        hasVariants: variants.length > 0,
        options: optNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ name: n, values: String(optValues[n] || '').split(',').map((x) => x.trim()).filter(Boolean) })),
        variants: variants.map((v) => ({
          sku: v.sku || null,
          options: v.options,
          price: v.price ?? null,
          buyPrice: v.buyPrice ?? null,
          stock: Number(v.stock) || 0,
          imageFileId: v.imageFileId || null,
          isActive: v.isActive !== false,
        })),
        fundraisingType: form.fundraisingType || null,
        isOnSale: form.isOnSale,
        isPreorder: form.isPreorder,
        cogs: form.cogs || null,
        operatingCost: form.operatingCost || null,
        yieldQty: form.yieldQty || null,
        fulfillmentOptions: { dineIn: form.dineIn, takeaway: form.takeaway, delivery: form.delivery },
      };
      if (form.buyPrice) body.buyPrice = Number(form.buyPrice);
      const method = saved?.id ? 'PATCH' : 'POST';
      const url = saved?.id ? `/api/benzar/products/${saved.id}` : '/api/benzar/products';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setSaved(d.product);
      if (!saved?.id) {
        onSaved('Produk dibuat — silakan unggah foto');
      } else {
        const h = await fetch(`/api/benzar/products/${saved.id}/history`, { credentials: 'include' }).then((x) => (x.ok ? x.json() : { history: [] }));
        setHistory(h.history || []);
        onSaved('Produk diperbarui');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally { setSaving(false); }
  };

  const fileToDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

  /** Unggah banyak foto sekaligus (nama file asli dipakai sebagai label). */
  const uploadMany = async (files: FileList | null) => {
    if (!saved?.id || !files?.length) return;
    setBusyImgs(true);
    try {
      for (const f of Array.from(files)) {
        const data = await fileToDataUrl(f);
        await fetch(`/api/benzar/products/${saved.id}/images`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, name: f.name, mimetype: f.type || 'image/jpeg', data }),
        });
      }
      const r = await fetch(`/api/benzar/products/${saved.id}`, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) setSaved(d.product);
    } finally { setBusyImgs(false); }
  };

  const renameImage = async (idx: number, name: string) => {
    if (!saved?.id) return;
    const next = images.map((im, i) => (i === idx ? { ...im, name } : im));
    setSaved({ ...(saved as Product), images: next as any });
    await fetch(`/api/benzar/products/${saved.id}/images`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: next }),
    });
  };

  const removeImage = async (idx: number) => {
    if (!saved?.id) return;
    const next = images.filter((_, i) => i !== idx);
    const r = await fetch(`/api/benzar/products/${saved.id}/images`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: next }) });
    const d = await r.json();
    if (r.ok) setSaved(d.product);
  };

  /** Cartesian product dari opsi → matriks varian (stok/harga lama dipertahankan). */
  const generateVariants = () => {
    const names = optNames.map((n) => n.trim()).filter(Boolean);
    const vals = names.map((n) => String(optValues[n] || '').split(',').map((x) => x.trim()).filter(Boolean));
    if (!names.length || vals.some((v) => !v.length)) return;
    const combos: Record<string, string>[] = [];
    const walk = (idx: number, acc: Record<string, string>) => {
      if (idx === names.length) { combos.push({ ...acc }); return; }
      for (const v of vals[idx]) walk(idx + 1, { ...acc, [names[idx]]: v });
    };
    walk(0, {});
    setVariants((prev) => combos.map((opts) => {
      const key = JSON.stringify(opts);
      const found = prev.find((p) => JSON.stringify(p.options) === key);
      return found || {
        id: '', productId: saved?.id || '', sku: null, options: opts,
        price: null, buyPrice: null, stock: 0, imageFileId: null, isActive: true, position: 0,
      } as ProductVariant;
    }));
  };

  const patchVariant = (i: number, patch: Partial<ProductVariant>) =>
    setVariants((vs) => vs.map((v, vi) => (vi === i ? { ...v, ...patch } : v)));

  const variantCount = optNames
    .map((n) => n.trim())
    .filter(Boolean)
    .reduce((n, name) => n * (String(optValues[name] || '').split(',').map((x) => x.trim()).filter(Boolean).length || 1), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-[#EFEDE8]">
          <h3 className="text-lg font-black">{saved?.id ? 'Edit Produk' : 'Tambah Produk'}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div><label className={label}>Nama Produk</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></div>
          <div><label className={label}>Deskripsi</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${input} h-20 resize-none`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Harga Jual (Rp)</label><input inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
            <div>
              <label className={label}>Stok{hasVariantMode ? ' (otomatis dari varian)' : ''}</label>
              <input
                inputMode="numeric"
                value={hasVariantMode ? String(totalVariantStock) : form.stock}
                disabled={hasVariantMode}
                onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, '') })}
                className={`${input} ${hasVariantMode ? 'bg-[#F0EEE9] text-[#8C8880] cursor-not-allowed' : ''}`}
                title={hasVariantMode ? 'Stok produk dihitung dari total stok varian' : ''}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Kategori</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })} className={input}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div><label className={label}>Sub-kategori</label>
              <select
                value={form.subcategoryId}
                onChange={(e) => {
                  const id = e.target.value;
                  const sc = subcats.find((s) => s.id === id);
                  setForm((f) => ({ ...f, subcategoryId: id, subCategory: sc ? sc.nameId : '' }));
                  if (sc?.optionNames?.length && optNames.length === 0) {
                    setOptNames(sc.optionNames);
                    setOptValues((v) => {
                      const m = { ...v };
                      for (const n of sc.optionNames || []) {
                        m[n] = m[n] || (n.toLowerCase().includes('warna') || n.toLowerCase().includes('color') ? 'Putih, Ungu' : 'S, M, L, XL, 2XL, 3XL');
                      }
                      return m;
                    });
                  }
                }}
                className={input}
              >
                <option value="">— pilih sub-kategori —</option>
                {subcats.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.nameId} / {s.nameEn}</option>
                ))}
              </select>
            </div>
          </div>
          {form.category === 'FUNDRAISING' && (
            <div><label className={label}>Tipe Fundraising</label>
              <select value={form.fundraisingType} onChange={(e) => setForm({ ...form, fundraisingType: e.target.value })} className={input}>
                <option value="">— pilih —</option>
                <option value="SERVICE">Service (menyanyi, programmer, photographer…)</option>
                <option value="PRODUCT">Product (makanan, dessert…)</option>
              </select>
            </div>
          )}

          <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3 space-y-2">
            <p className={label}>Harga Modal</p>
            <div><label className={label}>Modal manual (Rp)</label><input inputMode="numeric" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
            <p className="text-[10px] text-[#8C8880]">atau hitung bulk: (COGS + operating cost) ÷ jumlah item</p>
            <div className="grid grid-cols-3 gap-2">
              <input inputMode="numeric" value={form.cogs} onChange={(e) => setForm({ ...form, cogs: e.target.value.replace(/[^0-9]/g, '') })} placeholder="COGS" className={input} />
              <input inputMode="numeric" value={form.operatingCost} onChange={(e) => setForm({ ...form, operatingCost: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Operasional" className={input} />
              <input inputMode="numeric" value={form.yieldQty} onChange={(e) => setForm({ ...form, yieldQty: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Jumlah item" className={input} />
            </div>
            {bulkModal != null && <p className="text-[10px] text-emerald-700">Modal bulk: <b>{rupiah(bulkModal)}</b> / item</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#1B1B1B]"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> <span className={form.isActive ? 'text-emerald-700' : 'text-red-600'}>Aktif (tampil di katalog)</span></label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.isOnSale} onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })} /> Sedang dijual</label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.isPreorder} onChange={(e) => setForm({ ...form, isPreorder: e.target.checked })} /> Pre-order</label>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="text-[10px] uppercase tracking-wider text-[#8C8880] w-full">Opsi pemenuhan (khusus makanan)</span>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.dineIn} onChange={(e) => setForm({ ...form, dineIn: e.target.checked })} /> Dine-in</label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.takeaway} onChange={(e) => setForm({ ...form, takeaway: e.target.checked })} /> Takeaway</label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.checked })} /> Antar</label>
          </div>

          {/* Varian (opsi + matriks) */}
          <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className={`${label} flex items-center gap-1`}><Ruler className="w-3 h-3" /> Opsi &amp; Varian</p>
              <button onClick={() => setOptNames((n) => [...n, ''])} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah opsi</button>
            </div>
            {optNames.length === 0 && (
              <p className="text-[10px] text-[#8C8880] italic">Belum ada opsi. Tambah mis. "Warna" dan "Ukuran", lalu tekan Hasilkan varian.</p>
            )}
            {optNames.map((n, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={n} onChange={(e) => setOptNames((ns) => ns.map((x, xi) => (xi === i ? e.target.value : x)))} placeholder="Nama opsi (mis. Warna)" className={`${input} w-36`} />
                <input value={optValues[n] || ''} onChange={(e) => setOptValues((v) => ({ ...v, [n]: e.target.value }))} placeholder="Nilai dipisah koma: Putih, Ungu" className={`${input} flex-1`} />
                <button onClick={() => setOptNames((ns) => ns.filter((_, xi) => xi !== i))} className="text-[10px] text-red-600 font-bold">×</button>
              </div>
            ))}
            {variantCount > 0 && (
              <button onClick={generateVariants} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">
                <Wand2 className="w-3.5 h-3.5" /> Hasilkan {variantCount} varian
              </button>
            )}
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[#8C8880]">
                      <th className="text-left py-1">Varian</th>
                      <th className="text-left">Harga</th>
                      <th className="text-left">Modal</th>
                      <th className="text-left">Stok</th>
                      <th className="text-left">SKU</th>
                      <th className="text-left">Gambar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={i} className="border-t border-[#EFEDE8]">
                        <td className="py-1 pr-2 whitespace-nowrap">{Object.entries(v.options || {}).map(([k, val]) => `${k}: ${val}`).join(' / ')}</td>
                        <td><input inputMode="numeric" value={v.price ?? ''} onChange={(e) => patchVariant(i, { price: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9]/g, '')) })} placeholder={form.price || '0'} className="w-20 px-2 py-1 rounded border border-[#D9D7D0]" /></td>
                        <td><input inputMode="numeric" value={v.buyPrice ?? ''} onChange={(e) => patchVariant(i, { buyPrice: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9]/g, '')) })} className="w-20 px-2 py-1 rounded border border-[#D9D7D0]" /></td>
                        <td><input inputMode="numeric" value={String(v.stock)} onChange={(e) => patchVariant(i, { stock: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} className="w-16 px-2 py-1 rounded border border-[#D9D7D0]" /></td>
                        <td><input value={v.sku ?? ''} onChange={(e) => patchVariant(i, { sku: e.target.value })} className="w-24 px-2 py-1 rounded border border-[#D9D7D0]" /></td>
                        <td>
                          <select value={v.imageFileId || ''} onChange={(e) => patchVariant(i, { imageFileId: e.target.value || null })} className="px-2 py-1 rounded border border-[#D9D7D0] max-w-[140px]">
                            <option value="">—</option>
                            {images.map((im) => (
                              <option key={im.url} value={im.driveFileId || im.url}>{im.name || im.caption || 'gambar'}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Foto produk */}
          <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className={label}>Foto produk (bisa banyak sekaligus)</p>
              {saved?.id && (
                <button onClick={() => fileRef.current?.click()} disabled={busyImgs} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1 disabled:opacity-50">
                  {busyImgs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Unggah foto
                </button>
              )}
            </div>
            {!saved?.id ? (
              <p className="text-[10px] text-[#8C8880] italic">Simpan produk dulu, lalu unggah foto (bisa pilih beberapa sekaligus).</p>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => { const fl = e.target.files; e.target.value = ''; await uploadMany(fl); }}
                />
                {images.length === 0 ? (
                  <p className="text-[10px] text-[#8C8880] italic">Belum ada foto. Nama file dipakai sebagai label agar mudah dipilih untuk varian.</p>
                ) : (
                  <div className="space-y-1.5">
                    {images.map((im, i) => (
                      <div key={im.url} className="flex items-center gap-2">
                        <img src={im.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#EFEDE8]" />
                        <input
                          value={im.name || ''}
                          onChange={(e) => void renameImage(i, e.target.value)}
                          placeholder="nama file / label"
                          className={`${input} flex-1`}
                        />
                        <button onClick={() => void removeImage(i)} className="text-[10px] text-red-600 font-bold">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {history.length > 0 && (
            <div className="rounded-xl border border-[#EFEDE8] p-3">
              <p className={`${label} flex items-center gap-1`}><History className="w-3 h-3" /> Riwayat harga</p>
              {history.slice(0, 6).map((h, i) => (
                <p key={i} className="text-[10px] text-[#8C8880]">
                  {new Date(h.changedAt).toLocaleDateString('id-ID')} · jual {rupiah(h.price)} · modal {h.buyPrice ? rupiah(h.buyPrice) : '—'}{h.note ? ` · ${h.note}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[#EFEDE8] flex gap-3 bg-white rounded-b-3xl">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Tutup</button>
          <button onClick={() => void save()} disabled={saving || !form.name} className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Order detail ----------------
function OrderDetailModal({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const update = async () => {
    if (status === 'CANCELLED' && !cancelReason.trim()) { alert('Alasan pembatalan wajib diisi.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/benzar/orders/${order.id}/status`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancelReason: cancelReason.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memperbarui status.');
      onChanged();
      onClose();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Pesanan {order.orderCode}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-[#8C8880]">Pembeli</span><span className="font-bold">{order.user?.name || order.guestName || '-'}{!order.userId ? ' (tamu)' : ''}</span></div>
          {!order.userId && order.guestPhone && <div className="flex justify-between"><span className="text-[#8C8880]">No. HP</span><span>{order.guestPhone}</span></div>}
          <div className="flex justify-between"><span className="text-[#8C8880]">Metode</span><span>{FULFILLMENT_LABELS[(order.fulfillment as Fulfillment) || 'PICKUP']}</span></div>
          <div className="flex justify-between"><span className="text-[#8C8880]">Subtotal</span><span>{rupiah(order.subtotal || order.total)}</span></div>
          {(order.discountTotal || 0) > 0 && <div className="flex justify-between text-emerald-700"><span>Diskon {order.promoCode ? `(${order.promoCode})` : ''}</span><span>-{rupiah(order.discountTotal || 0)}</span></div>}
          {(order.deliveryFee || 0) > 0 && <div className="flex justify-between"><span className="text-[#8C8880]">Ongkir</span><span>{rupiah(order.deliveryFee || 0)}</span></div>}
          <div className="flex justify-between font-bold"><span>Total</span><span className="text-[#F6AE4A]">{rupiah(order.total)}</span></div>
          {order.notes && <div className="text-xs text-[#8C8880]">Catatan: {order.notes}</div>}
          {order.cancelReason && <div className="text-xs text-red-600">Dibatalkan: {order.cancelReason}</div>}

          <div className="border-t border-[#D9D7D0] pt-3">
            <p className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-2">Item</p>
            {(order.items || []).map((item: any, i: number) => (
              <div key={i} className="flex justify-between py-1"><span>{item.name} × {item.qty}</span><span className="font-bold">{rupiah(item.price * item.qty)}</span></div>
            ))}
          </div>

          {(order.timeline || []).length > 0 && (
            <div className="border-t border-[#D9D7D0] pt-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-2">Jejak status</p>
              {(order.timeline || []).map((t, i) => (
                <p key={i} className="text-[11px] text-[#8C8880]">
                  • {STATUS_LABELS[t.status as OrderStatus] || t.status} — {new Date(t.at).toLocaleString('id-ID')}{t.note ? ` · ${t.note}` : ''}
                </p>
              ))}
            </div>
          )}

          <div className="border-t border-[#D9D7D0] pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#8C8880]">Ubah status</p>
            <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            {status === 'CANCELLED' && (
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Alasan pembatalan (wajib)" className={input} />
            )}
            <button onClick={() => void update()} disabled={busy || status === order.status} className="w-full py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">
              {busy ? 'Menyimpan…' : status === order.status ? 'Status tidak berubah' : `Simpan → ${STATUS_LABELS[status]}`}
            </button>
          </div>

          <div className="border-t border-[#D9D7D0] pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#8C8880]">Bukti & invoice (privat)</p>
            <div className="flex flex-wrap gap-2">
              <DriveUploadButton
                label="Unggah bukti TF"
                onFile={async (payload) => {
                  await fetch(`/api/benzar/orders/${order.id}/payment-proof`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, kind: 'proof' }) });
                  onChanged();
                }}
              />
              <DriveUploadButton
                label="Unggah invoice"
                onFile={async (payload) => {
                  await fetch(`/api/benzar/orders/${order.id}/payment-proof`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, kind: 'invoice' }) });
                  onChanged();
                }}
              />
            </div>
            <FileLinks orderId={order.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FileLinks({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<{ paymentProofUrl?: string | null; invoiceUrl?: string | null } | null>(null);
  useEffect(() => {
    fetch(`/api/benzar/orders/${orderId}/files`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then(setFiles).catch(() => {});
  }, [orderId]);
  if (!files) return null;
  return (
    <div className="flex gap-3 text-[11px]">
      {files.paymentProofUrl && <a href={files.paymentProofUrl} target="_blank" rel="noreferrer" className="font-bold text-sky-700">Lihat bukti TF</a>}
      {files.invoiceUrl && <a href={files.invoiceUrl} target="_blank" rel="noreferrer" className="font-bold text-sky-700">Lihat invoice</a>}
    </div>
  );
}

// ---------------- Promo form ----------------
function PromoFormModal({ promo, products, subcats, onClose, onSaved }: { promo: Promo | null; products: Product[]; subcats: BzpSubcategory[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: promo?.code || '',
    name: promo?.name || '',
    type: (promo?.type || 'AMOUNT') as 'PERCENT' | 'AMOUNT',
    value: promo?.value != null ? String(promo.value) : '',
    audience: (promo?.audience || 'ALL') as 'ALL' | 'GUEST' | 'MEMBER' | 'INTERNAL',
    scope: (promo?.scope || 'GLOBAL') as 'GLOBAL' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT',
    minSpend: promo?.minSpend != null ? String(promo.minSpend) : '',
    maxDiscount: promo?.maxDiscount != null ? String(promo.maxDiscount) : '',
    autoApply: promo?.autoApply ?? false,
    isActive: promo?.isActive ?? true,
  });
  const [targets, setTargets] = useState<string[]>(() => {
    const t = (promo as unknown as { targetIds?: unknown })?.targetIds;
    return Array.isArray(t) ? t.map(String) : [];
  });
  const [saving, setSaving] = useState(false);

  const toggleTarget = (v: string) =>
    setTargets((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        code: form.code,
        name: form.name,
        type: form.type,
        value: Number(form.value) || 0,
        audience: form.audience,
        scope: form.scope,
        targetIds: form.scope === 'GLOBAL' ? [] : targets,
        autoApply: form.autoApply,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        minSpend: Number(form.minSpend) || 0,
        isActive: form.isActive,
      };
      const url = promo ? `/api/benzar/promos/${promo.id}` : '/api/benzar/promos';
      const r = await fetch(url, { method: promo ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan promo.');
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-[#EFEDE8]">
          <h3 className="text-lg font-black">{promo ? 'Edit Promo' : 'Promo Baru'}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Kode</label><input value={form.code} disabled={!!promo} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${input} disabled:bg-[#FAF9F5]`} /></div>
            <div><label className={label}>Nama</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Tipe potongan</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className={input}>
                <option value="AMOUNT">Nominal (Rp)</option>
                <option value="PERCENT">Persen (%)</option>
              </select>
            </div>
            <div><label className={label}>{form.type === 'PERCENT' ? 'Persen (%)' : 'Nominal (Rp)'}</label><input inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
          </div>

          <div><label className={label}>Audiens</label>
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as any })} className={input}>
              <option value="ALL">Semua orang</option>
              <option value="MEMBER">Jemaat (login)</option>
              <option value="GUEST">Tamu (tanpa login)</option>
              <option value="INTERNAL">Internal (Komisi/Tim Kerja)</option>
            </select>
          </div>

          <div><label className={label}>Berlaku untuk</label>
            <select value={form.scope} onChange={(e) => { setForm({ ...form, scope: e.target.value as any }); setTargets([]); }} className={input}>
              <option value="GLOBAL">Semua produk</option>
              <option value="PRODUCT">Produk tertentu</option>
              <option value="CATEGORY">Kategori tertentu</option>
              <option value="SUBCATEGORY">Sub-kategori tertentu</option>
            </select>
          </div>

          {form.scope === 'PRODUCT' && (
            <div className="rounded-xl border border-[#EFEDE8] p-3 max-h-40 overflow-y-auto space-y-1">
              {products.filter((p) => p.isActive).map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-[#1B1B1B]">
                  <input type="checkbox" checked={targets.includes(p.id)} onChange={() => toggleTarget(p.id)} /> {p.name}
                </label>
              ))}
              {products.filter((p) => p.isActive).length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum ada produk aktif.</p>}
            </div>
          )}
          {form.scope === 'CATEGORY' && (
            <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-1">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-xs text-[#1B1B1B]">
                  <input type="checkbox" checked={targets.includes(c)} onChange={() => toggleTarget(c)} /> {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          )}
          {form.scope === 'SUBCATEGORY' && (
            <div className="rounded-xl border border-[#EFEDE8] p-3 max-h-40 overflow-y-auto space-y-1">
              {subcats.filter((s) => s.isActive).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-[#1B1B1B]">
                  <input type="checkbox" checked={targets.includes(s.slug)} onChange={() => toggleTarget(s.slug)} /> {s.nameId} / {s.nameEn}
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Min. belanja (Rp)</label><input inputMode="numeric" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
            <div><label className={label}>Maks. potongan (Rp, opsional)</label><input inputMode="numeric" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#1B1B1B]"><input type="checkbox" checked={form.autoApply} onChange={(e) => setForm({ ...form, autoApply: e.target.checked })} /> Terapkan otomatis (tanpa kode)</label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktif</label>
          </div>
          <p className="text-[10px] text-[#8C8880]">
            Contoh promo jemaat: Kode <b>JEMAAT25</b> · Nominal Rp25.000 · Audiens <b>Jemaat (login)</b> · Produk tertentu (Kaos) · Terapkan otomatis.
          </p>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[#EFEDE8] flex gap-3 bg-white rounded-b-3xl">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={() => void save()} disabled={saving || !form.code || !form.name} className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Campaign form ----------------
function CampaignFormModal({ campaign, onClose, onSaved }: { campaign: Campaign | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: campaign?.title || '',
    slug: campaign?.slug || '',
    description: campaign?.description || '',
    target: campaign?.target != null ? String(campaign.target) : '',
    isActive: campaign?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body = { title: form.title, slug: form.slug, description: form.description, target: Number(form.target) || 0, isActive: form.isActive };
      const url = campaign ? `/api/benzar/campaigns/${campaign.id}` : '/api/benzar/campaigns';
      const r = await fetch(url, { method: campaign ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan campaign.');
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">{campaign ? 'Edit Campaign' : 'Campaign Baru'}</h3>
        <div className="space-y-3">
          <div><label className={label}>Judul</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} /></div>
          <div><label className={label}>Slug (URL)</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="otomatis dari judul" className={input} /></div>
          <div><label className={label}>Deskripsi</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${input} h-24 resize-none`} /></div>
          <div><label className={label}>Target (Rp)</label><input inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></div>
          <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktif</label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={() => void save()} disabled={saving || !form.title} className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Shift form ----------------
function ShiftFormModal({ shift, onClose, onSaved }: { shift: SalesShift | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: shift?.title || 'Penjualan BZP',
    date: shift?.date || today,
    startTime: shift?.startTime || '08:00',
    endTime: shift?.endTime || '12:00',
    notes: shift?.notes || '',
  });
  const [savedId, setSavedId] = useState<string | null>(shift?.id || null);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<SalesShiftAssignment[]>(shift?.assignments || []);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');

  const loadRoles = useCallback(async () => {
    const r = await fetch('/api/benzar/sales-roles', { credentials: 'include' });
    const d = r.ok ? await r.json() : { roles: [] };
    setRoles((d.roles || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
  }, []);

  const refresh = useCallback(async (id: string) => {
    const r = await fetch('/api/benzar/sales-shifts', { credentials: 'include' });
    const d = r.ok ? await r.json() : { shifts: [] };
    const found = (d.shifts || []).find((s: SalesShift) => s.id === id);
    if (found) setAssignments(found.assignments || []);
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const searchPeople = useCallback(async (q: string) => {
    const r = await fetch(`/api/benzar/sales-people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d = r.ok ? await r.json() : { people: [] };
    return (d.people || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }));
  }, []);

  const save = async () => {
    setBusy('save');
    try {
      const body = { title: form.title, date: form.date, startTime: form.startTime, endTime: form.endTime, notes: form.notes };
      const url = savedId ? `/api/benzar/sales-shifts/${savedId}` : '/api/benzar/sales-shifts';
      const r = await fetch(url, { method: savedId ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan shift.');
      setSavedId(d.shift.id);
      setAssignments(d.shift.assignments || []);
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setBusy(null); }
  };

  const addPeople = async (roleId: string) => {
    if (!savedId) { alert('Simpan shift dulu.'); return; }
    const userIds = picked[roleId] || [];
    if (!userIds.length) return;
    setBusy(`add-${roleId}`);
    try {
      const r = await fetch(`/api/benzar/sales-shifts/${savedId}/assignments/bulk`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesRoleIds: [roleId], userIds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menambah petugas.');
      setPicked((m) => ({ ...m, [roleId]: [] }));
      await refresh(savedId);
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setBusy(null); }
  };

  const setAssignStatus = async (id: string, status: string) => {
    await fetch(`/api/benzar/sales-assignments/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (savedId) await refresh(savedId);
  };

  const removeAssignment = async (id: string) => {
    await fetch(`/api/benzar/sales-assignments/${id}`, { method: 'DELETE', credentials: 'include' });
    if (savedId) await refresh(savedId);
  };

  const addRole = async () => {
    if (!newRole.trim()) return;
    await fetch('/api/benzar/sales-roles', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newRole.trim() }) });
    setNewRole('');
    await loadRoles();
  };

  const byRole = (roleId: string) => assignments.filter((a) => a.salesRoleId === roleId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-[#EFEDE8]">
          <h3 className="text-lg font-black">{shift ? 'Kelola Jadwal Jual' : 'Jadwal Jual Baru'}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className={label}>Judul</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} /></div>
            <div><label className={label}>Tanggal</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></div>
            <div><label className={label}>Mulai</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={input} /></div>
            <div><label className={label}>Selesai</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={input} /></div>
          </div>
          <div><label className={label}>Catatan</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} h-16 resize-none`} /></div>

          <button onClick={() => void save()} disabled={busy === 'save' || !form.title} className="w-full py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {busy === 'save' ? 'Menyimpan…' : savedId ? 'Simpan Perubahan' : 'Simpan Shift'}
          </button>

          {savedId && (
            <div className="space-y-3">
              <p className={`${label} flex items-center gap-1.5`}><Users className="w-3.5 h-3.5" /> Petugas per role (cari Komisi & Tim Kerja)</p>
              {roles.map((role) => (
                <div key={role.id} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-[#1B1B1B]">{role.name}</p>
                    <span className="text-[10px] text-[#8C8880]">{byRole(role.id).length} orang</span>
                  </div>
                  <SearchableMultiSelect
                    values={picked[role.id] || []}
                    onSearch={searchPeople}
                    onChange={(vals) => setPicked((m) => ({ ...m, [role.id]: vals }))}
                    exclude={byRole(role.id).map((a) => a.userId || '').filter(Boolean)}
                    placeholder="Cari nama (Komisi/Tim Kerja)…"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => void addPeople(role.id)} disabled={busy === `add-${role.id}` || !(picked[role.id] || []).length} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
                      {busy === `add-${role.id}` ? 'Menambah…' : 'Tambah petugas'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {byRole(role.id).map((a) => (
                      <span key={a.id} className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${a.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : a.status === 'DECLINED' ? 'bg-red-50 text-red-600' : 'bg-[#FAF9F5] text-[#8C8880]'}`}>
                        {a.name}
                        <select value={a.status} onChange={(e) => void setAssignStatus(a.id, e.target.value)} className="bg-transparent text-[10px]">
                          <option value="INVITED">Diundang</option>
                          <option value="CONFIRMED">Konfirmasi</option>
                          <option value="DECLINED">Tolak</option>
                        </select>
                        <button onClick={() => void removeAssignment(a.id)} className="text-red-600">×</button>
                      </span>
                    ))}
                    {byRole(role.id).length === 0 && <span className="text-[10px] text-[#8C8880] italic">Belum ada petugas.</span>}
                  </div>
                </div>
              ))}
              {roles.length === 0 && <p className="text-[11px] text-[#8C8880] italic">Daftar role belum ada — tambahkan di bawah.</p>}
              <div className="flex gap-2">
                <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Tambah role baru…" className={`${input} flex-1`} />
                <button onClick={() => void addRole()} className="px-3 rounded-xl border border-[#D9D7D0] text-xs font-bold">Tambah role</button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[#EFEDE8] flex gap-3 bg-white rounded-b-3xl">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Settings ----------------
function SettingsPanel({ settings, onSaved, notify }: { settings: BzpSettings | null; onSaved: () => void; notify: (m: string) => void }) {
  const [picIds, setPicIds] = useState<string[]>(Array.isArray(settings?.picUserIds) ? settings.picUserIds.map(String) : []);
  const [picPrefs, setPicPrefs] = useState<Array<{ name: string; phone: string }>>([]);
  const [schedule, setSchedule] = useState<Array<{ name: string; phone: string; role: string }>>([]);
  const [deliveryFee, setDeliveryFee] = useState(settings?.deliveryFee != null ? String(settings.deliveryFee) : '0');
  const [waGroupUrl, setWaGroupUrl] = useState(settings?.waGroupUrl || '');
  const [qrisImage, setQrisImage] = useState(settings?.qris?.imageUrl || '');
  const [qrisMerchant, setQrisMerchant] = useState(settings?.qris?.merchantName || '');
  const [qrisInstructions, setQrisInstructions] = useState(settings?.qris?.instructions || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPicIds(Array.isArray(settings?.picUserIds) ? settings.picUserIds.map(String) : []);
    setDeliveryFee(settings?.deliveryFee != null ? String(settings.deliveryFee) : '0');
    setWaGroupUrl(settings?.waGroupUrl || '');
    setQrisImage(settings?.qris?.imageUrl || '');
    setQrisMerchant(settings?.qris?.merchantName || '');
    setQrisInstructions(settings?.qris?.instructions || '');
  }, [settings]);

  useEffect(() => {
    fetch('/api/benzar/pic', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { pics: [], schedule: [] }))
      .then((d) => { setPicPrefs(d.pics || []); setSchedule(d.schedule || []); })
      .catch(() => {});
  }, [settings]);

  const searchPicPeople = useCallback(async (q: string) => {
    const r = await fetch('/api/benzar/sales-people?q=' + encodeURIComponent(q), { credentials: 'include' });
    const d = r.ok ? await r.json() : { people: [] };
    return (d.people || []).map((p: { id: string; name: string; phone?: string }) => ({ value: p.id, label: p.name, hint: p.phone || '' }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/benzar/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picUserIds: picIds.slice(0, 3),
          deliveryFee: Number(deliveryFee) || 0,
          waGroupUrl,
          qris: { imageUrl: qrisImage, merchantName: qrisMerchant, instructions: qrisInstructions },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan pengaturan.');
      onSaved();
      notify('Pengaturan BZP tersimpan');
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-4 max-w-2xl">
      <div>
        <label className={label}>PIC BZP (maks 3) � nama & nomor dari database</label>
        <SearchableMultiSelect
          values={picIds}
          selectedOptions={picPrefs.map((p) => ({ value: (p as any).id || p.name, label: p.name, hint: p.phone }))}
          onSearch={searchPicPeople}
          onChange={(vals) => setPicIds(vals.slice(0, 3))}
          max={3}
          placeholder="Cari nama PIC (Komisi/Tim Kerja)�"
        />
        <div className="mt-2 space-y-1">
          {picPrefs.map((p) => (
            <p key={p.name} className="text-[11px] text-[#1B1B1B]">
              <b>{p.name}</b>{(p as any).role ? <span className="text-[#8C8880]"> � {(p as any).role}</span> : null} � <span className="font-mono">{p.phone || '(nomor belum diisi)'}</span>
            </p>
          ))}
          {picPrefs.length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum ada PIC � default Bendahara Tim Kerja.</p>}
        </div>
        {schedule.length > 0 && (
          <div className="mt-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Penanggung jawab Jadwal Jual terdekat</p>
            {schedule.map((s, i) => (
              <p key={i} className="text-[11px] text-[#1B1B1B]">{s.name} <span className="text-[#8C8880]">� {s.role}</span>{s.phone ? ` � ${s.phone}` : ''}</p>
            ))}
          </div>
        )}
      </div>      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Ongkir default (Rp)</label><input inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9]/g, ''))} className={input} /></div>
        <div><label className={label}>Link grup WA (opsional)</label><input value={waGroupUrl} onChange={(e) => setWaGroupUrl(e.target.value)} placeholder="https://chat.whatsapp.com/…" className={input} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>QRIS image URL</label><input value={qrisImage} onChange={(e) => setQrisImage(e.target.value)} placeholder="/Gopay QRIS.png" className={input} /></div>
        <div><label className={label}>Nama merchant QRIS</label><input value={qrisMerchant} onChange={(e) => setQrisMerchant(e.target.value)} className={input} /></div>
      </div>
      <div><label className={label}>Instruksi pembayaran</label><textarea value={qrisInstructions} onChange={(e) => setQrisInstructions(e.target.value)} className={`${input} h-16 resize-none`} /></div>
      <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Simpan pengaturan
      </button>
    </div>
  );
}

// ---------------- Katalog sub-kategori + size chart ----------------
function CatalogPanel({ subcats, onChanged, notify }: { subcats: BzpSubcategory[]; onChanged: () => void; notify: (m: string) => void }) {
  const [editing, setEditing] = useState<BzpSubcategory | null>(null);
  const [showForm, setShowForm] = useState(false);

  const remove = async (id: string) => {
    if (!confirm('Nonaktifkan sub-kategori ini?')) return;
    await fetch(`/api/benzar/subcategories/${id}`, { method: 'DELETE', credentials: 'include' });
    onChanged();
    notify('Sub-kategori dinonaktifkan');
  };

  const groups = Array.from(new Set(subcats.map((s) => s.group || 'Lain')));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold">
          <Plus className="w-4 h-4" /> Sub-kategori Baru
        </button>
      </div>
      {groups.map((g) => (
        <div key={g} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
          <p className="text-[11px] font-black text-[#1B1B1B] mb-2">{g}</p>
          <div className="flex flex-wrap gap-2">
            {subcats.filter((s) => (s.group || 'Lain') === g).map((s) => (
              <div key={s.id} className={`rounded-xl border px-3 py-2 ${s.isActive ? 'border-[#EFEDE8] bg-[#FAF9F5]' : 'border-dashed border-[#D9D7D0] opacity-60'}`}>
                <p className="text-xs font-bold">{s.nameId} <span className="text-[#8C8880] font-normal">/ {s.nameEn}</span></p>
                <p className="text-[10px] text-[#8C8880]">
                  {s.hasSize ? 'ada ukuran' : 'tanpa ukuran'}{s.sizeChart ? ' � size chart' : ''}{s.optionNames?.length ? ` � ${s.optionNames.join('+')}` : ''}
                </p>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setEditing(s); setShowForm(true); }} className="text-[10px] font-bold text-sky-700">Edit</button>
                  {s.isActive && <button onClick={() => void remove(s.id)} className="text-[10px] font-bold text-red-600">Nonaktifkan</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {subcats.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada sub-kategori. Tambahkan atau jalankan seed katalog.</p>}

      {showForm && (
        <SubcatFormModal
          subcat={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); onChanged(); notify('Sub-kategori tersimpan'); }}
        />
      )}
    </div>
  );
}

function SubcatFormModal({ subcat, onClose, onSaved }: { subcat: BzpSubcategory | null; onClose: () => void; onSaved: () => void }) {
  const sc = subcat?.sizeChart || null;
  const [form, setForm] = useState({
    nameId: subcat?.nameId || '',
    nameEn: subcat?.nameEn || '',
    slug: subcat?.slug || '',
    group: subcat?.group || 'Fashion',
    hasSize: subcat?.hasSize ?? false,
    optionNames: (subcat?.optionNames || []).join(', '),
    isActive: subcat?.isActive ?? true,
    columns: (sc?.columns || ['SIZE', 'PANJANG (cm)', 'LEBAR (cm)']).join(', '),
    rows: (sc?.rows || []).map((r) => r.join(', ')).join('\n'),
    notes: (sc?.notes || []).join('\n'),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const sizeChart: BzpSizeChart | null = form.columns.trim() || form.rows.trim()
        ? {
            columns: form.columns.split(',').map((x) => x.trim()).filter(Boolean),
            rows: form.rows.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((r) => r.some(Boolean)),
            notes: form.notes.split('\n').map((x) => x.trim()).filter(Boolean),
          }
        : null;
      const body = {
        nameId: form.nameId,
        nameEn: form.nameEn,
        slug: form.slug || undefined,
        group: form.group,
        hasSize: form.hasSize,
        optionNames: form.optionNames.split(',').map((x) => x.trim()).filter(Boolean),
        isActive: form.isActive,
        sizeChart,
      };
      const url = subcat ? `/api/benzar/subcategories/${subcat.id}` : '/api/benzar/subcategories';
      const r = await fetch(url, { method: subcat ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan sub-kategori.');
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">{subcat ? 'Edit Sub-kategori' : 'Sub-kategori Baru'}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Nama (ID)</label><input value={form.nameId} onChange={(e) => setForm({ ...form, nameId: e.target.value })} className={input} /></div>
            <div><label className={label}>Nama (EN)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={input} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Grup</label>
              <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={input}>
                {['Fashion', 'Drinkware', 'Food', 'Lain'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><label className={label}>Slug (opsional)</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className={input} /></div>
          </div>
          <div><label className={label}>Opsi varian default (pisah koma)</label><input value={form.optionNames} onChange={(e) => setForm({ ...form, optionNames: e.target.value })} placeholder="Warna, Ukuran" className={input} /></div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.hasSize} onChange={(e) => setForm({ ...form, hasSize: e.target.checked })} /> Punya ukuran (size chart)</label>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8880]"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktif</label>
          </div>
          <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3 space-y-2">
            <p className={label}>Size chart (opsional)</p>
            <div><label className={label}>Kolom (pisah koma)</label><input value={form.columns} onChange={(e) => setForm({ ...form, columns: e.target.value })} className={input} /></div>
            <div><label className={label}>Baris (satu baris per ukuran, sel dipisah koma)</label><textarea value={form.rows} onChange={(e) => setForm({ ...form, rows: e.target.value })} rows={5} placeholder={'XS, 62, 45, Dewasa\nS, 68, 47, Dewasa'} className={`${input} font-mono`} /></div>
            <div><label className={label}>Catatan (satu per baris)</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={input} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={() => void save()} disabled={saving || !form.nameId} className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">{saving ? 'Menyimpan�' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}