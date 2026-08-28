import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  requireTypeConfirmation?: boolean;
  typeConfirmationText?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  variant = 'danger',
  loading = false,
  requireTypeConfirmation = false,
  typeConfirmationText = 'HAPUS',
}: ConfirmationModalProps) {
  const [typeInput, setTypeInput] = React.useState('');

  const handleConfirm = () => {
    if (requireTypeConfirmation && typeInput !== typeConfirmationText) {
      return;
    }
    onConfirm();
    setTypeInput('');
  };

  const variantStyles = {
    danger: {
      iconColor: 'text-red-500',
      borderColor: 'border-red-200',
      bgColor: 'bg-red-50',
      confirmBg: 'bg-red-600 hover:bg-red-700',
      icon: <AlertTriangle className="w-8 h-8" />,
    },
    warning: {
      iconColor: 'text-amber-500',
      borderColor: 'border-amber-200',
      bgColor: 'bg-amber-50',
      confirmBg: 'bg-amber-600 hover:bg-amber-700',
      icon: <AlertTriangle className="w-8 h-8" />,
    },
    info: {
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
      icon: <CheckCircle2 className="w-8 h-8" />,
    },
  };

  const styles = variantStyles[variant];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-[28px] w-full max-w-md shadow-2xl border border-gray-100">
        <div className={`p-6 text-center ${styles.bgColor} rounded-t-[28px] border-b border-gray-100`}>
          <div className={`mx-auto mb-3 ${styles.iconColor}`}>{styles.icon}</div>
          <h3 className="text-lg font-black text-[#1B1B1B]">{title}</h3>
          <p className="text-sm text-[#8C8880] mt-2">{message}</p>
        </div>

        <div className="p-6 space-y-4">
          {requireTypeConfirmation && (
            <div className="text-left">
              <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider mb-2">
                Ketik "{typeConfirmationText}" untuk konfirmasi
              </p>
              <input
                type="text"
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
                placeholder={`Ketik ${typeConfirmationText}`}
                className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-mono focus:outline-none focus:border-black"
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (requireTypeConfirmation && typeInput !== typeConfirmationText)}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${styles.confirmBg}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}