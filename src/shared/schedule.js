(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const validTime = v => /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(String(v || ""));
  const seconds = v => {
    const [h, m, s] = String(v).split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };
  const parts = (date, timeZone) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const p = Object.fromEntries(fmt.formatToParts(date).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: dayMap[p.weekday], date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}`, secondOfDay: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
  };
  const isActive = (schedule, date = new Date()) => {
    if (!schedule || schedule.enabled === false) return false;
    const z = parts(date, schedule.timeZone);
    if (schedule.startDate && z.date < schedule.startDate) return false;
    if (schedule.endDate && z.date > schedule.endDate) return false;
    const days = (schedule.days || []).map(Number);
    const start = validTime(schedule.startTime) ? seconds(schedule.startTime) : 0;
    const end = validTime(schedule.endTime) ? seconds(schedule.endTime) : 86399;
    if (start <= end) return (!days.length || days.includes(z.day)) && z.secondOfDay >= start && z.secondOfDay <= end;
    // Overnight shifts: after start belongs to today's selected day; before end belongs to the previous selected day.
    if (z.secondOfDay >= start) return !days.length || days.includes(z.day);
    const previous = (z.day + 6) % 7;
    return z.secondOfDay <= end && (!days.length || days.includes(previous));
  };
  const matchesAny = (schedules, ids, date = new Date()) => {
    const wanted = (ids || []).filter(Boolean);
    if (!wanted.length) return false;
    const byId = new Map((schedules || []).map(s => [s.id, s]));
    return wanted.some(id => isActive(byId.get(id), date));
  };
  const describe = schedule => {
    const days = (schedule.days || []).length ? schedule.days.map(x => root.Constants.DAYS.find(d => d.id === Number(x))?.short).filter(Boolean).join(", ") : "Every day";
    return `${days} · ${schedule.startTime || "00:00:00"}–${schedule.endTime || "23:59:59"} · ${schedule.timeZone || "Browser timezone"}`;
  };
  root.Schedule = Object.freeze({ validTime, parts, isActive, matchesAny, describe });
})();
