// رؤية حاسوبية ظاهرة: نرسم نقاط اليد والذراعين اللي يقرأها MediaPipe فوق الفيديو
import type { HolisticResults } from "@/lib/aslWords";

type Point = { x: number; y: number };

const HAND: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]; // prettier-ignore

// الكتفين والمرفقين والرسغين (أرقام MediaPipe Pose)
const ARMS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];

export function drawLandmarks(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  r: HolisticResults,
) {
  const w = video.videoWidth,
    h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const s = Math.max(w, h) / 640; // نفس السماكة مهما كان حجم الكاميرا
  const line = (pts: Point[], pairs: [number, number][], color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [a, b] of pairs) {
      if (!pts[a] || !pts[b]) continue;
      ctx.moveTo(pts[a].x * w, pts[a].y * h);
      ctx.lineTo(pts[b].x * w, pts[b].y * h);
    }
    ctx.stroke();
  };
  const dots = (pts: Point[], ids: number[], color: string, radius: number) => {
    ctx.fillStyle = color;
    for (const i of ids) {
      if (!pts[i]) continue;
      ctx.beginPath();
      ctx.arc(pts[i].x * w, pts[i].y * h, radius * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  if (r.poseLandmarks) {
    line(r.poseLandmarks, ARMS, "rgba(167, 139, 250, 0.55)", 3);
    dots(r.poseLandmarks, [11, 12, 13, 14, 15, 16], "rgba(196, 181, 253, 0.8)", 4);
  }
  for (const hand of [r.rightHandLandmarks, r.leftHandLandmarks]) {
    if (!hand) continue;
    line(hand, HAND, "rgba(139, 92, 246, 0.95)", 3);
    dots(hand, [...Array(21).keys()], "#ffffff", 3.5);
    dots(hand, [4, 8, 12, 16, 20], "#c4b5fd", 4.5); // أطراف الأصابع
  }
}
