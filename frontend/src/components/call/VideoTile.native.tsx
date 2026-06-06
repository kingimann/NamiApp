// Native: render a LiveKit video track. Uses @livekit/react-native's VideoTrack
// component (driven by a TrackReference: { participant, publication, source }).
import React from "react";
import { View } from "react-native";
import { VideoTrack } from "@livekit/react-native";

export default function VideoTile({
  trackRef,
  style,
  mirror,
}: {
  trackRef: any;
  style?: any;
  mirror?: boolean;
}) {
  if (!trackRef?.publication?.track) return <View style={style} />;
  return (
    <VideoTrack
      trackRef={trackRef}
      style={style}
      objectFit="cover"
      mirror={!!mirror}
    />
  );
}
