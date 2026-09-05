import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  animate?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className = '',
  animate = false,
}) => {
  const sizeConfig = {
    sm: {
      box: 'w-10 h-10',
      text: 'text-lg',
      sub: 'text-[7px]',
      letter: 'text-lg mb-[-2px]',
    },
    md: {
      box: 'w-12 h-12',
      text: 'text-xl',
      sub: 'text-[8px]',
      letter: 'text-xl mb-[-4px]',
    },
    lg: {
      box: 'w-16 h-16',
      text: 'text-2xl',
      sub: 'text-[10px]',
      letter: 'text-2xl mb-[-4px]',
    },
    xl: {
      box: 'w-24 h-24',
      text: 'text-4xl',
      sub: 'text-xs',
      letter: 'text-4xl mb-[-6px]',
    },
  };

  const dim = sizeConfig[size];

  return (
    <div className={`inline-flex items-center space-x-3 select-none ${className}`}>
      {/* Glowing Geometric Triangle with G */}
      <div className={`relative ${dim.box} flex items-center justify-center shrink-0`}>
        <div className={`absolute inset-0 bg-white/10 blur-md rounded-full ${animate ? 'animate-pulse' : ''}`} />
        <svg
          viewBox="0 0 100 92"
          className="relative z-10 w-full h-full drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="50,6 94,86 6,86"
            fill="rgba(0,0,0,0.6)"
            stroke="white"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <text
            x="50"
            y="67"
            fill="white"
            fontSize="46"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
          >
            G
          </text>
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center space-x-1.5">
            <span className={`${dim.text} font-black tracking-wider text-white leading-none`}>
              GREY
            </span>
            <span className={`${dim.text} font-light tracking-wider text-white/90 leading-none`}>
              IA
            </span>
          </div>
          {showSubtitle && (
            <p className={`${dim.sub} uppercase tracking-[0.2em] text-white/40 mt-1 font-medium`}>
              Tu Herramienta Definitiva de IA
            </p>
          )}
        </div>
      )}
    </div>
  );
};

