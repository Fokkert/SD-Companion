(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    states = new Map(),
    sleep = root.Utils.sleep;
  const stateFor = id => {
    if (!states.has(id)) states.set(id, { recent: [], lastAt: 0, active: 0, backoffUntil: 0 });
    return states.get(id);
  };
  const wait = async (ms, opId) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      root.Operations?.throwIfCancelled(opId);
      await sleep(Math.min(250, end - Date.now()));
    }
  };
  const before = async (site, opId = '') => {
    const p = site.network?.requestPolicy || {},
      s = stateFor(site.id),
      maxConcurrent = Math.max(1, Math.min(4, Number(p.maxConcurrent) || 1)),
      rpm = Math.max(10, Math.min(600, Number(p.maxRequestsPerMinute) || 120)),
      spacing = Math.max(100, Math.min(10000, Number(p.spacingMs) || 350)),
      j = Math.max(0, Math.min(50, Number(p.jitterPercent) || 0)) / 100;
    while (true) {
      root.Operations?.throwIfCancelled(opId);
      const now = Date.now();
      s.recent = s.recent.filter(t => now - t < 60000);
      const waitBackoff = Math.max(0, s.backoffUntil - now),
        waitConcurrency = s.active >= maxConcurrent ? 100 : 0,
        waitRate = s.recent.length >= rpm ? Math.max(100, 60000 - (now - s.recent[0])) : 0,
        target = spacing * (1 + (Math.random() * 2 - 1) * j),
        waitSpacing = Math.max(0, target - (now - s.lastAt)),
        ms = Math.max(waitBackoff, waitConcurrency, waitRate, waitSpacing);
      if (ms > 0) {
        await wait(ms, opId);
        continue;
      }
      s.active++;
      s.lastAt = Date.now();
      s.recent.push(s.lastAt);
      return;
    }
  };
  const after = (site, { status = 200, retryAfterSeconds = 0 } = {}) => {
    const s = stateFor(site.id);
    s.active = Math.max(0, s.active - 1);
    if (status === 429 || status === 503) {
      const max = Math.max(1, Math.min(300, Number(site.network?.requestPolicy?.backoffMaxSeconds) || 60)),
        sec = Math.min(max, retryAfterSeconds || Math.max(2, Math.ceil((s.backoffUntil - Date.now()) / 1000) * 2 || 2));
      s.backoffUntil = Date.now() + sec * 1000;
    }
    else if (status >= 200 && status < 500) s.backoffUntil = Math.min(s.backoffUntil, Date.now());
  };
  const release = site => {
    const s = stateFor(site.id);
    s.active = Math.max(0, s.active - 1);
  };
  root.RequestScheduler = Object.freeze({ before, after, release });
})();
