"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";

interface StudioContextValue { openContact: () => void; navigate: (target: "work" | "about") => void }
const StudioContext = createContext<StudioContextValue>({openContact: () => {}, navigate: () => {}});
export const useStudio = () => useContext(StudioContext);

function ScrollClock() {
  const lenis = useLenis();
  useEffect(() => {
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(tick);
  }, [lenis]);
  return null;
}

export function GlitchText({ children }: {children: string}) {
  return <span className="glitch-text" aria-label={children}>{Array.from(children).map((char, index) => <span aria-hidden="true" key={index} style={{"--char-index": index} as React.CSSProperties}>{char === " " ? "\u00a0" : char}</span>)}</span>;
}

export function FrameButton({label, symbol, onClick, className = ""}: {label: string; symbol: string; onClick: () => void; className?: string}) {
  return <button type="button" className={`frame-button ${className}`} onClick={onClick} aria-label={label}>
    <span className="frame-label">{label}</span><span className="frame-symbol" aria-hidden="true">{symbol}</span>
    <i/><i/><i/><i/>
  </button>;
}

function ContactCard({close}: {close: () => void}) {
  const [copied, setCopied] = useState("");
  const card = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const lenis = useLenis();
  const finishClose = useCallback(()=>{
    if(closing.current)return;
    closing.current=true;
    gsap.to(card.current,{autoAlpha:0,rotationY:-22,z:80,scale:.5,duration:.4,ease:"power2.in",onComplete:close});
  },[close]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    const key = (e: KeyboardEvent) => {if (e.key === "Escape") finishClose();};
    window.addEventListener("keydown", key);
    gsap.fromTo(card.current, {autoAlpha: 0, rotationY: 36, rotationX: -8, z:0, scale:.5}, {autoAlpha:1, rotationY:0, rotationX:0, z:300, scale:.6,duration:.8,ease:"expo.out"});
    card.current?.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true});
    return () => {document.body.style.overflow=previous;lenis?.start();window.removeEventListener("keydown",key);};
  }, [finishClose,lenis]);
  const copy = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopied(email);
    window.setTimeout(()=>setCopied(""),1800);
  };
  const contacts = [["Commercial","Renaud@podium.global"],["Film","Philip@podium.global"],["General","Jasmine@podium.global"],["Invoicing","Accounting@podium.global"]];
  return <div className="contact-backdrop" onClick={finishClose}>
    <div className="contact-perspective">
      <div className="contact-card" ref={card} role="dialog" aria-modal="true" aria-label="Contact Podium" onClick={e=>e.stopPropagation()}>
        <h2 className="text-heading-xl contact-heading">Available<br/>worldwide</h2>
        <div className="contact-sign"><Image unoptimized src="/images/sign.svg" alt="" width={80} height={122}/></div>
        <div className="contact-address">
          <p className="text-body-md"><strong>Studio address</strong><br/>3081 Ontario St E,<br/>Montreal, QC H1W 1N7</p>
          <div className="contact-socials text-heading-md"><a href="https://www.instagram.com/podium.global/" target="_blank" rel="noreferrer">Instagram</a><a href="https://vimeo.com/podiumglobal" target="_blank" rel="noreferrer">Vimeo</a></div>
        </div>
        <div className="contact-emails">{contacts.map(([label,email])=><div key={label}><p className="text-heading-md">{label}</p><button className="text-body-md copy-email" type="button" onClick={()=>void copy(email)}><span style={{opacity:copied===email?0:1}}>{email}</span><span className="copy-feedback" style={{opacity:copied===email?1:0}}>Copied</span></button></div>)}</div>
        <button className="contact-close" aria-label="Close contact" type="button" onClick={finishClose}><Image unoptimized src="/images/close-contact.svg" alt="" width={105} height={54}/></button>
      </div>
    </div>
  </div>;
}

function ShellContent({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const lenis = useLenis();
  const [menuOpen,setMenuOpen] = useState(false);
  const [contactOpen,setContactOpen] = useState(false);
  const transition = useRef<HTMLDivElement>(null);
  const transitionMedia = useRef<HTMLDivElement>(null);
  const closeContact = useCallback(()=>setContactOpen(false),[]);
  const openContact = useCallback(()=>{setMenuOpen(false);setContactOpen(true);},[]);
  const navigate = useCallback((target: "work" | "about") => {
    setMenuOpen(false);
    window.dispatchEvent(new Event("podium:close-list"));
    if (pathname !== "/") {router.push(`/#${target}`);return;}
    requestAnimationFrame(()=>{
      lenis?.start();
      const element=document.getElementById(target);
      if (element) lenis?.scrollTo(element,{duration:1.2});
    });
  },[lenis,pathname,router]);
  useEffect(()=>{
    gsap.to(transition.current,{autoAlpha:0,duration:.7,ease:"power2.out",delay:.08});
    const stage=transitionMedia.current;
    if(stage?.childElementCount) gsap.to(stage,{opacity:0,duration:.5,delay:.25,onComplete:()=>stage.replaceChildren()});
    if (pathname !== "/") document.documentElement.style.setProperty("--header-color","#fff");
    const hash=window.location.hash;
    if (hash==="#contact") {requestAnimationFrame(()=>setContactOpen(true));return;}
    if (hash && pathname==="/") {
      const t=window.setTimeout(()=>{const el=document.querySelector(hash);if(el) lenis?.scrollTo(el as HTMLElement,{immediate:true});},600);
      return ()=>clearTimeout(t);
    }
  },[pathname,lenis]);
  useEffect(()=>{
    const click=(event: MouseEvent)=>{
      const el=event.target;
      if (!(el instanceof Element)) return;
      const anchor=el.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target==="_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button!==0) return;
      const url=new URL(anchor.href,window.location.href);
      if (url.origin!==location.origin) return;
      if(url.hash==="#contact") {event.preventDefault();event.stopPropagation();openContact();return;}
      if(url.pathname===pathname) return;
      event.preventDefault();event.stopPropagation();
      const navigate=()=>{router.push(url.pathname+url.search+url.hash);lenis?.scrollTo(0,{immediate:true});};
      let visualRoot:Element|null=anchor;
      if(!anchor.hasAttribute("data-project-transition")) visualRoot=anchor.querySelector("[data-project-transition]");
      const visual=visualRoot?.querySelector<HTMLVideoElement|HTMLImageElement>("video,img");
      if(visual && transitionMedia.current){
        const rect=visual.getBoundingClientRect();
        const clone=visual.cloneNode(true) as HTMLVideoElement|HTMLImageElement;
        if(clone instanceof HTMLVideoElement){clone.muted=true;clone.autoplay=false;clone.currentTime=visual instanceof HTMLVideoElement?visual.currentTime:.001;}
        Object.assign(clone.style,{position:"fixed",objectFit:"cover",top:`${rect.top}px`,left:`${rect.left}px`,width:`${rect.width}px`,height:`${rect.height}px`,transform:"none"});
        transitionMedia.current.replaceChildren(clone);
        gsap.set(transitionMedia.current,{opacity:1});
        gsap.to(transition.current,{autoAlpha:1,duration:.65,ease:"power2.in"});
        gsap.to(clone,{top:0,left:0,width:innerWidth,height:innerHeight,duration:.9,ease:"expo.inOut",onComplete:navigate});
      }else gsap.fromTo(transition.current,{autoAlpha:0},{autoAlpha:1,duration:.28,ease:"power2.in",onComplete:navigate});
    };
    document.addEventListener("click",click,true);
    return ()=>document.removeEventListener("click",click,true);
  },[pathname,router,lenis,openContact]);
  useEffect(()=>{
    if(!menuOpen) return;
    lenis?.stop();
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setMenuOpen(false);};
    window.addEventListener("keydown",key);
    return ()=>{lenis?.start();window.removeEventListener("keydown",key);};
  },[menuOpen,lenis]);
  return <StudioContext.Provider value={{openContact,navigate}}>
    <ScrollClock/>
    <header className={`site-header ${menuOpen ? "menu-active" : ""}`}>
      <Link href="/" className="site-logo w-header-logo-w" aria-label="Podium — Home"><span/></Link>
      <nav className="desktop-nav" aria-label="Main navigation"><button onClick={()=>navigate("work")} className="text-nav"><GlitchText>work</GlitchText></button><button onClick={()=>navigate("about")} className="text-nav"><GlitchText>about</GlitchText></button><button onClick={openContact} className="text-nav"><GlitchText>contact</GlitchText></button></nav>
      <button className="mobile-menu-button text-menu" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label={menuOpen?"Close menu":"Menu"}>{menuOpen?"Close":"Menu"}<span className={`menu-cross ${menuOpen?"is-open":""}`} aria-hidden="true"><i/><i/></span></button>
    </header>
    {menuOpen && <div className="mobile-navigation"><nav aria-label="Mobile navigation"><button onClick={()=>navigate("work")}>work</button><button onClick={()=>navigate("about")}>about</button><button onClick={openContact}>contact</button></nav><div><a href="https://www.instagram.com/podium.global/" target="_blank" rel="noreferrer">Instagram</a><a href="https://vimeo.com/podiumglobal" target="_blank" rel="noreferrer">Vimeo</a></div></div>}
    <div id="page-content">{children}</div>
    {contactOpen && <ContactCard close={closeContact}/>}
    <div ref={transition} className="page-transition" aria-hidden="true"/>
    <div ref={transitionMedia} className="media-transition" aria-hidden="true"/>
  </StudioContext.Provider>;
}

export function StudioShell({children}: {children: ReactNode}) {
  return <ReactLenis root options={{autoRaf:false}}><ShellContent>{children}</ShellContent></ReactLenis>;
}
