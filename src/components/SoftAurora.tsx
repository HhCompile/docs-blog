import React from 'react'

interface SoftAuroraProps {
  color1?: string
  color2?: string
  color3?: string
  color4?: string
  speed?: number
  opacity?: number
  blur?: number
}

export default function SoftAurora({
  color1 = '#3b82f6',
  color2 = '#60a5fa',
  color3 = '#818cf8',
  color4 = '#a78bfa',
  speed = 1,
  opacity = 0.35,
  blur = 120,
}: SoftAuroraProps) {
  // 暗色模式下自动降低 opacity 避免过亮
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden aurora-container"
      style={{ zIndex: 0 }}
    >
      <div
        className="absolute rounded-full aurora-blob"
        style={{
          width: 800,
          height: 800,
          background: `radial-gradient(circle at center, ${color1} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity,
          animation: `aurora-float-1 ${20 / speed}s ease-in-out infinite alternate`,
          top: '-20%',
          left: '-10%',
        }}
      />
      <div
        className="absolute rounded-full aurora-blob"
        style={{
          width: 600,
          height: 600,
          background: `radial-gradient(circle at center, ${color2} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.8,
          animation: `aurora-float-2 ${25 / speed}s ease-in-out infinite alternate`,
          top: '40%',
          right: '-10%',
        }}
      />
      <div
        className="absolute rounded-full aurora-blob"
        style={{
          width: 700,
          height: 700,
          background: `radial-gradient(circle at center, ${color3} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.7,
          animation: `aurora-float-3 ${22 / speed}s ease-in-out infinite alternate`,
          bottom: '-15%',
          left: '30%',
        }}
      />
      <div
        className="absolute rounded-full aurora-blob"
        style={{
          width: 500,
          height: 500,
          background: `radial-gradient(circle at center, ${color4} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.6,
          animation: `aurora-float-4 ${18 / speed}s ease-in-out infinite alternate`,
          top: '-10%',
          right: '20%',
        }}
      />

      <style>{`
        @keyframes aurora-float-1 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(12%, 8%) scale(1.08); }
        }
        @keyframes aurora-float-2 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-8%, -12%) scale(0.94); }
        }
        @keyframes aurora-float-3 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-10%, 6%) scale(1.05); }
        }
        @keyframes aurora-float-4 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(8%, -10%) scale(0.92); }
        }

        /* 暗色模式：进一步降低 opacity */
        .dark .aurora-container .aurora-blob {
          opacity: calc(var(--aurora-opacity, 0.35) * 0.55) !important;
        }
      `}</style>
    </div>
  )
}
