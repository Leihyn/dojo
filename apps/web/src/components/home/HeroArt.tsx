/**
 * Flat dojo-hall scene. The sky is the hero's CSS background, so this SVG starts at the mountains
 * and sits in its own band below the headline: no glyph can land on a drawn element.
 * Hex values here are the illustration palette (see --art-* in globals.css).
 */
function Pine({ x, y, s = 1, light = false, tall = false }: { x: number; y: number; s?: number; light?: boolean; tall?: boolean }) {
  const a = light ? "#5c9877" : "#4f8a6b";
  const b = light ? "#4a8365" : "#3f7559";
  return tall ? (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-9" y="120" width="18" height="120" fill="#7a4a2e" />
      <path d="M0 0 L66 76 H34 L88 144 H-88 L-34 76 H-66Z" fill={a} />
      <path d="M0 0 L66 76 H34 L88 144 H0Z" fill={b} />
    </g>
  ) : (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-8" y="110" width="16" height="110" fill="#7a4a2e" />
      <path d="M0 0 L60 70 H30 L80 130 H-80 L-30 70 H-60Z" fill={a} />
      <path d="M0 0 L60 70 H30 L80 130 H0Z" fill={b} />
    </g>
  );
}

function StoneLantern({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 700)`}>
      <rect x="-6" y="20" width="12" height="44" fill="#a8a59b" /><rect x="-20" y="10" width="40" height="14" fill="#bdb9ae" />
      <path d="M-26 10 L0 -10 L26 10Z" fill="#8f8c83" /><rect x="-16" y="62" width="32" height="10" fill="#8f8c83" />
      <rect x="-6" y="12" width="12" height="10" fill="#f8d98f" />
    </g>
  );
}

function Lantern({ x }: { x: number }) {
  return (
    <g className="hm-sway">
      <path d={`M${x} 588 V604`} stroke="#55301d" strokeWidth="2" />
      <rect x={x - 12} y="604" width="24" height="34" rx="10" fill="#c8553d" />
      <rect x={x - 9} y="602" width="18" height="5" fill="#33424f" /><rect x={x - 9} y="636" width="18" height="5" fill="#33424f" />
    </g>
  );
}

function Hall() {
  return (
    <g>
      <rect x="500" y="712" width="640" height="34" fill="#d9c8a6" /><rect x="500" y="712" width="640" height="6" fill="#c9b690" />
      <rect x="760" y="746" width="120" height="12" fill="#cdbb95" /><rect x="745" y="758" width="150" height="12" fill="#c4b18b" />
      <rect x="548" y="580" width="544" height="132" fill="url(#hm-shoji)" />
      <g fill="#7a4a2e"><rect x="540" y="575" width="16" height="140" /><rect x="624" y="580" width="12" height="132" /><rect x="708" y="580" width="12" height="132" /><rect x="920" y="580" width="12" height="132" /><rect x="1004" y="580" width="12" height="132" /><rect x="1084" y="575" width="16" height="140" /></g>
      <rect x="548" y="578" width="544" height="10" fill="#55301d" />
      <rect x="732" y="604" width="176" height="108" fill="#3b2a20" /><rect x="732" y="604" width="176" height="108" fill="#f3d9a0" opacity=".18" />
      <path d="M744 712 L770 640 H870 L896 712Z" fill="#a37a52" />
      <rect x="732" y="598" width="176" height="6" fill="#55301d" />
      <rect x="738" y="604" width="52" height="44" fill="#0fa37f" /><rect x="794" y="604" width="52" height="44" fill="#0fa37f" /><rect x="850" y="604" width="52" height="44" fill="#0fa37f" />
      <circle cx="820" cy="624" r="11" fill="none" stroke="#fafaf7" strokeWidth="3" />
      <path d="M452 588 Q505 586 530 540 L1110 540 Q1135 586 1188 588 L1180 598 Q1110 596 1084 572 L556 572 Q530 596 460 598Z" fill="#26323c" />
      <path d="M462 584 Q512 580 536 532 L1104 532 Q1128 580 1178 584 L1170 590 Q1112 588 1094 562 L546 562 Q528 588 470 590Z" fill="url(#hm-tiles)" />
      <rect x="640" y="470" width="360" height="66" fill="url(#hm-shoji)" />
      <g fill="#7a4a2e"><rect x="634" y="466" width="12" height="72" /><rect x="994" y="466" width="12" height="72" /><rect x="814" y="470" width="12" height="66" /></g>
      <rect x="640" y="466" width="360" height="8" fill="#55301d" />
      <path d="M568 482 Q620 480 650 436 L770 388 H870 L990 436 Q1020 480 1072 482 L1064 492 Q1010 490 984 462 L656 462 Q630 490 576 492Z" fill="#26323c" />
      <path d="M578 478 Q626 474 656 428 L772 380 H868 L984 428 Q1014 474 1062 478 L1054 484 Q1008 482 988 454 L652 454 Q632 482 586 484Z" fill="url(#hm-tiles)" />
      <path d="M760 386 L820 352 L880 386Z" fill="#7a4a2e" /><path d="M776 384 L820 360 L864 384Z" fill="#f6eedc" />
      <rect x="758" y="372" width="124" height="10" rx="3" fill="#26323c" />
      <path d="M748 372 Q754 360 764 362 L764 374Z M892 372 Q886 360 876 362 L876 374Z" fill="#26323c" />
      <Lantern x={600} /><Lantern x={1040} />
    </g>
  );
}

export function HeroArt() {
  return (
    <svg viewBox="0 300 1600 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" data-hero-art>
      <defs>
        <pattern id="hm-shoji" width="26" height="30" patternUnits="userSpaceOnUse"><rect width="26" height="30" fill="#f6eedc" /><path d="M13 0V30M0 15H26" stroke="#d8c9a8" strokeWidth="1.5" /></pattern>
        <pattern id="hm-tiles" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#33424f" /><path d="M0 9.5H14" stroke="#26323c" strokeWidth="1.5" /></pattern>
      </defs>
      <circle cx="1310" cy="404" r="88" fill="#f8d98f" opacity=".22" />
      <circle cx="1310" cy="404" r="56" fill="#f8d98f" />
      <g className="hm-cloud" fill="#fff" opacity=".85"><rect x="960" y="352" width="190" height="34" rx="17" /><rect x="1010" y="330" width="110" height="34" rx="17" /></g>
      <g className="hm-cloud hm-cloud-b" fill="#fff" opacity=".7"><rect x="200" y="378" width="160" height="28" rx="14" /><rect x="235" y="360" width="80" height="28" rx="14" /></g>
      <path d="M0 560 L180 430 L300 500 L470 360 L640 520 L760 470 L900 540 L1080 400 L1250 520 L1400 440 L1600 540 V900 H0Z" fill="#cfe1dc" />
      <path d="M470 360 L520 405 L495 400 L470 420 L448 398 L425 405Z M1080 400 L1125 438 L1100 434 L1080 452 L1060 435 L1038 440Z" fill="#fff" opacity=".8" />
      <path d="M0 640 Q200 560 420 610 T860 600 T1300 590 T1600 610 V900 H0Z" fill="#a8cbb6" />
      <path d="M0 720 Q400 690 800 700 T1600 715 V900 H0Z" fill="#ecdcbc" />
      <Pine x={250} y={520} /><Pine x={130} y={560} s={0.75} light />
      <Pine x={1380} y={500} tall /><Pine x={1500} y={560} s={0.7} light tall />
      <Hall />
      <path d="M745 770 H895 L1010 900 H630Z" fill="#f4e8cd" />
      <g fill="#d6c4a0"><ellipse cx="820" cy="790" rx="40" ry="8" /><ellipse cx="814" cy="818" rx="50" ry="10" /><ellipse cx="826" cy="852" rx="60" ry="12" /><ellipse cx="816" cy="888" rx="70" ry="13" /></g>
      <StoneLantern x={640} /><StoneLantern x={1000} />
      <g fill="#6aa384"><ellipse cx="460" cy="742" rx="70" ry="26" /><ellipse cx="1180" cy="742" rx="80" ry="28" /><ellipse cx="60" cy="800" rx="120" ry="40" /><ellipse cx="1560" cy="806" rx="120" ry="40" /></g>
      <g fill="#5a9475"><ellipse cx="420" cy="750" rx="40" ry="18" /><ellipse cx="1220" cy="752" rx="46" ry="18" /></g>
    </svg>
  );
}
