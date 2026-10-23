"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { homeSession } from "@/lib/home-session";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import content from "@/data/site-content.json";
import copy from "@/data/home-copy.json";
import type { Project, MediaAsset } from "@/types/content";
import type { SceneMotion } from "@/types/scene";
import { useProjectGridMotion } from "@/components/use-project-grid-motion";
import ViewToggle from "@/components/view-toggle";

const PodiumScene = dynamic(()=>import("@/components/podium-scene"),{ssr:false});
const allProjects = content.projects as Project[];
const projects = copy.homeProjectItems.map(item=>allProjects.find(project=>project.id===item.id)).filter((project):project is Project=>Boolean(project));
interface CarouselMedia {mimeType:string;responsiveImage:{src:string;width:number;height:number;alt:string|null}|null;video:{thumbnailUrl:string;mp4Url:string}|null}
interface CarouselItem {id:string;text:string;content:string;media:CarouselMedia}
const carousel = content.carousel as CarouselItem[];
const clamp=(value:number,min=0,max=1)=>Math.min(max,Math.max(min,value));

function Preview({media,className="",playing=true}:{media:MediaAsset;className?:string;playing?:boolean}) {
  const video=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const item=video.current;
    if(!item) return;
    const io=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting&&playing) void item.play().catch(()=>{});
      else item.pause();
    },{rootMargin:"200px"});
    io.observe(item);
    return ()=>{io.disconnect();item.pause();};
  },[playing]);
  if(media.video) return <video ref={video} className={className} src={`${media.video.mp4Url||media.url}#t=0.001`} poster={media.video.thumbnailUrl} autoPlay={playing} muted loop playsInline preload="auto" onLoadedMetadata={event=>{if(!playing)event.currentTarget.currentTime=.001;}}/>;
  return <Image unoptimized className={className} src={media.url} alt={media.alt||""} width={media.width} height={media.height}/>;
}

function ProjectList({close}:{close:()=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const [hovered,setHovered]=useState<string|null>(null);
  const lenis=useLenis();
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    lenis?.stop();
    gsap.fromTo(root.current,{autoAlpha:0},{autoAlpha:1,duration:.44,ease:"power2.out"});
    gsap.fromTo(root.current?.querySelectorAll(".list-row")||[],{clipPath:"inset(0 48%)"},{clipPath:"inset(0 0%)",duration:.75,stagger:.035,ease:"expo.inOut"});
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};
    window.addEventListener("keydown",key);
    return ()=>{window.removeEventListener("keydown",key);document.body.style.overflow=previous;lenis?.start();};
  },[close,lenis]);
  const active=projects.find(p=>p.id===hovered);
  return <div className="project-list" ref={root} role="region" aria-label="Project list" data-lenis-prevent>
    {active && <div className="list-preview" key={active.id}><Preview media={active.projectPoster} playing={false}/></div>}
    <div className={`project-list-rows ${hovered?"has-hover":""}`} onMouseLeave={()=>setHovered(null)}>{projects.map((project,index)=><Link className={`list-row ${hovered===project.id?"is-hovered":""}`} onMouseEnter={()=>setHovered(project.id)} onFocus={()=>setHovered(project.id)} href={`/projects/${project.projectSlug}`} key={project.id}>
      <span className="list-title text-heading-lg">{project.projectTitle}</span><span className="list-client text-body-sm">{project.projectClient}</span><span className="text-label list-year">{project.projectDate.slice(0,4)}</span><span className="text-label list-number">/{String(index+1).padStart(3,"0")}</span><i/><i/><i/><i/>
    </Link>)}</div>
  </div>;
}

function BehindCard({item}:{item:CarouselItem}) {
  const video=useRef<HTMLVideoElement>(null);
  const face=useRef<HTMLDivElement>(null);
  const [flipped,setFlipped]=useState(false);
  const play=()=>{void video.current?.play().catch(()=>{});};
  const pause=()=>video.current?.pause();
  useEffect(()=>{
    const element=face.current;
    if(!element)return;
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.current?.pause();},{threshold:0});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const click=()=>{
    if(item.content.trim()) {setFlipped(v=>!v);return;}
    if(!window.matchMedia("(pointer: coarse)").matches || !video.current) return;
    if(video.current.paused) play();else pause();
  };
  const poster=item.media.responsiveImage?.src||item.media.video?.thumbnailUrl||"";
  return <div className={`behind-card ${flipped?"is-flipped":""}`} onPointerEnter={play} onPointerLeave={pause}>
    <div ref={face} className="behind-card-face" onClick={click} role={item.content?"button":undefined} tabIndex={item.content?0:undefined} onKeyDown={e=>{if(e.key==="Enter")click();}}>
      <div className="behind-card-front"><Image unoptimized src={poster} alt={item.media.responsiveImage?.alt||""} width={item.media.responsiveImage?.width||800} height={item.media.responsiveImage?.height||1066} draggable={false}/>{item.media.video && <video ref={video} src={item.media.video.mp4Url} poster={item.media.video.thumbnailUrl} loop muted playsInline preload="none"/>}<span className="behind-card-light"/></div>
      {item.content && <div className="behind-card-back text-body-md" dangerouslySetInnerHTML={{__html:item.content}}/>}
      {item.text && <span className="behind-card-label text-label">{item.text}</span>}
    </div>
  </div>;
}

function BehindScenes() {
  const [viewport,embla]=useEmblaCarousel({loop:true,dragFree:true,align:"start"});
  useEffect(()=>{
    if(!embla)return;
    const parallax=()=>{
      const engine=embla.internalEngine();
      const progress=embla.scrollProgress();
      embla.scrollSnapList().forEach((snap,index)=>{
        let diff=snap-progress;
        const loop=engine.slideLooper.loopPoints.find(point=>point.index===index&&point.target()!==0);
        if(loop){
          const sign=Math.sign(loop.target());
          if(sign===-1)diff=snap-(1+progress);
          else if(sign===1)diff=snap+(1-progress);
        }
        const element=embla.slideNodes()[index]?.querySelector<HTMLElement>(".behind-card-front");
        element?.style.setProperty("--parallax",`${clamp(-.8333333333*diff*100,-8.333333333,8.333333333)}%`);
      });
    };
    parallax();
    embla.on("scroll",parallax).on("reInit",parallax);
    return ()=>{embla.off("scroll",parallax).off("reInit",parallax);};
  },[embla]);
  return <div className="pt-ww-carousel-top pb-ww-carousel-bottom behind-scenes">
    <div className="flex items-center gap-gap-lg px-grid-margin behind-heading"><h3 className="text-heading-md text-black">{copy.homeWorldwideCarouselTitle}</h3><Image unoptimized src="/images/scroll-strip.svg" className="scroll-strip" alt="" aria-hidden="true" width={104} height={16}/></div>
    <div className="behind-viewport" ref={viewport}>
      <div className="behind-track">{carousel.map(item=><BehindCard key={item.id} item={item}/>)}</div>
    </div>
  </div>;
}

function Dots() {return <span className="corner-dots" aria-hidden="true"><i/><i/><i/><i/></span>;}
function WhatWeDo() {
  return <div id="whatwedo" className="relative z-10 mt-gap-xl pb-whatwedo-top text-white">
    <div className="grid-layout"><h2 className="col-span-5 md:col-span-8 md:col-start-3 text-left text-heading-xl text-black">&nbsp;&nbsp;&nbsp;&nbsp; {copy.homeWhatwedoTitle}</h2></div>
    <div className="grid-layout mt-whatwedo-top"><div className="col-span-5 md:col-span-8 md:col-start-3 service-columns">
      <div className="service-left"><div className="service-box service-box-service p-whatwedo-box-p bg-whatwedo-service"><Dots/><h3 className="text-label text-black">{copy.homeWhatwedoServiceTitle}</h3><div className="whatwedo-content mt-whatwedo-box-gap text-whatwedo-item text-black" dangerouslySetInnerHTML={{__html:copy.homeWhatwedoServiceText}}/></div></div>
      <div className="service-box service-box-client p-whatwedo-box-p bg-whatwedo-client"><Dots/><h3 className="text-label text-black">{copy.homeWhatwedoClientTitle}</h3><div className="whatwedo-content mt-whatwedo-box-gap text-whatwedo-item text-black" dangerouslySetInnerHTML={{__html:copy.homeWhatwedoClientContent}}/></div>
    </div></div>
    <div className="grid-layout"><div className="service-box service-box-athlete col-span-5 md:col-span-8 md:col-start-3 p-whatwedo-box-p bg-whatwedo-athlete"><Dots/><h3 className="text-label text-black">{copy.homeWhatwedoAthleteTitle}</h3><div className="whatwedo-content mt-whatwedo-box-gap text-whatwedo-item text-black" dangerouslySetInnerHTML={{__html:copy.homeWhatwedoAthleteContent}}/></div></div>
  </div>;
}

function LoadingScreen() {
  const root=useRef<HTMLDivElement>(null);
  const percent=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    if(homeSession.loaded){if(root.current)root.current.style.display="none";return;}
    let done=false;
    let value=0;
    const timer=window.setInterval(()=>{value=Math.min(96,value+(99-value)*.12);if(percent.current)percent.current.textContent=`${Math.round(value)}%`;},100);
    const ready=()=>{
      if(done)return;done=true;clearInterval(timer);
      if(percent.current)percent.current.textContent="100%";
      gsap.to(root.current,{autoAlpha:0,duration:.4,delay:.1,onComplete:()=>{if(root.current)root.current.style.display="none";}});
    };
    window.addEventListener("podium:scene-ready",ready);
    if(document.querySelector("[data-scene-loaded='true']"))ready();
    return ()=>{clearInterval(timer);window.removeEventListener("podium:scene-ready",ready);};
  },[]);
  return <div className="home-loading" ref={root} aria-hidden="true"><i/><span ref={percent} className="text-heading-md">0%</span></div>;
}

export default function HomeExperience() {
  const root=useRef<HTMLDivElement>(null);
  const tagline=useRef<HTMLElement>(null);
  const toggle=useRef<HTMLDivElement>(null);
  const [list,setList]=useState(false);
  const lenis=useLenis();
  const motion=useRef<SceneMotion>({hero:0,mosaic:0,worldwide:0,footer:0,velocity:0});
  const closeList=useCallback(()=>setList(false),[]);
  useProjectGridMotion(root);
  useEffect(()=>{
    const close=()=>closeList();
    window.addEventListener("podium:close-list",close);
    return ()=>window.removeEventListener("podium:close-list",close);
  },[closeList]);
  useEffect(()=>{
    gsap.registerPlugin(ScrollTrigger);
    const context=gsap.context(()=>{
      ScrollTrigger.create({trigger:"#hero",start:"top top",end:"bottom top",onUpdate:self=>{motion.current.hero=self.progress;motion.current.velocity=self.getVelocity()/1000;}});
      ScrollTrigger.create({trigger:"#mosaic",start:"top bottom",end:"bottom center",onUpdate:self=>{motion.current.mosaic=self.progress;}});
      ScrollTrigger.create({trigger:"#about",start:"top 80%",end:"bottom 20%",onUpdate:self=>{motion.current.worldwide=self.progress;}});
      ScrollTrigger.create({trigger:"#contact-footer",start:"top center",end:"bottom 90%",onUpdate:self=>{motion.current.footer=self.progress;}});
      gsap.from("#whatwedo h2",{y:25,opacity:0,scrollTrigger:{trigger:"#whatwedo",start:"top 90%"},duration:1,ease:"power3.out"});
      gsap.from(".service-box",{rotationY:-8,rotationX:5,opacity:0,y:40,stagger:.1,duration:1,ease:"power3.out",scrollTrigger:{trigger:".service-columns",start:"top 95%"}});
      const paint=()=>{
        const h=innerHeight;
        const y=window.scrollY;
        const mosaic=document.getElementById("mosaic");const about=document.getElementById("about");const footer=document.getElementById("contact-footer");const work=document.getElementById("work");
        if(!mosaic||!about||!footer||!work)return;
        let color=clamp((h*.6-mosaic.getBoundingClientRect().top)/(h*.2))*255;
        const aboutWhite=1-clamp((h*.6-about.getBoundingClientRect().top)/(h*.2));color*=aboutWhite;
        color=Math.max(color,clamp((h*.6-footer.getBoundingClientRect().top)/(h*.2))*255);
        document.documentElement.style.setProperty("--header-color",`rgb(${color},${color},${color})`);
        if(tagline.current)tagline.current.style.opacity=y>1?"0":"1";
        const rect=work.getBoundingClientRect();const visible=rect.top<h*.8&&rect.bottom>h;
        if(toggle.current){toggle.current.style.opacity=visible?"1":"0";toggle.current.style.visibility=visible?"visible":"hidden";}
      };
      gsap.ticker.add(paint);paint();
      return ()=>{gsap.ticker.remove(paint);};
    },root);
    const refresh=()=>ScrollTrigger.refresh();
    const t=window.setTimeout(refresh,800);
    document.fonts.ready.then(refresh).catch(()=>{});
    lenis?.on("scroll",ScrollTrigger.update);
    return ()=>{clearTimeout(t);lenis?.off("scroll",ScrollTrigger.update);context.revert();};
  },[lenis]);
  return <div ref={root} className="home-experience">
    <PodiumScene motion={motion}/>
    <main>
      <section ref={tagline} className="hero-tagline grid-layout" aria-label="Creative direction and production"><div className="hero-copy text-heading-lg" dangerouslySetInnerHTML={{__html:copy.homeHeroTagline}}/><div className="hero-hint text-label" dangerouslySetInnerHTML={{__html:copy.homeHeroHint}}/></section>
      <section id="hero" className="h-svh"/>
      <section id="mosaic"><div className="h-[200svh]"/></section>
      <section id="work"><section className="project-grid">{projects.map(project=><Link href={`/projects/${project.projectSlug}`} className="project-card group" data-project-transition key={project.id} onPointerEnter={event=>{void event.currentTarget.querySelector("video")?.play().catch(()=>{});}} onPointerLeave={event=>{const video=event.currentTarget.querySelector("video");if(video){video.pause();video.currentTime=.001;}}} onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty("--halo-x",`${(event.clientX-rect.left)/rect.width*100}%`);event.currentTarget.style.setProperty("--halo-y",`${(event.clientY-rect.top)/rect.height*100}%`);}}>
        <div className="project-cover"><Preview media={project.projectPoster} playing={false}/><span className="project-card-halo" aria-hidden="true"/></div>
        <div className="project-caption"><p className="text-heading-lg">{project.projectTitle}</p><div className="project-meta"><p className="text-label">{project.projectDate.slice(0,4)}</p><p className="text-body-sm">{project.projectClient}</p></div></div>
      </Link>)}</section></section>
      <section id="about"><div className="relative z-10"><p className="px-grid-margin text-body-sm text-black">{copy.homeWorldwideOverline}</p><div className="grid-layout mt-gap-lg"><div className="col-span-5 md:col-span-10 text-justify text-heading-xl text-black" dangerouslySetInnerHTML={{__html:copy.homeWorldwideTitle}}/></div><BehindScenes/></div><WhatWeDo/></section>
      <section id="contact-footer" className="h-lvh relative"><div className="footer-content grid-layout"><p className="footer-side text-label">{copy.homeFooterTextLeft}</p><div className="footer-tagline text-footer-tagline" dangerouslySetInnerHTML={{__html:copy.homeFooterTagline}}/><p className="footer-side footer-right text-label">{copy.homeFooterTextRight}</p></div><footer className="site-footer text-label"><p>©Podium 2026</p><p>Website by <a href="https://sanrita.ca" target="_blank" rel="noreferrer">San Rita</a></p></footer></section>
    </main>
    {list && <ProjectList close={closeList}/>}
    <ViewToggle list={list} onClick={()=>setList(v=>!v)} buttonRef={toggle}/>
    <LoadingScreen/>
  </div>;
}
