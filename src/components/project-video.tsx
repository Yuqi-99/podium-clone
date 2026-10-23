"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ProjectFrameIcon from "@/components/project-frame-icon";
import type { MediaAsset } from "@/types/content";
import styles from "@/components/project-detail.module.css";

export function projectVideoSource(media: MediaAsset): string {
  return media.video?.mp4Url || media.video?.mp4MediumUrl || media.url;
}

export function ProjectLoop({ media, className }: { media: MediaAsset; className?: string }) {
  if (!media.mimeType.startsWith("video/")) {
    // CMS images have their original responsive dimensions and are already local assets.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt={media.alt || ""} width={media.width} height={media.height} className={className} />;
  }
  return <video src={projectVideoSource(media)} poster={media.video?.thumbnailUrl} autoPlay muted loop playsInline preload="metadata" className={className} />;
}

function PlayerIcon({ name }: { name: "play" | "pause" | "volume" | "muted" | "fullscreen" }) {
  if (name === "fullscreen") return <ProjectFrameIcon />;
  // These geometric SVG assets preserve the original pixel controls.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/images/project-${name}.svg`} alt="" aria-hidden="true" />;
}

export function ProjectVideo({ media, autoPlay = false, immersive = false }: { media: MediaAsset; autoPlay?: boolean; immersive?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const progressStyle = { "--video-progress": `${progress}%`, aspectRatio: `${media.width} / ${media.height}` } as CSSProperties;

  useEffect(() => {
    if (autoPlay) videoRef.current?.play().catch(() => setPlaying(false));
  }, [autoPlay]);

  useEffect(() => {
    if (!immersive) return;
    function onKeyDown(event: KeyboardEvent) {
      const video = videoRef.current;
      if (!video || event.target instanceof HTMLInputElement) return;
      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          if (video.paused) void video.play().catch(() => setPlaying(false));
          else video.pause();
          break;
        case "m":
          event.preventDefault();
          setMuted((value) => !value);
          break;
        case "ArrowLeft":
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          event.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [immersive]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = value / 100 * video.duration;
    setProgress(value);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (containerRef.current?.requestFullscreen) {
      void containerRef.current.requestFullscreen().catch(() => videoRef.current?.setAttribute("controls", "true"));
      return;
    }
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else video?.setAttribute("controls", "true");
  }

  return (
    <div ref={containerRef} className={`${styles.player} ${immersive ? styles.immersivePlayer : ""}`} style={progressStyle} data-playing={playing}>
      <video ref={videoRef} src={projectVideoSource(media)} poster={media.video?.thumbnailUrl} playsInline preload="metadata" autoPlay={autoPlay} muted={muted} controls={failed}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => { const video = event.currentTarget; if (video.duration > 0) setProgress(video.currentTime / video.duration * 100); }}
        onError={() => setFailed(true)} aria-label={media.alt || "Project film"} />
      <button className={styles.videoSurface} aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlayback} />
      {!immersive && <button className={styles.fullscreen} aria-label="Toggle fullscreen" onClick={toggleFullscreen}><PlayerIcon name="fullscreen" /></button>}
      <div className={styles.controls}>
        <button className={styles.playControl} onClick={togglePlayback} aria-label={playing ? "Pause video" : "Play video"}><PlayerIcon name={playing ? "pause" : "play"} /></button>
        <div className={styles.timeline}>
          <div className={styles.waveform} aria-hidden="true" />
          <div className={styles.waveformProgress} aria-hidden="true" />
          <input type="range" min="0" max="100" step="0.01" value={progress} onChange={(event) => seek(Number(event.target.value))} aria-label="Video progress" aria-valuetext={`${Math.round(progress / 100 * duration)} of ${Math.round(duration)} seconds`} />
        </div>
        <button className={styles.volumeControl} onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute video" : "Mute video"}><PlayerIcon name={muted ? "muted" : "volume"} /></button>
      </div>
    </div>
  );
}
