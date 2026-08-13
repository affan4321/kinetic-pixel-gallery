import { useEffect, useRef, useState } from "react";

/**
 * Bronze cursor: a ring that lerps toward the pointer and swaps into a
 * labelled disc when hovering elements carrying `data-cursor`.
 */
export function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setEnabled(true);

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { ...target };
    let raf = 0;

    const loop = () => {
      pos.x += (target.x - pos.x) * 0.16;
      pos.y += (target.y - pos.y) * 0.16;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      }
      if (dot.current) {
        dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      setVisible(true);

      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-cursor], a, button",
      ) as HTMLElement | null;
      if (!el) {
        setActive(false);
        setLabel(null);
        return;
      }
      setActive(true);
      setLabel(el.dataset["cursor"] ?? null);
    };

    const onLeave = () => setVisible(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.documentElement.classList.add("custom-cursor");

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms" }}
    >
      <div
        ref={ring}
        className="fixed left-0 top-0 flex items-center justify-center rounded-full border border-primary text-primary-foreground"
        style={{
          width: label ? 112 : active ? 56 : 38,
          height: label ? 112 : active ? 56 : 38,
          backgroundColor: label
            ? "var(--color-primary)"
            : active
              ? "color-mix(in oklab, var(--color-primary) 18%, transparent)"
              : "transparent",
          transition:
            "width 500ms cubic-bezier(0.16,1,0.3,1), height 500ms cubic-bezier(0.16,1,0.3,1), background-color 350ms",
        }}
      >
        <span
          className="text-[10px] font-semibold uppercase text-primary-foreground"
          style={{ opacity: label ? 1 : 0, transition: "opacity 250ms", letterSpacing: "0.18em" }}
        >
          {label}
        </span>
      </div>
      <div
        ref={dot}
        className="fixed left-0 top-0 size-1.5 rounded-full bg-primary"
        style={{ opacity: label ? 0 : 1, transition: "opacity 200ms" }}
      />
    </div>
  );
}
