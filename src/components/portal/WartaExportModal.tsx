import React, { useState, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Share2, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface WartaExportModalProps {
  warta: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function WartaExportModal({ warta, isOpen, onClose }: WartaExportModalProps) {
  const [step, setStep] = useState<'select' | 'generating' | 'preview' | 'done'>('select');
  const [format, setFormat] = useState<'pdf' | 'png' | 'both'>('pdf');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setStep('select');
    setProgress(0);
    setError(null);
    setPreviewUrl(null);
    onClose();
  };

  const generatePDF = useCallback(async () => {
    if (!contentRef.current) return;
    setStep('generating');
    setProgress(10);
    setError(null);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FAF9F5',
        onclone: (clonedDoc) => {
          // Remove export buttons from clone
          const buttons = clonedDoc.querySelectorAll('[data-export-ignore]');
          buttons.forEach(b => b.remove());
        },
      });

      setProgress(50);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10; // 10mm top margin

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20; // subtract page height minus margins

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 20;
      }

      setProgress(90);

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      
      if (format === 'both') {
        // Also generate PNG
        setProgress(95);
        const pngCanvas = await html2canvas(contentRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FAF9F5',
        });
        const pngUrl = pngCanvas.toDataURL('image/png', 1.0);
        setPreviewUrl(pngUrl);
      } else {
        setPreviewUrl(url);
      }

      setProgress(100);
      setStep('done');
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Gagal generate PDF: ' + err.message);
      setStep('select');
    }
  }, [format]);

  const generatePNG = useCallback(async () => {
    if (!contentRef.current) return;
    setStep('generating');
    setProgress(10);
    setError(null);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FAF9F5',
        onclone: (clonedDoc) => {
          const buttons = clonedDoc.querySelectorAll('[data-export-ignore]');
          buttons.forEach(b => b.remove());
        },
      });

      setProgress(80);
      const pngUrl = canvas.toDataURL('image/png', 1.0);
      setPreviewUrl(pngUrl);
      setProgress(100);
      setStep('done');
    } catch (err) {
      console.error('PNG generation error:', err);
      setError('Gagal generate PNG: ' + err.message);
      setStep('select');
    }
  }, []);

  const handleGenerate = () => {
    if (format === 'png') generatePNG();
    else generatePDF();
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${warta?.title || 'warta'}-${new Date().toISOString().split('T')[0]}.${format === 'png' ? 'png' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(previewUrl);
  };

  const handleShare = async () => {
    if (!previewUrl) return;
    if (navigator.share && format === 'png') {
      try {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const file = new File([blob], `${warta?.title || 'warta'}.png`, { type: 'image/png' });
        await navigator.share({ files: [file], title: warta?.title });
      } catch { /* ignore */ }
    }
  };

  if (!isOpen) return null;

  const weekDate = warta?.weekDate ? new Date(warta.weekDate).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }) : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={handleClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#D9D7D0] sticky top-0 bg-white rounded-t-3xl">
          <h3 className="text-lg font-black text-[#1B1B1B]">Export Warta</h3>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-gray-100 text-[#8C8880]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Select Format */}
        {step === 'select' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F6AE4A] to-[#E89B3A] flex items-center justify-center text-white font-bold text-xs shrink-0">G</div>
              <div>
                <p className="font-bold text-sm text-[#1B1B1B]">{warta?.title}</p>
                <p className="text-xs text-[#8C8880]">{weekDate}</p>
              </div>
            </div>

            <p className="text-sm text-[#8C8880]">Pilih format export:</p>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`p-4 rounded-xl border-2 text-center transition-all ${format === 'pdf' ? 'border-[#F6AE4A] bg-[#FFF8F0]' : 'border-[#D9D7D0] hover:border-[#F6AE4A]'}`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${format === 'pdf' ? 'text-[#F6AE4A]' : 'text-[#8C8880]'}`} />
                <p className="text-sm font-bold text-[#1B1B1B]">PDF</p>
                <p className="text-[10px] text-[#8C8880]">Untuk cetak</p>
              </button>

              <button
                onClick={() => setFormat('png')}
                className={`p-4 rounded-xl border-2 text-center transition-all ${format === 'png' ? 'border-[#F6AE4A] bg-[#FFF8F0]' : 'border-[#D9D7D0] hover:border-[#F6AE4A]'}`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${format === 'png' ? 'text-[#F6AE4A]' : 'text-[#8C8880]'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
                <p className="text-sm font-bold text-[#1B1B1B]">PNG</p>
                <p className="text-[10px] text-[#8C8880]">Untuk sosmed</p>
              </button>

              <button
                onClick={() => setFormat('both')}
                className={`p-4 rounded-xl border-2 text-center transition-all ${format === 'both' ? 'border-[#F6AE4A] bg-[#FFF8F0]' : 'border-[#D9D7D0] hover:border-[#F6AE4A]'}`}
              >
                <Share2 className={`w-8 h-8 mx-auto mb-2 ${format === 'both' ? 'text-[#F6AE4A]' : 'text-[#8C8880]'}`} />
                <p className="text-sm font-bold text-[#1B1B1B]">Keduanya</p>
                <p className="text-[10px] text-[#8C8880]">PDF + PNG</p>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={step === 'generating'}
              className="w-full py-3 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === 'generating' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyiapkan...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate & Download
                </>
              )}
            </button>

            <button onClick={handleClose} className="w-full py-2 text-sm font-bold text-[#8C8880] hover:text-[#1B1B1B]">
              Batal
            </button>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === 'generating' && (
          <div className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#F6AE4A] mx-auto mb-4" />
            <p className="font-bold text-[#1B1B1B] mb-2">Mengenerate {format.toUpperCase()}...</p>
            <p className="text-sm text-[#8C8880] mb-4">{Math.round(progress)}% selesai</p>
            <div className="w-full max-w-md mx-auto h-2 bg-[#D9D7D0] rounded-full overflow-hidden">
              <div className="h-full bg-[#F6AE4A] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && previewUrl && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-[#8C8880] text-center">Pratinjau {format.toUpperCase()}</p>
            <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
              {format === 'pdf' ? (
                <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />
              ) : (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] font-bold flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
              <button onClick={handleShare} className="flex-1 py-3 rounded-xl border border-[#D9D7D0] text-[#8C8880] font-bold hover:bg-gray-50 flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Bagikan
              </button>
              <button onClick={() => setStep('select')} className="px-4 py-3 rounded-xl text-[#8C8880] font-bold hover:text-[#1B1B1B]">
                Ulangi
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-black text-[#1B1B1B] mb-2">{format.toUpperCase()} Siap!</h3>
            <p className="text-sm text-[#8C8880] mb-6">File telah digenerate dan siap di-download</p>
            <div className="flex gap-3">
              <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] font-bold flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
              <button onClick={handleShare} className="flex-1 py-3 rounded-xl border border-[#D9D7D0] text-[#8C8880] font-bold hover:bg-gray-50 flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Bagikan
              </button>
            </div>
            <button onClick={handleClose} className="mt-4 w-full py-2 text-sm font-bold text-[#8C8880] hover:text-[#1B1B1B]">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  );
}