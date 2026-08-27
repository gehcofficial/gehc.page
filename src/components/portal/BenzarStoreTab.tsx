import React, { useEffect, useState, useCallback } from 'react';
import {
  Store,
  Package,
  ShoppingCart,
  Plus,
  Edit2,
  Trash2,
  Search,
  Eye,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import type { Product, ProductCategory, Order, OrderStatus } from '../../types/benzar';
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_LABELS, STATUS_COLORS } from '../../types/benzar';

const CATEGORIES: ProductCategory[] = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];
const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'VERIFIED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface Props { eventId: string; division: string; }

export default function BenzarStoreTab({ eventId, division }: Props) {
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const r = await fetch('/api/benzar/products', { credentials: 'include' });
      const d = await r.json();
      setProducts(d.products || []);
    } catch { /* skip */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch('/api/benzar/orders', { credentials: 'include' });
      const d = await r.json();
      setOrders(d.orders || []);
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProducts(), fetchOrders()]).finally(() => setLoading(false));
  }, [fetchProducts, fetchOrders]);

  const filteredProducts = products
    .filter(p => filterCategory === 'ALL' || p.category === filterCategory)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const filteredOrders = orders
    .filter(o => filterStatus === 'ALL' || o.status === filterStatus);

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const r = await fetch(`/api/benzar/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (r.ok) fetchOrders();
    } catch { /* skip */ }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return;
    await fetch(`/api/benzar/products/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchProducts();
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'products' ? 'bg-[#F6AE4A] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#8C8880] border border-[#D9D7D0]'
          }`}
        >
          <Package className="w-4 h-4" /> Produk
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'orders' ? 'bg-[#F6AE4A] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#8C8880] border border-[#D9D7D0]'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Pesanan ({orders.length})
        </button>
      </div>

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
              />
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
            >
              <option value="ALL">Semua Kategori</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <button
              onClick={() => { setEditingProduct(null); setShowProductForm(true); }}
              className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#E5A03F]"
            >
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D9D7D0]/50 text-left text-[10px] uppercase tracking-wider text-[#8C8880]">
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-right">Harga</th>
                    <th className="px-4 py-3 text-right">Stok</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[#8C8880]">Belum ada produk</td></tr>
                  ) : filteredProducts.map(p => (
                    <tr key={p.id} className="border-b border-[#D9D7D0]/30 hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3">
                        <p className="font-bold">{p.name}</p>
                        <p className="text-[10px] text-[#8C8880] truncate max-w-[200px]">{p.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[p.category as ProductCategory] + '20', color: CATEGORY_COLORS[p.category as ProductCategory] }}>
                          {CATEGORY_LABELS[p.category as ProductCategory]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatRupiah(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${p.stock <= 5 ? 'text-red-500' : ''}`}>{p.stock}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingProduct(p); setShowProductForm(true); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteProduct(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
            >
              <option value="ALL">Semua Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D9D7D0]/50 text-left text-[10px] uppercase tracking-wider text-[#8C8880]">
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Shipping</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8C8880]">Belum ada pesanan</td></tr>
                  ) : filteredOrders.map(o => (
                    <tr key={o.id} className="border-b border-[#D9D7D0]/30 hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3 font-mono text-xs font-bold">{o.orderCode}</td>
                      <td className="px-4 py-3">{o.user?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatRupiah(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status as OrderStatus]?.bg} ${STATUS_COLORS[o.status as OrderStatus]?.text}`}>
                          {STATUS_LABELS[o.status as OrderStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{o.shipping}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSelectedOrder(o)} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                            <div className="relative group">
                              <button className="p-1.5 rounded-lg hover:bg-gray-100">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute right-0 top-full z-10 hidden group-hover:block bg-white border border-[#D9D7D0] rounded-xl shadow-lg py-1 min-w-[140px]">
                                {STATUSES.filter(s => s !== o.status).slice(0, 4).map(s => (
                                  <button key={s} onClick={() => updateOrderStatus(o.id, s)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#FAF9F5]">
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
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

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
          onSaved={() => { setShowProductForm(false); setEditingProduct(null); fetchProducts(); }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Pesanan {selectedOrder.orderCode}</h3>
              <button onClick={() => setSelectedOrder(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#8C8880]">Customer</span><span className="font-bold">{selectedOrder.user?.name}</span></div>
              <div className="flex justify-between"><span className="text-[#8C8880]">Total</span><span className="font-bold text-[#F6AE4A]">{formatRupiah(selectedOrder.total)}</span></div>
              <div className="flex justify-between"><span className="text-[#8C8880]">Status</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedOrder.status as OrderStatus]?.bg} ${STATUS_COLORS[selectedOrder.status as OrderStatus]?.text}`}>
                  {STATUS_LABELS[selectedOrder.status as OrderStatus]}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-[#8C8880]">Shipping</span><span>{selectedOrder.shipping}</span></div>
              <div className="border-t border-[#D9D7D0] pt-3">
                <p className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-2">Items</p>
                {selectedOrder.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between py-1">
                    <span>{item.name} × {item.qty}</span>
                    <span className="font-bold">{formatRupiah(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Product Form Modal
function ProductFormModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    stock: product?.stock || 0,
    category: (product?.category || 'MERCHANDISE') as ProductCategory,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const method = product ? 'PATCH' : 'POST';
      const url = product ? `/api/benzar/products/${product.id}` : '/api/benzar/products';
      await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">{product ? 'Edit Produk' : 'Tambah Produk'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Nama Produk</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm h-20 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Harga (Rp)</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Stok</label>
              <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Kategori</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ProductCategory })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={handleSubmit} disabled={saving || !form.name}
            className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
