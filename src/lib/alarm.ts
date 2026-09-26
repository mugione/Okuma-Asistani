/** Süre dolduğunda kısa, yumuşak bir uyarı sesi (WebAudio; ses dosyası gerekmez) ve titreşim. */
let ctx: AudioContext | null = null;

/** Tarayıcılar sesi ancak kullanıcı etkileşiminden sonra açar: "Başla"ya basınca çağrılır. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function playAlarm() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* titreşim desteklenmiyor */
  }
  if (!ctx) return;
  const now = ctx.currentTime;
  // Üç kısa, yükselen ton (do-mi-sol).
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
