import React from 'react';
import { X } from 'lucide-react';

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div
        className={`bg-white rounded-card-lg border border-line/60 shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between p-5 border-b border-line/40">
            {title && <h3 className="text-sm font-bold text-ink">{title}</h3>}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-page ml-auto">
              <X className="w-4 h-4 text-muted" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
