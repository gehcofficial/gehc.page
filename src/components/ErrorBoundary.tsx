import { Component, type ReactNode } from 'react';
import { recoverBrokenClientCache } from '../lib/pwa-install';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reload() {
    window.location.reload();
  }

  recover() {
    void recoverBrokenClientCache().then(() => window.location.reload());
  }

  render() {
    if (!this.state.error) return this.props.children;
    const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
    return (
      <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#D9D7D0] bg-white p-6 space-y-4">
          <h1 className="text-lg font-black">
            {en ? 'The portal failed to load' : 'Portal gagal dimuat'}
          </h1>
          <p className="text-sm text-[#8C8880] leading-relaxed">
            {en
              ? 'This is often a stale app cache on iPhone/Safari. Reload, or clear the cache and try again.'
              : 'Ini sering terjadi karena cache aplikasi lama di iPhone/Safari. Muat ulang, atau bersihkan cache lalu coba lagi.'}
          </p>
          <p className="text-[11px] font-mono text-[#8C8880] break-all">
            {this.state.error.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => this.reload()}
              className="flex-1 py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold"
            >
              {en ? 'Reload' : 'Muat ulang'}
            </button>
            <button
              type="button"
              onClick={() => this.recover()}
              className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold"
            >
              {en ? 'Clear cache & reload' : 'Bersihkan cache & muat ulang'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
