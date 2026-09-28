import React from 'react';

interface ChurchCrestProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'emblem' | 'watermark';
  color?: string;
}

/**
 * Crest GMIM Eben Haezer Cikarang (vektor statis) — dipakai sebagai emblem
 * hero & watermark hub. Diadaptasi dari mock desain (tanpa aset biner).
 */
export const ChurchCrest: React.FC<ChurchCrestProps> = ({
  className = '',
  size = 48,
  variant = 'full',
  color = 'currentColor',
}) => {
  if (variant === 'watermark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none pointer-events-none ${className}`}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="crestWatermarkGlow" cx="200" cy="200" r="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7E22CE" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#6B21A8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#581C87" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="200" cy="200" r="185" fill="url(#crestWatermarkGlow)" />
        <circle cx="200" cy="200" r="188" stroke={color} strokeWidth="2.5" strokeDasharray="6 4" />
        <circle cx="200" cy="200" r="178" stroke={color} strokeWidth="3.5" />
        <circle cx="200" cy="200" r="142" stroke={color} strokeWidth="2" />

        <path id="crestTextUpper" d="M 52,200 A 148,148 0 1,1 348,200" fill="none" />
        <path id="crestTextLower" d="M 348,200 A 148,148 0 0,1 52,200" fill="none" />

        <text fill={color} fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle">
          <textPath href="#crestTextUpper" startOffset="50%">
            GEREJA MASEHI INJILI DI MINAHASA
          </textPath>
        </text>
        <text fill={color} fontSize="13" fontWeight="bold" letterSpacing="5" textAnchor="middle">
          <textPath href="#crestTextLower" startOffset="50%">
            • GMIM EBEN HAEZER CIKARANG •
          </textPath>
        </text>

        <path d="M 50,196 L 54,200 L 50,204 L 46,200 Z" fill={color} />
        <path d="M 350,196 L 354,200 L 350,204 L 346,200 Z" fill={color} />

        <g stroke={color} strokeWidth="1.75" strokeLinecap="round" opacity="0.65">
          <line x1="200" y1="90" x2="200" y2="70" />
          <line x1="230" y1="98" x2="242" y2="84" />
          <line x1="255" y1="120" x2="272" y2="110" />
          <line x1="265" y1="150" x2="285" y2="145" />
          <line x1="170" y1="98" x2="158" y2="84" />
          <line x1="145" y1="120" x2="128" y2="110" />
          <line x1="135" y1="150" x2="115" y2="145" />
          <line x1="225" y1="190" x2="245" y2="205" strokeDasharray="3 3" />
          <line x1="175" y1="190" x2="155" y2="205" strokeDasharray="3 3" />
        </g>

        <g fill={color}>
          <rect x="190" y="75" width="20" height="175" rx="3" />
          <rect x="142" y="125" width="116" height="20" rx="3" />
          <line x1="200" y1="80" x2="200" y2="245" stroke="white" strokeWidth="2" opacity="0.4" />
          <line x1="148" y1="135" x2="252" y2="135" stroke="white" strokeWidth="2" opacity="0.4" />
        </g>

        <g fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round">
          <path d="M 200,105 C 192,105 185,110 188,118 C 190,123 194,126 197,133 C 198,136 199,142 200,146 C 201,142 202,136 203,133 C 206,126 210,123 212,118 C 215,110 208,105 200,105 Z" />
          <path d="M 193,115 C 180,105 160,100 135,108 C 142,117 155,122 170,124 C 152,126 142,132 138,138 C 152,138 165,134 182,128 C 189,126 192,122 193,115 Z" />
          <path d="M 207,115 C 220,105 240,100 265,108 C 258,117 245,122 230,124 C 248,126 258,132 262,138 C 248,138 235,134 218,128 C 211,126 208,122 207,115 Z" />
          <path d="M 198,145 L 194,158 L 200,155 L 206,158 L 202,145 Z" />
          <path d="M 200,105 Q 200,98 206,95 Q 202,96 198,96" fill="none" stroke={color} strokeWidth="1.5" />
        </g>

        <g stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 200,240 C 182,232 152,234 135,242 L 135,275 C 152,267 182,265 200,273 C 218,265 248,267 265,275 L 265,242 C 248,234 218,232 200,240 Z" fill={color} fillOpacity="0.12" />
          <line x1="200" y1="240" x2="200" y2="273" strokeWidth="3" />
          <line x1="145" y1="250" x2="188" y2="246" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="145" y1="257" x2="188" y2="253" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="145" y1="264" x2="185" y2="260" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="212" y1="246" x2="255" y2="250" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="212" y1="253" x2="255" y2="257" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="215" y1="260" x2="255" y2="264" strokeWidth="1.5" strokeDasharray="3 2" />
        </g>

        <g stroke={color} strokeWidth="2" strokeLinecap="round" fill={color} fillOpacity="0.6">
          <path d="M 125,282 Q 155,302 195,304" fill="none" />
          <ellipse cx="132" cy="280" rx="6" ry="3" transform="rotate(-30 132 280)" />
          <ellipse cx="148" cy="289" rx="6" ry="3" transform="rotate(-15 148 289)" />
          <ellipse cx="166" cy="296" rx="6" ry="3" transform="rotate(5 166 296)" />
          <ellipse cx="184" cy="301" rx="6" ry="3" transform="rotate(20 184 301)" />
          <path d="M 275,282 Q 245,302 205,304" fill="none" />
          <ellipse cx="268" cy="280" rx="6" ry="3" transform="rotate(30 268 280)" />
          <ellipse cx="252" cy="289" rx="6" ry="3" transform="rotate(15 252 289)" />
          <ellipse cx="234" cy="296" rx="6" ry="3" transform="rotate(-5 234 296)" />
          <ellipse cx="216" cy="301" rx="6" ry="3" transform="rotate(-20 216 301)" />
        </g>

        <path d="M 145,315 L 255,315 L 245,327 L 155,327 Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
        <text x="200" y="324" fill={color} fontSize="9" fontWeight="bold" letterSpacing="3" textAnchor="middle">
          EBEN HAEZER · 1934
        </text>
      </svg>
    );
  }

  // Emblem / full — lambang gereja untuk hero, header, badge.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="crestPurpleGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B21A8" />
          <stop offset="0.5" stopColor="#7E22CE" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="crestGoldCross" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="1" stopColor="#EAB308" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill="url(#crestPurpleGrad)" stroke="#C084FC" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="44" stroke="#F3E8FF" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />

      <g stroke="#FDE047" strokeWidth="1" opacity="0.6">
        <line x1="50" y1="22" x2="50" y2="18" />
        <line x1="58" y1="25" x2="62" y2="21" />
        <line x1="64" y1="31" x2="68" y2="28" />
        <line x1="42" y1="25" x2="38" y2="21" />
        <line x1="36" y1="31" x2="32" y2="28" />
      </g>

      <rect x="47.5" y="22" width="5" height="42" rx="1" fill="url(#crestGoldCross)" />
      <rect x="36" y="32" width="28" height="5" rx="1" fill="url(#crestGoldCross)" />

      <g fill="#FFFFFF">
        <path d="M 50,28 C 47,28 45,30 46,33 C 47,35 48,36 49,39 C 50,40 50,42 50,43 C 50,42 50,40 51,39 C 52,36 53,35 54,33 C 55,30 53,28 50,28 Z" />
        <path d="M 48,31 C 44,27 38,26 31,28 C 33,31 37,33 41,33 C 36,34 33,36 32,38 C 36,38 39,37 44,35 C 46,34 47,33 48,31 Z" />
        <path d="M 52,31 C 56,27 62,26 69,28 C 67,31 63,33 59,33 C 64,34 67,36 68,38 C 64,38 61,37 56,35 C 54,34 53,33 52,31 Z" />
      </g>

      <g fill="#FFFFFF" stroke="#9333EA" strokeWidth="0.5">
        <path d="M 50,58 C 45,55 37,56 32,59 L 32,68 C 37,65 45,64 50,67 C 55,64 63,65 68,68 L 68,59 C 63,56 55,55 50,58 Z" />
        <line x1="50" y1="58" x2="50" y2="67" stroke="#9333EA" strokeWidth="1" />
      </g>

      <text x="50" y="82" fill="#FFFFFF" fontSize="6.5" fontWeight="bold" letterSpacing="1.5" textAnchor="middle">
        GMIM GEHC
      </text>
      <text x="50" y="89" fill="#E9D5FF" fontSize="4.5" fontWeight="medium" letterSpacing="1" textAnchor="middle">
        EBEN HAEZER
      </text>
    </svg>
  );
};

export default ChurchCrest;
