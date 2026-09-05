/**
 * Turns a pasted video link into something the page can embed.
 *
 * Teachers paste whatever the share button gave them, so accept the common
 * YouTube and Vimeo shapes rather than demanding one exact format. Anything
 * unrecognised still works — it renders as a link out instead of a player.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

/** Pulls the 11-character video id out of any YouTube URL shape. */
function youTubeId(url) {
  // youtu.be/<id> and /embed/<id>, /shorts/<id>, /live/<id>
  const path = url.pathname.split("/").filter(Boolean);

  if (url.hostname.endsWith("youtu.be")) return path[0] ?? null;
  if (["embed", "shorts", "live", "v"].includes(path[0])) return path[1] ?? null;

  // watch?v=<id>
  return url.searchParams.get("v");
}

function vimeoId(url) {
  const path = url.pathname.split("/").filter(Boolean);
  const id = path[0] === "video" ? path[1] : path[0];
  return /^\d+$/.test(id ?? "") ? id : null;
}

/**
 * Describes how to present a video link.
 * @returns {{kind: "embed"|"link", embedUrl?: string, href: string, provider: string}}
 */
export function describeVideo(rawUrl) {
  const href = (rawUrl ?? "").trim();

  let url;
  try {
    url = new URL(href);
  } catch {
    return { kind: "link", href, provider: "Video" };
  }

  // Only http(s) may be embedded or linked; javascript: and data: must not be.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "link", href: "", provider: "Video" };
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id = youTubeId(url);
    if (id) {
      const start = url.searchParams.get("t") ?? url.searchParams.get("start");
      const seconds = start ? String(parseInt(start, 10) || 0) : null;
      return {
        kind: "embed",
        provider: "YouTube",
        href,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}${seconds ? `?start=${seconds}` : ""}`,
      };
    }
  }

  if (VIMEO_HOSTS.has(url.hostname)) {
    const id = vimeoId(url);
    if (id) {
      return {
        kind: "embed",
        provider: "Vimeo",
        href,
        embedUrl: `https://player.vimeo.com/video/${id}`,
      };
    }
  }

  return { kind: "link", href, provider: url.hostname.replace(/^www\./, "") };
}

/** True when the link is a shape we can play inline. */
export function isEmbeddable(rawUrl) {
  return describeVideo(rawUrl).kind === "embed";
}
