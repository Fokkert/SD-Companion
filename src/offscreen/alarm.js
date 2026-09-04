let ctx = null, active = [], stopTimer = null, repeatTimer = null, audio = null;
const catalog = globalThis.SDCompanion?.AlarmCatalog || {};
const notifyEnded = () => {
  try {
    chrome.runtime.sendMessage({ type: "SD_OFFSCREEN_ENDED" }).catch(() => {});
  } catch {}
};
const clearLocal = () => {
  if (stopTimer) clearTimeout(stopTimer);
  if (repeatTimer) clearTimeout(repeatTimer);
  stopTimer = null;
  repeatTimer = null;
  for (const x of active) try {
    x.stop();
  } catch {}
  active = [];
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
  }
};
const stop = (notify = false) => {
  clearLocal();
  if (notify) notifyEnded();
};
const timed = cfg => ["duration", "duration-or-controls", "notification-controls", "any-interaction"].includes(cfg.stopMethod || "duration-or-controls");
const scheduleTone = (cfg, preset) => {
  const rawVolume = Number(cfg.volume),
    volume = Math.max(0, Math.min(1, Number.isFinite(rawVolume) ? rawVolume : .8)),
    boost = Math.max(.25, Number(preset.gainBoost) || 1),
    start = ctx.currentTime + .01;
  let cursor = start;
  for (const step of preset.sequence || []) {
    const ms = Math.max(10, Number(step.duration) || 100), seconds = ms / 1000;
    if (step.frequency === 0) {
      cursor += seconds;
      continue;
    }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = preset.waveform || 'sine';
    if (step.from != null && step.to != null) {
      o.frequency.setValueAtTime(Number(step.from), cursor);
      o.frequency.linearRampToValueAtTime(Number(step.to), cursor + seconds);
    }
    else {
      o.frequency.setValueAtTime(Number(step.frequency) || 660, cursor);
    }
    const peak = Math.max(.001, Math.min(.42, volume * .17 * boost));
    g.gain.setValueAtTime(.0001, cursor);
    g.gain.exponentialRampToValueAtTime(peak, cursor + .012);
    g.gain.setValueAtTime(peak, Math.max(cursor + .013, cursor + seconds - .035));
    g.gain.exponentialRampToValueAtTime(.0001, cursor + seconds);
    o.connect(g).connect(ctx.destination);
    o.start(cursor);
    o.stop(cursor + seconds + .03);
    active.push(o);
    o.onended = () => {
      const i = active.indexOf(o);
      if (i >= 0) active.splice(i, 1);
    };
    cursor += seconds;
  }
  return Math.max(160, Number(preset.interval) || Math.ceil((cursor - start) * 1000 + 280));
};
const tone = async cfg => {
  ctx = ctx || new AudioContext();
  await ctx.resume();
  const preset = catalog[cfg.preset] || catalog.radar || catalog.beacon;
  if (!preset) return;
  const loop = cfg.loop !== false;
  const play = () => scheduleTone(cfg, preset);
  const repeat = play();
  if (loop) {
    const repeatFn = () => {
      repeatTimer = setTimeout(() => {
        play();
        repeatFn();
      }, repeat);
    };
    repeatFn();
  }
  else if (!timed(cfg)) {
    stopTimer = setTimeout(() => {
      clearLocal();
      notifyEnded();
    }, repeat + 100);
  }
  if (timed(cfg)) stopTimer = setTimeout(() => {
    clearLocal();
    notifyEnded();
  }, Math.max(.2, Number(cfg.durationSeconds) || 12) * 1000);
};
const actionBell = async () => {
  ctx = ctx || new AudioContext();
  await ctx.resume();
  const start = ctx.currentTime + .01;
  const notes = [{ f: 620, t: start, d: .09 }, { f: 820, t: start + .095, d: .13 }];
  for (const n of notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(n.f, n.t);
    g.gain.setValueAtTime(.0001, n.t);
    g.gain.exponentialRampToValueAtTime(.022, n.t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, n.t + n.d);
    o.connect(g).connect(ctx.destination);
    o.start(n.t);
    o.stop(n.t + n.d + .02);
  }
};
const custom = cfg => {
  audio = new Audio(cfg.customDataUrl);
  const rawVolume = Number(cfg.volume);
  audio.volume = Math.max(0, Math.min(1, Number.isFinite(rawVolume) ? rawVolume : .8));
  audio.loop = cfg.loop !== false;
  audio.addEventListener('ended', () => {
    if (!audio?.loop) {
      clearLocal();
      notifyEnded();
    }
  }, { once: true });
  audio.play().catch(() => {});
  if (timed(cfg)) stopTimer = setTimeout(() => {
    clearLocal();
    notifyEnded();
  }, Math.max(.2, Number(cfg.durationSeconds) || 12) * 1000);
};
chrome.runtime.onMessage.addListener(m => {
  if (m?.type === "SD_OFFSCREEN_COMPLETION") {
    actionBell().catch(() => {});
    return;
  }
  if (m?.type === "SD_OFFSCREEN_STOP") {
    stop(false);
    return;
  }
  if (m?.type === "SD_OFFSCREEN_PLAY") {
    stop(false);
    const cfg = m.alarm || {};
    cfg.useCustom && cfg.customDataUrl ? custom(cfg) : tone(cfg);
  }
});
