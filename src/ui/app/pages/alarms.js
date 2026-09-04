(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { head, noServer } = A.View,
    { LIMITS: L } = SD.Constants;
  const units = u => ['seconds', 'minutes', 'hours'].map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
  A.pageAlarms = () => {
    const p = A.profile();
    if (!p) return noServer();
    const a = A.ensureAlarmDraft?.() || (p.alarmProfiles || [])[0] || {},
      active = A.state?.runtime?.activeAlarm?.active,
      perm = A.state?.runtime?.notificationPermission || "unknown",
      permLabel = perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked" : "Unchecked",
      du = a.durationUnit || 'seconds';
    return `<section class="page">${head("Alarm Profiles", "", active ? `<button class="btn btn-stop-alarm" data-action="stop-alarm">STOP ALARM</button>` : "")}
<div class="card alarm-studio-card">
  <div class="alarm-studio-section">` +
      `<div class="section-kicker">Sound & playback</div>` +
      `<div class="grid-2">` +
      `<div class="field">` +
      `<label>Sound</label>` +
      `<select id="alarmPreset" class="select">${SD.Constants.ALARM_PRESETS.map(x => A.option(x.id, x.name, a.preset === x.id)).join("")}</select>` +
      `</div>` +
      `<div class="field">` +
      `<label>Volume · <strong id="alarmVolumeValue">${Math.round((Number(a.volume) || 0) * 100)}%</strong>` +
      `</label>` +
      `<input id="alarmVolume" class="range" data-range-key="alarm-volume" type="range" min="0" max="1" step="0.01" value="${Number(a.volume) || 0}">` +
      `</div>` +
      `</div>` +
      `<div class="toggle-card-grid compact-toggle-grid">` +
      `<div class="toggle-card">` +
      `<label class="master-switch">` +
      `<input id="alarmLoop" type="checkbox" ${a.loop ? "checked" : ""}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `<span>` +
      `<strong>Loop sound</strong>` +
      `</span>` +
      `</div>` +
      `<div class="toggle-card">` +
      `<label class="master-switch">` +
      `<input id="alarmUseCustom" type="checkbox" ${a.useCustom ? "checked" : ""}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `<span>` +
      `<strong>Use custom audio</strong>` +
      `</span>` +
      `</div>` +
      `</div>` +
      `<div class="field section-gap">` +
      `<label>Custom audio</label>` +
      `<input id="alarmFile" class="input file-input" type="file" accept="audio/*">` +
      `<span class="file-name">${A.esc(a.customName || "No custom file")}</span>` +
      `</div>` +
      `</div>
  <div class="alarm-studio-section">` +
      `<div class="section-kicker">Stopping</div>` +
      `<div class="grid-2">` +
      `<div class="field">` +
      `<label>Stop behavior</label>` +
      `<select id="alarmStopMethod" class="select">${SD.Constants.ALARM_STOP_METHODS.map(x => A.option(x.id, x.name, a.stopMethod === x.id)).join("")}</select>` +
      `</div>` +
      `<div class="field">` +
      `<label>Duration</label>` +
      `<div class="duration-control">` +
      `<input id="alarmDuration" class="input" type="number" min="1" step="1" value="${A.esc(SD.Utils.timeFromSeconds(a.durationSeconds || 12, du))}">` +
      `<select id="alarmDurationUnit" class="select">${units(du)}</select>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</div>
  <div class="alarm-studio-actions">` +
      `<button class="btn btn-primary" data-action="test-alarm">Test Alarm</button>` +
      `<button class="btn" data-action="save-alarm">Save Alarm Profile</button>${a.customDataUrl ? `<button class="btn" data-action="clear-custom-alarm">Clear Custom Audio</button>` : ""}</div>` +
      `<div class="input-limit">Custom audio maximum: ${Math.round(L.CUSTOM_SOUND_MAX_BYTES / 1024 / 1024)} MB</div>
</div></section>`;
  };
})();
