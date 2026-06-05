import { Platform } from "react-native";

export type Embed = { url: string; aspect: number };

// Twitch requires the embedding domain(s) as `parent`. On web we know it; on
// native we pass the deployed web host as a best-effort (Twitch is strict here).
function twitchParents(): string {
  const hosts =
    Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname
      ? [window.location.hostname]
      : ["nampo-web.onrender.com", "localhost"];
  return hosts.map((h) => `parent=${h}`).join("&");
}

/**
 * Detect an embeddable video link (YouTube, Twitch, Vimeo) in text and return
 * its player URL + aspect ratio, or null. First match wins.
 */
export function getEmbed(text?: string | null): Embed | null {
  if (!text) return null;
  let m: RegExpMatchArray | null;

  if ((m = text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/))) {
    return { url: `https://www.youtube.com/embed/${m[1]}?playsinline=1&rel=0`, aspect: 16 / 9 };
  }
  if ((m = text.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
    return { url: `https://player.vimeo.com/video/${m[1]}`, aspect: 16 / 9 };
  }

  const parents = twitchParents();
  if ((m = text.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/)) ||
      (m = text.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/))) {
    return { url: `https://clips.twitch.tv/embed?clip=${m[1]}&${parents}&autoplay=false`, aspect: 16 / 9 };
  }
  if ((m = text.match(/twitch\.tv\/videos\/(\d+)/))) {
    return { url: `https://player.twitch.tv/?video=${m[1]}&${parents}&autoplay=false`, aspect: 16 / 9 };
  }
  if ((m = text.match(/twitch\.tv\/([A-Za-z0-9_]{2,30})(?:[/?]|$|\s)/))) {
    const ch = m[1].toLowerCase();
    if (!["videos", "directory", "p", "downloads", "jobs", "settings", "subscriptions"].includes(ch)) {
      return { url: `https://player.twitch.tv/?channel=${m[1]}&${parents}&autoplay=false`, aspect: 16 / 9 };
    }
  }
  return null;
}
