import styles from "@/components/project-detail.module.css";

export default function ProjectFrameIcon({ close = false }: { close?: boolean }) {
  return <svg className={styles.frameIcon} width="51" height="50" viewBox="0 0 51 50" fill="none" aria-hidden="true">
    <rect x="1.125" y="1.125" width="47.75" height="47.75" stroke="#a6a6a6" strokeWidth=".25" strokeDasharray="2 2" />
    <rect data-corner="tl" width="3" height="3" fill="#a6a6a6" />
    <rect data-corner="bl" y="47" width="3" height="3" fill="#a6a6a6" />
    <rect data-corner="tr" x="47" width="3" height="3" fill="#a6a6a6" />
    <rect data-corner="br" x="48" y="47" width="3" height="3" fill="#a6a6a6" />
    <image href={close ? "/images/project-close-glyph.svg" : "/images/project-fullscreen-glyph.svg"} x="0" y="0" width="51" height="50" />
  </svg>;
}
