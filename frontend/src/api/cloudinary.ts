// Direct (unsigned) uploads to Cloudinary so large media (esp. video) goes to a
// CDN instead of being embedded as base64 in the database.
//
// Configure with two public env vars (baked into the build at export time):
//   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME   e.g. "dxxxxxx"
//   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET  an *unsigned* upload preset name
//
// When unset, callers fall back to the existing base64 path automatically.

const CLOUD_NAME = (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME as string) || "";
const UPLOAD_PRESET = (process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string) || "";

export const cloudinaryEnabled = (): boolean => !!CLOUD_NAME && !!UPLOAD_PRESET;

export type CloudinaryResult = {
  url: string;
  width?: number | null;
  height?: number | null;
  // For videos, Cloudinary can produce a poster image by swapping the extension.
  thumbnail?: string | null;
};

/**
 * Upload a local/remote media file to Cloudinary and return its secure URL.
 * `uri` may be a file://, content://, blob:, or data: URI (works on web + native).
 * `kind` picks the Cloudinary resource type.
 */
export async function uploadToCloudinary(
  uri: string,
  kind: "image" | "video",
): Promise<CloudinaryResult> {
  if (!cloudinaryEnabled()) {
    throw new Error("Cloudinary is not configured");
  }
  const resourceType = kind === "video" ? "video" : "image";
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const form = new FormData();
  // On web a data:/blob: URI must be sent as a Blob; on native, RN accepts the
  // { uri, name, type } shape directly.
  if (typeof FormData !== "undefined" && uri.startsWith("data:")) {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob);
  } else if (uri.startsWith("blob:") || uri.startsWith("http")) {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob);
  } else {
    // React Native local file path
    const name = uri.split("/").pop() || (kind === "video" ? "upload.mp4" : "upload.jpg");
    const type = kind === "video" ? "video/mp4" : "image/jpeg";
    // @ts-expect-error RN FormData file shape
    form.append("file", { uri, name, type });
  }
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch {}
    throw new Error(`Cloudinary upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  const url: string = data.secure_url || data.url;
  let thumbnail: string | null = null;
  if (resourceType === "video" && url) {
    // Cloudinary derives a poster frame by changing the extension to .jpg.
    thumbnail = url.replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, ".jpg$2");
  }
  return { url, width: data.width ?? null, height: data.height ?? null, thumbnail };
}
