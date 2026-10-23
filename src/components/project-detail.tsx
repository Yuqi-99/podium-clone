"use client";

import Link from "next/link";
import gsap from "gsap";
import { useLenis } from "lenis/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaAsset, Project, ProjectBlock } from "@/types/content";
import ProjectFrameIcon from "@/components/project-frame-icon";
import { ProjectLoop, ProjectVideo, projectVideoSource } from "@/components/project-video";
import styles from "@/components/project-detail.module.css";

type NativeFilmVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

type OpenImage = { media: MediaAsset; origin: DOMRect; trigger: HTMLButtonElement };



function useModalFocus(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const lenis = useLenis();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    document.dispatchEvent(new CustomEvent("podium:overlay", { detail: { open: true } }));
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = ref.current?.querySelectorAll<HTMLElement>('button, input, [href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      lenis?.start();
      document.dispatchEvent(new CustomEvent("podium:overlay", { detail: { open: false } }));
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose, ref, lenis]);
}

function ImageLightbox({ image, onClose }: { image: OpenImage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const element = imageRef.current;
    if (!element) { onClose(); return; }
    const destination = image.trigger.getBoundingClientRect();
    const current = element.getBoundingClientRect();
    const animation = element.animate([
      { transform: "translate(0, 0) scale(1, 1)" },
      { transform: `translate(${destination.left - current.left}px, ${destination.top - current.top}px) scale(${destination.width / current.width}, ${destination.height / current.height})` },
    ], { duration: 500, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" });
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
    void animation.finished.then(onClose).catch(onClose);
  }, [image.trigger, onClose]);
  useModalFocus(dialogRef, close);

  useEffect(() => {
    const element = imageRef.current;
    if (!element) return;
    const target = element.getBoundingClientRect();
    const origin = image.origin;
    const motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = element.animate([
      { transform: `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${origin.width / target.width}, ${origin.height / target.height})` },
      { transform: "translate(0, 0) scale(1, 1)" },
    ], { duration: motionAllowed ? 700 : 0, easing: "cubic-bezier(.87,0,.13,1)", fill: "both" });
    const backdropAnimation = backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    return () => { animation.cancel(); backdropAnimation?.cancel(); };
  }, [image.origin]);

  return createPortal(
    <div ref={dialogRef} className={styles.lightbox} role="dialog" aria-modal="true" aria-label={image.media.alt || "Project photograph"} data-lenis-prevent>
      <div ref={backdropRef} className={styles.lightboxBackdrop} onClick={close} />
      {/* Original CMS assets are local files; retain their intrinsic size and aspect ratio. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} src={image.media.url} alt={image.media.alt || ""} width={image.media.width} height={image.media.height} className={styles.lightboxImage} onClick={close} />
      <button className={styles.close} onClick={close} aria-label="Close image"><ProjectFrameIcon close /></button>
    </div>, document.body,
  );
}

function FilmModal({ media, onClose }: { media: MediaAsset; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (!ref.current || closingRef.current) return;
    closingRef.current = true;
    ref.current.querySelector("video")?.pause();
    const fade = ref.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: "ease-in-out", fill: "forwards" });
    void fade.finished.then(onClose).catch(onClose);
  }, [onClose]);
  useModalFocus(ref, close);
  useEffect(() => { ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-in-out" }); }, []);
  return createPortal(
    <div ref={ref} className={styles.filmModal} role="dialog" aria-modal="true" aria-label="Project film" data-lenis-prevent>
      <button className={styles.close} onClick={close} aria-label="Close video"><ProjectFrameIcon close /></button>
      <ProjectVideo media={media} autoPlay immersive />
    </div>, document.body,
  );
}

function ProjectBlockContent({ block, onImageClick }: { block: ProjectBlock; onImageClick: (media: MediaAsset, trigger: HTMLButtonElement) => void }) {
  switch (block.__typename) {
    case "BlockContentRecord":
      return <section className={`grid-layout ${styles.contentBlock} ${block.columns ? styles.columns : ""}`} data-project-reveal>
        <h2 className={`text-heading-md ${styles.blockHeading}`}>{block.title}</h2>
        <div className={`text-body-md ${styles.blockText}`} dangerouslySetInnerHTML={{ __html: block.text }} />
      </section>;
    case "BlockMediaGridRecord":
      return <section className={`grid-layout ${styles.mediaGrid}`} data-count={block.medias.length} data-project-reveal>
        {block.medias.map((media, index) => {
          if (media.mimeType.startsWith("video/")) return <div key={`${media.url}-${index}`} className={styles.mediaItem}><ProjectVideo media={media} /></div>;
          return <button key={`${media.url}-${index}`} className={`${styles.mediaItem} ${styles.imageButton}`} onClick={(event) => onImageClick(media, event.currentTarget)} aria-label={`Enlarge ${media.alt || "project photograph"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt={media.alt || ""} width={media.width} height={media.height} loading="lazy" decoding="async" />
          </button>;
        })}
      </section>;
    case "BlockQuoteRecord":
      return <section className={`grid-layout ${styles.quoteBlock}`} data-project-reveal><blockquote className={styles.quote}>
        <div className="text-heading-lg" dangerouslySetInnerHTML={{ __html: block.text }} />
        {block.author ? <cite className="text-label">— {block.author}</cite> : null}
      </blockquote></section>;
    case "BlockSingleTitleRecord":
      return <section className={`grid-layout ${styles.titleBlock}`} data-project-reveal><h2 className="text-heading-lg">{block.title}</h2></section>;
  }
}

export default function ProjectDetail({ project, nextProject }: { project: Project; nextProject: Project }) {
  const [filmOpen, setFilmOpen] = useState(false);
  const [image, setImage] = useState<OpenImage | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const nativeFilmRef = useRef<NativeFilmVideo>(null);
  const nativeFilmAttemptRef = useRef(0);
  const nextSectionRef = useRef<HTMLElement>(null);
  const nextInnerRef = useRef<HTMLDivElement>(null);
  const nextRevealedRef = useRef(false);
  useLenis(({ scroll }) => {
    const section = nextSectionRef.current;
    const inner = nextInnerRef.current;
    if (!section || !inner || window.matchMedia("(pointer: coarse)").matches) return;
    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const height = section.offsetHeight;
    if (!nextRevealedRef.current && sectionTop - scroll < window.innerHeight) {
      nextRevealedRef.current = true;
      inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: "ease-out" });
    }
    const progress = Math.max(0, Math.min(1, (scroll - (sectionTop - window.innerHeight)) / height));
    inner.style.transform = `translate3d(0, ${-(height * (1 - progress))}px, 0)`;
  });
  const hasFilm = project.projectCover.mimeType.startsWith("video/");
  const closeFilm = useCallback(() => setFilmOpen(false), []);
  const closeImage = useCallback(() => setImage(null), []);

  function openFilm() {
    const video = nativeFilmRef.current;
    if (!window.matchMedia("(pointer: coarse)").matches || !video) {
      setFilmOpen(true);
      return;
    }
    const attempt = ++nativeFilmAttemptRef.current;
    const fallback = () => {
      if (nativeFilmAttemptRef.current !== attempt) return;
      nativeFilmAttemptRef.current += 1;
      video.pause();
      video.muted = true;
      if (document.fullscreenElement === video) void document.exitFullscreen().catch(() => {});
      setFilmOpen(true);
    };
    video.muted = false;
    // Keep playback and fullscreen inside this user gesture, as mobile Safari requires.
    void video.play().catch(fallback);
    try {
      if (typeof video.webkitEnterFullscreen === "function") {
        video.webkitEnterFullscreen();
        return;
      }
      if (typeof video.requestFullscreen === "function") {
        video.controls = true;
        void video.requestFullscreen().catch(fallback);
        return;
      }
    } catch {
      fallback();
      return;
    }
    fallback();
  }

  useEffect(() => {
    const video = nativeFilmRef.current;
    if (!video) return;
    let fullscreenActive = false;
    const reset = () => {
      nativeFilmAttemptRef.current += 1;
      fullscreenActive = false;
      video.pause();
      video.muted = true;
      video.controls = false;
      video.load();
    };
    const begin = () => { fullscreenActive = true; };
    const fullscreenChange = () => {
      if (document.fullscreenElement === video) fullscreenActive = true;
      else if (fullscreenActive) reset();
    };
    video.addEventListener("webkitbeginfullscreen", begin);
    video.addEventListener("webkitendfullscreen", reset);
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      nativeFilmAttemptRef.current += 1;
      video.pause();
      video.removeEventListener("webkitbeginfullscreen", begin);
      video.removeEventListener("webkitendfullscreen", reset);
      document.removeEventListener("fullscreenchange", fullscreenChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let wasHidden = false;
    let opacityTween: gsap.core.Tween | null = null;
    const updateHeader = (immediate = false) => {
      const main = mainRef.current;
      if (!main) return;
      const hidden = main.getBoundingClientRect().bottom <= window.innerHeight * 1.2;
      if (!immediate && hidden === wasHidden) return;
      wasHidden = hidden;
      opacityTween?.kill();
      if (immediate) root.style.setProperty("--project-header-opacity", hidden ? "0" : "1");
      else opacityTween = gsap.to(root, { "--project-header-opacity": hidden ? 0 : 1, duration: .3, ease: "none", overwrite: "auto" });
    };
    const onScroll = () => updateHeader();
    const observer = new ResizeObserver(() => updateHeader());
    if (mainRef.current) observer.observe(mainRef.current);
    updateHeader(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      opacityTween?.kill();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.setProperty("--project-header-opacity", "1");
    };
  }, []);

  useEffect(() => {
    if (CSS.supports("animation-timeline: scroll()")) return;
    const onScroll = () => {
      if (!heroVisualRef.current || window.innerWidth < 768) return;
      heroVisualRef.current.style.transform = `translateY(${Math.min(window.scrollY, window.innerHeight)}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = mainRef.current?.querySelectorAll<HTMLElement>("[data-project-reveal]");
    if (!targets?.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 650, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -20px 0px", threshold: 0.03 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [project.id]);

  return <main ref={mainRef} className={styles.project} data-project-page>
    <section className={styles.hero}>
      <div ref={heroVisualRef} className={`${styles.heroVisual} hero-scroll-parallax`}>
      <ProjectLoop media={project.projectPoster} className={styles.heroMedia} />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroTitle}>
        <div className="text-body-sm">{project.projectClient}</div>
        <h1 className="text-display">{project.projectTitle}</h1>
        <div className={`text-label ${styles.heroMeta}`}>{project.projectInformations} | {new Date(project.projectDate).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</div>
      </div>
      {hasFilm ? <button className={styles.heroPlay} aria-label="Play video" onClick={openFilm} onPointerMove={(event) => {
        if (pointerRef.current) pointerRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      }}><span ref={pointerRef} className={styles.playLabel}>Play video</span></button> : null}
      </div>
    </section>
    <div className={styles.content}>
      {project.pageContent.map((block) => <ProjectBlockContent key={block.id} block={block} onImageClick={(media, trigger) => setImage({ media, trigger, origin: trigger.getBoundingClientRect() })} />)}
    </div>
    <section ref={nextSectionRef} className={styles.nextProject}>
      <div ref={nextInnerRef} className={styles.nextInner}>
      <Link href={`/projects/${nextProject.projectSlug}`} className={styles.nextLink}>
        <h2 className="text-heading-xl">Next project<br /><span>{nextProject.projectTitle}</span></h2>
        <div className={`grid-layout ${styles.nextGrid}`}><div className={styles.nextMedia} data-project-transition><ProjectLoop media={nextProject.projectPoster} /></div></div>
      </Link>
      </div>
    </section>
    {hasFilm ? <video ref={nativeFilmRef} className={styles.nativeFilm} src={project.projectCover.video?.mp4MediumUrl || projectVideoSource(project.projectCover)} playsInline muted preload="metadata" aria-hidden="true" tabIndex={-1} /> : null}
    {filmOpen ? <FilmModal media={project.projectCover} onClose={closeFilm} /> : null}
    {image ? <ImageLightbox image={image} onClose={closeImage} /> : null}
  </main>;
}
