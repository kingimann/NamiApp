# Media hosting with Cloudinary (optional but recommended)

By default the app embeds uploaded media as base64 inside the database, which
caps practical video size and bloats the feed payload. Point it at Cloudinary
and uploads go straight to a CDN — the database stores only a URL, video stops
being size-limited, and the feed gets lighter/faster.

The app auto-detects this: when the two env vars below are set it uploads to
Cloudinary; when they're unset it transparently falls back to the base64 path.

## 1. Create an unsigned upload preset (free)

1. Sign up at https://cloudinary.com (free tier is plenty to test).
2. Note your **Cloud name** (Dashboard → top of the page, e.g. `dxxxxxx`).
3. Settings (gear) → **Upload** → **Upload presets** → **Add upload preset**:
   - **Signing mode: Unsigned**
   - Save, and copy the preset **name** (e.g. `ml_default` or a custom one).

## 2. Set the env vars

Both are public `EXPO_PUBLIC_` vars baked into the build.

**Web (Render):** in the `okayspace-web` static site → Environment, add:
```
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME   = your-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET = your-unsigned-preset
```
Then **Manual Deploy → Clear build cache & deploy**.

**Native (EAS):**
```bash
cd frontend
eas env:create --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME   --value "your-cloud-name"      --visibility plaintext --environment production --environment preview
eas env:create --name EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET --value "your-unsigned-preset" --visibility plaintext --environment production --environment preview
```

## Notes
- Posts/reels (the PostComposer) use Cloudinary when configured. Chat, stories,
  and marketplace pickers still use base64 today; they can be migrated the same
  way (upload then store the URL) if needed.
- Display everywhere already prefers a CDN `url` over inline `base64`
  (`mediaUri()` in `src/api/client.ts`), so old base64 posts keep working.
- For tighter security later, switch to *signed* uploads (sign the request on
  the backend) instead of an unsigned preset.
