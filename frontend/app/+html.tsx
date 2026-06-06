// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%", overflow: "hidden" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Lock the document to the viewport so the page can't scroll/
                 rubber-band into empty white space on mobile Safari. App screens
                 scroll internally via ScrollView/FlatList. */
              html { height: 100%; overflow: hidden !important; overscroll-behavior: none !important; touch-action: manipulation; }
              body {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100%; height: 100%;
                margin: 0; overflow: hidden !important;
                overscroll-behavior: none !important;
                touch-action: manipulation;   /* block double-tap zoom; map keeps its own pinch */
              }
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
        {/* Block page pinch-zoom (iOS Safari ignores user-scalable=no). These iOS
            'gesture*' events only fire for multi-finger pinch, so normal taps and
            the app's own double-tap gestures are unaffected. (Double-tap-to-zoom
            is already disabled by touch-action above.) The map keeps its own zoom. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
              document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
              document.addEventListener('gestureend', function (e) { e.preventDefault(); }, { passive: false });
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          overscrollBehavior: "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
