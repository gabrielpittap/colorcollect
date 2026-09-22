import React, { useState, useRef } from 'react';
import { ImagePixelizer } from '../tools/ImagePixelizer';
import { BoardGrid, ColorDef } from '../core/Types';
import { Camera, Image as ImageIcon, Sparkles, X, Sliders } from 'lucide-react';

interface PhotoPixelizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLevel: (grid: BoardGrid, palette: Record<string, ColorDef>, name: string) => void;
}

export const PhotoPixelizerModal: React.FC<PhotoPixelizerModalProps> = ({
  isOpen,
  onClose,
  onApplyLevel,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<number>(14);
  const [numColors, setNumColors] = useState<number>(4);
  const [previewResult, setPreviewResult] = useState<{
    grid: BoardGrid;
    palette: Record<string, ColorDef>;
    previewDataUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setImageSrc(src);
        processPreview(src, gridSize, numColors);
      };
      reader.readAsDataURL(file);
    }
  };

  const processPreview = (src: string, size: number, colors: number) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const result = ImagePixelizer.processImage(img, {
        width: size,
        height: size,
        numColors: colors,
      });
      setPreviewResult(result);
    };
    img.src = src;
  };

  const handleApply = () => {
    if (previewResult) {
      onApplyLevel(previewResult.grid, previewResult.palette, 'Fase Personalizada (Foto)');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-slate-100 text-base">
              Pixelizador de Fotos (Foto → Fase Jogável)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Upload Area */}
          {!imageSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-cyan-400/80 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-950/60 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-200 text-sm">
                  Clique ou arraste uma foto/imagem aqui
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Suporta PNG, JPG, JPEG, WebP
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Preview Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">
                    Imagem Original
                  </span>
                  <div className="w-full h-44 rounded-xl border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center">
                    <img
                      src={imageSrc}
                      alt="Original"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400">
                    Resultado Pixelizado ({gridSize}x{gridSize})
                  </span>
                  <div className="w-full h-44 rounded-xl border border-cyan-500/40 overflow-hidden bg-slate-950 flex items-center justify-center p-2">
                    {previewResult ? (
                      <div
                        className="grid gap-0.5"
                        style={{
                          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                        }}
                      >
                        {previewResult.grid.map((row, y) =>
                          row.map((cell, x) => (
                            <div
                              key={`${x}-${y}`}
                              className="w-2.5 h-2.5 rounded-[1px]"
                              style={{
                                backgroundColor: cell
                                  ? previewResult.palette[cell]?.hex
                                  : 'transparent',
                              }}
                            />
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Ajustes de Resolução e Cores
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 flex justify-between mb-1.5 font-medium">
                      <span>Tamanho da Grade</span>
                      <strong className="text-slate-200">{gridSize}x{gridSize}</strong>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={20}
                      step={2}
                      value={gridSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setGridSize(val);
                        if (imageSrc) processPreview(imageSrc, val, numColors);
                      }}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 flex justify-between mb-1.5 font-medium">
                      <span>Total de Cores</span>
                      <strong className="text-slate-200">{numColors} cores</strong>
                    </label>
                    <input
                      type="range"
                      min={3}
                      max={6}
                      step={1}
                      value={numColors}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNumColors(val);
                        if (imageSrc) processPreview(imageSrc, gridSize, val);
                      }}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-cyan-400 hover:underline self-center font-medium"
              >
                Trocar imagem selecionada
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!previewResult}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            Gerar Fase Desta Imagem
          </button>
        </div>
      </div>
    </div>
  );
};
