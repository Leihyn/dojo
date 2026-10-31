"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const PIN_QUERY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

/**
 * A pinned scroll chapter. It only publishes scroll progress as the CSS variable --p (0 to 1);
 * home.css turns that into transform and opacity. When pinning is off (narrow screens or reduced
 * motion) the variable is removed and the CSS default of 1 shows the final state.
 */
export function Chapter({ len, className, labelledBy, children }: { len: string; className: string; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia(PIN_QUERY);
    let raf = 0;
    let visible = false;
    const update = () => {
      raf = 0;
      if (!mq.matches) { el.style.removeProperty("--p"); return; }
      const span = el.offsetHeight - window.innerHeight;
      const p = span <= 0 ? 1 : Math.min(1, Math.max(0, -el.getBoundingClientRect().top / span));
      el.style.setProperty("--p", p.toFixed(4));
    };
    const schedule = () => { if (visible && !raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    io.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mq.addEventListener("change", update);
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mq.removeEventListener("change", update);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={ref} aria-labelledby={labelledBy} className={`hm-bleed hm-chapter ${className}`} style={{ "--len": len } as CSSProperties}>
      <div className="hm-pin">{children}</div>
    </section>
  );
}
