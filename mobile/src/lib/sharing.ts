import type { ContentOrigin, ContentTarget } from './types';

/** Minimal structural view of expo-share-intent's ShareIntent (keeps this module pure and testable). */
export interface IncomingShare {
  files?: { path: string; mimeType: string; fileName: string }[] | null;
  text?: string | null;
  webUrl?: string | null;
}

export type PendingContent =
  | {
      kind: 'media';
      uri: string;
      name: string;
      mimeType: string;
      isVideo: boolean;
      origin: ContentOrigin;
      contentTarget: ContentTarget;
      receivedAt: string; // ISO; start of the time-to-selection clock
    }
  | { kind: 'link'; url: string; contentTarget: ContentTarget; receivedAt: string }
  | { kind: 'text'; text: string; receivedAt: string };

const SUPPORTED = /^(image\/(jpeg|png|webp)|video\/(mp4|quicktime))$/i;

export function isSupportedMime(mime: string): boolean {
  return SUPPORTED.test(mime);
}

export function targetFromUrl(url: string): ContentTarget | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host.endsWith('instagram.com')) {
    if (u.pathname.startsWith('/stories')) return 'instagram_story';
    if (u.pathname.startsWith('/reel')) return 'instagram_reel';
    if (u.pathname.startsWith('/p/')) return 'instagram_post';
    return 'instagram_post';
  }
  if (host.endsWith('youtube.com') && u.pathname.startsWith('/shorts')) return 'youtube_short';
  if (host.endsWith('whatsapp.com')) return 'whatsapp_status';
  return null;
}

export function defaultTarget(isVideo: boolean): ContentTarget {
  return isVideo ? 'instagram_reel' : 'instagram_story';
}

function toFileUri(path: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) ? path : `file://${path}`;
}

/**
 * Convert an incoming OS share into content to analyse. `now` is the moment the
 * content was received by the app: the start of the time-to-song-selection clock.
 *
 * Only the shared media itself is analysed. A bare link is never fetched/scraped.
 */
export function toPendingContent(share: IncomingShare, now: Date = new Date()): PendingContent | null {
  const receivedAt = now.toISOString();
  const file = share.files?.find((f) => isSupportedMime(f.mimeType));
  if (file) {
    const isVideo = file.mimeType.toLowerCase().startsWith('video/');
    return {
      kind: 'media',
      uri: toFileUri(file.path),
      name: file.fileName || (isVideo ? 'shared.mp4' : 'shared.jpg'),
      mimeType: file.mimeType.toLowerCase(),
      isVideo,
      origin: 'other_share',
      contentTarget: defaultTarget(isVideo),
      receivedAt,
    };
  }
  const url = share.webUrl ?? share.text?.match(/https?:\/\/\S+/)?.[0] ?? null;
  if (url) {
    return { kind: 'link', url, contentTarget: targetFromUrl(url) ?? 'other', receivedAt };
  }
  const text = share.text?.trim();
  if (text) return { kind: 'text', text: text.slice(0, 300), receivedAt };
  return null;
}
