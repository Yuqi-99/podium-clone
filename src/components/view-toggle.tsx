"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import art from "@/data/view-toggle-art.json";

const corners = [[0, 0], [50, 0], [98, 0], [98, 50], [50, 50], [0, 50]];

export default function ViewToggle({ list, onClick, buttonRef }: {
  list: boolean;
  onClick: () => void;
  buttonRef: React.RefObject<HTMLDivElement | null>;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const progress = useRef(0);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const pixels = element.querySelectorAll("[data-view-pixel]");
    const frame = element.querySelectorAll("[data-frame-square]");
    const position = (index: number, amount: number) => {
      const start = corners[index];
      const end = corners[(index + 1) % corners.length];
      return { x: start[0] + (end[0] - start[0]) * amount, y: start[1] + (end[1] - start[1]) * amount };
    };
    const pixel = (index: number) => {
      if (!list) return art.list[index];
      const target = art.grid[index % art.grid.length];
      return { ...target, opacity: index < art.grid.length ? target.opacity : 0 };
    };
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { duration: .48, ease: "power3.inOut", overwrite: true } });
      timeline.to(frame, { attr: { x: (i: number) => position(i, list ? 0 : progress.current).x, y: (i: number) => position(i, list ? 0 : progress.current).y } }, 0);
      timeline.to(pixels, { attr: { x: (i: number) => pixel(i).x, y: (i: number) => pixel(i).y }, opacity: (i: number) => pixel(i).opacity, stagger: { amount: .08, from: "center" } }, 0);
      timeline.to('[data-title="list"]', { y: list ? -14 : 0, opacity: Number(!list), duration: .32 }, .04);
      timeline.to('[data-title="grid"]', { y: list ? 0 : 14, opacity: Number(list), duration: .32 }, .1);
    }, element);
    const update = () => {
      const work = document.getElementById("work");
      if (!work) return;
      const rect = work.getBoundingClientRect();
      const amount = Math.min(1, Math.max(0, (innerHeight * .8 - rect.top) / Math.max(1, rect.height - innerHeight * .2)));
      if (amount === progress.current) return;
      progress.current = amount;
      if (!list) gsap.set(frame, { attr: { x: (i: number) => position(i, amount).x, y: (i: number) => position(i, amount).y } });
    };
    gsap.ticker.add(update);
    return () => { gsap.ticker.remove(update); context.revert(); };
  }, [list]);
  return <div className="view-toggle-wrap" ref={buttonRef}>
    <button ref={root} type="button" className="view-toggle" aria-pressed={list} aria-label={list ? "Open grid view" : "Open list view"} onClick={onClick}>
      <span className="view-toggle-art" dangerouslySetInnerHTML={{ __html: art.svg }} />
    </button>
  </div>;
}
