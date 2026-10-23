"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const FOUR_COLUMN_DRIFTS = [-250, 200, -150, 130];
const THREE_COLUMN_DRIFTS = [-200, 250, -150];
const SINGLE_COLUMN_DRIFTS = [0];

/** Mirrors the original card timeline: the anchor moves; its two children fade independently. */
export function useProjectGridMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const grid = scope.querySelector<HTMLElement>(".project-grid");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".project-card"));
    if (!cards.length) return;
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      const fade = (columns: number, drifts: number[]) => {
        for (let index = 0; index < cards.length; index += 1) {
          const cover = cards[index].querySelector<HTMLElement>(".project-cover");
          const caption = cards[index].querySelector<HTMLElement>(".project-caption");
          if (!cover || !caption) continue;
          const offset = Math.round(-.5 * (drifts[index % columns] ?? 0));
          const offsetExpression = offset >= 0 ? `+=${offset}` : `-=${-offset}`;
          for (const target of [cover, caption]) {
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: target,
                start: `top bottom${offsetExpression}`,
                end: `bottom top${offsetExpression}`,
                scrub: true,
              },
            });
            timeline.fromTo(target, { opacity: 0 }, { opacity: 1, ease: "linear", duration: .3 }, 0);
            timeline.to(target, { opacity: 0, ease: "linear", duration: .45 }, .75);
          }
        }
      };
      const move = (drifts: number[]) => {
        cards.forEach((card, index) => {
          gsap.to(card, {
            y: drifts[index % drifts.length] / 1512 * window.innerWidth,
            ease: "none",
            scrollTrigger: { trigger: grid, start: "top bottom", end: "bottom top", scrub: 1 },
          });
        });
      };

      media.add("(min-width: 1280px)", () => {
        move(FOUR_COLUMN_DRIFTS);
        fade(4, FOUR_COLUMN_DRIFTS);
      });
      media.add("(min-width: 768px) and (max-width: 1279.98px)", () => {
        move(THREE_COLUMN_DRIFTS);
        fade(3, THREE_COLUMN_DRIFTS);
      });
      media.add("(max-width: 767.98px)", () => fade(1, SINGLE_COLUMN_DRIFTS));
      return () => media.revert();
    }, scope);

    const cleanupHover: (() => void)[] = [];
    for (const card of cards) {
      const cover = card.querySelector<HTMLElement>(".project-cover");
      const halo = card.querySelector<HTMLElement>(".project-card-halo");
      if (!cover || !halo) continue;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const move = (event: PointerEvent) => {
        if (timeout) { clearTimeout(timeout); timeout = undefined; }
        const box = cover.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100));
        const y = Math.max(0, Math.min(100, (event.clientY - box.top) / box.height * 100));
        const radius = Math.min(box.width, box.height) * .7;
        halo.style.background = `radial-gradient(circle ${radius}px at ${x}% ${y}%, rgba(255,255,255,.6) 0%, rgba(255,255,255,.2) 40%, transparent 70%)`;
        halo.style.opacity = "1";
      };
      const leave = () => {
        halo.style.opacity = "0";
        timeout = setTimeout(() => { halo.style.background = ""; timeout = undefined; }, 400);
      };
      cover.addEventListener("pointerenter", move);
      cover.addEventListener("pointermove", move);
      cover.addEventListener("pointerleave", leave);
      cleanupHover.push(() => {
        if (timeout) clearTimeout(timeout);
        cover.removeEventListener("pointerenter", move);
        cover.removeEventListener("pointermove", move);
        cover.removeEventListener("pointerleave", leave);
        halo.style.background = "";
        halo.style.opacity = "";
      });
    }

    return () => {
      for (const cleanup of cleanupHover) cleanup();
      context.revert();
    };
  }, [root]);
}
