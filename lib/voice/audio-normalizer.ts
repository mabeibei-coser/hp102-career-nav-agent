/** Client-side audio helpers (normalize / play). Kept minimal for HP102. */

export async function ensureAudioCtxUnlocked(
  ctx: AudioContext,
): Promise<void> {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

export async function decodeAndNormalize(
  ctx: AudioContext,
  base64: string,
): Promise<AudioBuffer> {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const decoded = await ctx.decodeAudioData(raw.buffer.slice(0));
  let peak = 0;
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]!));
    }
  }
  if (peak > 0 && peak < 0.9) {
    const gain = Math.min(0.9 / peak, 4);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < data.length; i++) data[i]! *= gain;
    }
  }
  return decoded;
}

export async function playNormalized(
  ctx: AudioContext,
  buffer: AudioBuffer,
): Promise<void> {
  await ensureAudioCtxUnlocked(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
  });
}
