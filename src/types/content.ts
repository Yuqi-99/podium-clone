export interface VideoSource {
  thumbnailUrl: string;
  mp4Url?: string;
  mp4MediumUrl?: string;
  muxPlaybackId?: string;
}
export interface MediaAsset {
  url: string;
  alt: string | null;
  width: number;
  height: number;
  mimeType: string;
  video: VideoSource | null;
}
export interface ContentBlock {
  __typename: "BlockContentRecord";
  id: string;
  title: string;
  text: string;
  columns: boolean;
}
export interface MediaBlock {
  __typename: "BlockMediaGridRecord";
  id: string;
  medias: MediaAsset[];
}
export interface QuoteBlock {
  __typename: "BlockQuoteRecord";
  id: string;
  text: string;
  author: string;
}
export interface TitleBlock {
  __typename: "BlockSingleTitleRecord";
  id: string;
  title: string;
}
export type ProjectBlock = ContentBlock | MediaBlock | QuoteBlock | TitleBlock;
export interface Project {
  id: string;
  projectTitle: string;
  projectSlug: string;
  projectClient: string;
  projectInformations: string;
  projectDate: string;
  projectPoster: MediaAsset;
  projectCover: MediaAsset;
  pageContent: ProjectBlock[];
  seo: {title: string; description: string};
}
