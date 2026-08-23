/**
 * Dashcam Heads-Up Display (HUD) Overlay
 * 
 * Renders live AR reticle, estimated pothole dimensions (diameter, depth, area),
 * speed telemetry, and torch controls over the camera viewfinder.
 */
'use client';

import React from 'react';
import { Flashlight, Sparkles, Activity, Disc } from 'lucide-react';
import { VisionAnalysisResult } from '../hooks/useDashcam';

interface DashcamHudOverlayProps {
  isStreaming: boolean;
  isTorchOn: boolean;
  torchSupported?: boolean;
  isProcessingBgFrame: boolean;
  onToggleTorch: () => void;
  lastVisionResult: VisionAnalysisResult | null;
  speedKmh?: number;
  potholeCount?: number;
}

export function DashcamHudOverlay({
  isStreaming,
  isTorchOn,
  torchSupported = true,
  isProcessingBgFrame,
  onToggleTorch,
  lastVisionResult,
  speedKmh = 0,
  potholeCount = 0,
}: DashcamHudOverlayProps) {
  if (!isStreaming) return null;

  const hasResult = lastVisionResult !== null;
  const diameter = hasResult ? `~${lastVisionResult.estimatedDiameterCm} cm` : '—';
  const area = hasResult ? `${lastVisionResult.estimatedAreaM2} m²` : '—';
  const depth = hasResult ? `~${lastVisionResult.estimatedDepthCm} cm` : '—';
  const damageType = hasResult ? lastVisionResult.damageType : 'Imbasan Aktif';
  const urgency = hasResult ? lastVisionResult.urgency : 'MENUNGGU';

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 overflow-hidden select-none">
      {/* Top telemetry HUD header bar */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-mono font-semibold tracking-wider text-emerald-400 uppercase">
            IMBASAN JALAN RAYA • RAKAM
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isProcessingBgFrame && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 px-3 py-1 rounded-full text-amber-300 text-xs font-medium animate-pulse">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Sedang Mengimbas...</span>
            </div>
          )}

          {torchSupported && (
            <button
              type="button"
              onClick={onToggleTorch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all text-xs font-semibold ${
                isTorchOn
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]'
                  : 'bg-black/60 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              <Flashlight className={`w-3.5 h-3.5 ${isTorchOn ? 'fill-black' : ''}`} />
              <span>{isTorchOn ? 'LED TERANG' : 'LAMPU LED'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Center AR Reticle Target Bounding Box */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-44 border-2 border-dashed border-cyan-400/60 rounded-2xl flex flex-col justify-between p-2 shadow-[0_0_30px_rgba(6,182,212,0.2)] bg-cyan-950/10">
        {/* Corner Target Markers */}
        <div className="flex justify-between">
          <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
        </div>

        {/* Live AR Measurements Readout */}
        <div className="bg-black/80 backdrop-blur-md rounded-xl p-2.5 border border-cyan-500/30 text-center shadow-lg pointer-events-auto">
          <div className="flex items-center justify-center gap-1.5 mb-1 text-cyan-400 text-[10px] font-mono font-bold uppercase">
            <Disc className="w-3 h-3 animate-spin text-cyan-400" />
            <span>PENGESANAN KEROSAKAN JALAN</span>
          </div>

          <div className="grid grid-cols-3 gap-1 py-1 border-y border-zinc-800 text-white font-mono">
            <div>
              <div className="text-[9px] text-zinc-400 uppercase">DIAMETER</div>
              <div className="text-xs font-bold text-cyan-300">{diameter}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400 uppercase">KELUASAN</div>
              <div className="text-xs font-bold text-emerald-300">{area}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400 uppercase">KEDALAMAN</div>
              <div className="text-xs font-bold text-amber-300">{depth}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-medium pt-1 text-zinc-300">
            <span className="flex items-center gap-1 text-cyan-400">
              <Activity className="w-3 h-3" /> {damageType}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] ${
              hasResult ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {urgency}
            </span>
          </div>
        </div>

        <div className="flex justify-between">
          <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
        </div>
      </div>

      {/* Bottom Telemetry Footer */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-zinc-300 text-xs font-mono">
          <span>KELAJUAN: </span>
          <span className="text-emerald-400 font-bold">{speedKmh} km/j</span>
        </div>

        <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-zinc-300 text-xs font-mono">
          <span>JUMLAH IMPAK: </span>
          <span className="text-amber-400 font-bold">{potholeCount} Impak</span>
        </div>
      </div>
    </div>
  );
}
