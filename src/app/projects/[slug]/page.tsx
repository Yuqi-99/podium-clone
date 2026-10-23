import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectDetail from "@/components/project-detail";
import siteContent from "@/data/site-content.json";
import type { Project } from "@/types/content";

const projects = siteContent.projects as Project[];
type ProjectPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.projectSlug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((entry) => entry.projectSlug === slug);
  if (!project) return {};
  return {
    title: project.seo.title,
    description: project.seo.description,
    openGraph: {
      title: project.seo.title,
      description: project.seo.description,
      images: [project.projectPoster.video?.thumbnailUrl || project.projectPoster.url],
    },
  };
}

async function ProjectContent({ params }: ProjectPageProps) {
  const { slug } = await params;
  const index = projects.findIndex((project) => project.projectSlug === slug);
  if (index < 0) notFound();
  return <ProjectDetail key={slug} project={projects[index]} nextProject={projects[(index + 1) % projects.length]} />;
}

export default function ProjectPage(props: ProjectPageProps) {
  return <Suspense fallback={<div className="project-route-loading" aria-hidden="true" />}><ProjectContent {...props} /></Suspense>;
}
