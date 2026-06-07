import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "@/src/theme";

/**
 * A draw-to-sign pad for the in-app form renderer. React Native has no native
 * canvas, so this hosts a tiny self-contained HTML canvas in a WebView and posts
 * the signature back as a PNG data URL — consistent with the web form embed.
 */
function html(stroke: string, bg: string): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:${bg};overflow:hidden;touch-action:none}#c{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas><script>
var c=document.getElementById('c'),x=c.getContext('2d'),dr=false,dirty=false;
function size(){c.width=c.clientWidth||300;c.height=c.clientHeight||170;x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='${stroke}';}
size();window.addEventListener('resize',size);
function P(e){var r=c.getBoundingClientRect(),t=(e.touches&&e.touches[0])||e;return{x:t.clientX-r.left,y:t.clientY-r.top};}
function send(){try{window.ReactNativeWebView.postMessage(dirty?c.toDataURL('image/png'):'');}catch(e){}}
function d(e){dr=true;dirty=true;var p=P(e);x.beginPath();x.moveTo(p.x,p.y);e.preventDefault();}
function m(e){if(!dr)return;var p=P(e);x.lineTo(p.x,p.y);x.stroke();e.preventDefault();}
function u(){if(dr){dr=false;send();}}
c.addEventListener('mousedown',d);c.addEventListener('mousemove',m);window.addEventListener('mouseup',u);
c.addEventListener('touchstart',d,{passive:false});c.addEventListener('touchmove',m,{passive:false});c.addEventListener('touchend',u);
window.__clear=function(){x.clearRect(0,0,c.width,c.height);dirty=false;send();};
</script></body></html>`;
}

export default function SignaturePad({ onChange, height = 170 }: { onChange: (dataUrl: string) => void; height?: number }) {
  const ref = useRef<WebView>(null);
  const clear = () => ref.current?.injectJavaScript("window.__clear&&window.__clear();true;");
  return (
    <View>
      <View style={[styles.box, { height }]}>
        <WebView
          ref={ref}
          originWhitelist={["*"]}
          source={{ html: html(theme.textPrimary, theme.surface) }}
          style={styles.web}
          scrollEnabled={false}
          onMessage={(e) => onChange(e.nativeEvent.data || "")}
        />
      </View>
      <TouchableOpacity style={styles.clear} onPress={clear} testID="sig-clear">
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: theme.surface },
  web: { flex: 1, backgroundColor: "transparent" },
  clear: { alignSelf: "flex-end", marginTop: 6, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: theme.border, borderRadius: 8 },
  clearText: { color: theme.textMuted, fontSize: 12.5, fontWeight: "700" },
});
