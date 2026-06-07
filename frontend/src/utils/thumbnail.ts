import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { cloudinaryEnabled, uploadToCloudinary } from "@/src/api/cloudinary";

/**
 * Let the user pick an image to use as a reel/video cover and return a usable
 * URI string (a Cloudinary URL when configured, otherwise a base64 data URI).
 *
 * Returns `null` when the user cancels or permission is denied. Throws on a
 * real failure so callers can surface an alert.
 */
export async function pickThumbnailUri(): Promise<string | null> {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"] as any,
    quality: 0.7,
    base64: true,
    allowsEditing: true,
  });
  if (result.canceled) return null;
  const a = result.assets?.[0];
  if (!a) return null;

  // Preferred: push the cover to the CDN and store only its URL.
  if (cloudinaryEnabled()) {
    try {
      const up = await uploadToCloudinary(a.uri, "image");
      if (up?.url) return up.url;
    } catch {
      // fall through to the base64 path below
    }
  }
  if (a.base64) return `data:image/jpeg;base64,${a.base64}`;
  return a.uri || null;
}
