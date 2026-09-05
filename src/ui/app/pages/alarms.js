(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { head, noServer } = A.View,
    { LIMITS: L } = SD.Constants;

  const units = unit => ['seconds', 'minutes', 'hours']
    .map(x => A.option(x, x[0].toUpperCase() + x.slice(1), unit === x))
    .join('');

  const alarmProfileIcon = () => `<span class="rule-entry-icon alarm-profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg></span>`;

  const profileEditor = (alarm, isDefault) => {
    const durationUnit = alarm.durationUnit || 'seconds';
    return `<div class="card editor-card alarm-profile-editor">` +
      `<div class="rule-editor-head">` +
      `<div>` +
      `<div class="section-title">Edit Alarm Profile</div>` +
      `<div class="muted">${isDefault ? 'Default profile' : 'Profile-specific alarm behavior'}</div>` +
      `</div>` +
      `<div class="row">` +
      `<button class="btn btn-primary btn-small" data-action="save-alarm">Save</button>` +
      `<button class="btn btn-small" data-action="close-alarm-profile">Close</button>` +
      `</div>` +
      `</div>` +
      `<div class="alarm-profile-editor-body">` +
      `<div class="grid-2">` +
      `<div class="field"><label>Name</label><input id="alarmProfileName" class="input" maxlength="80" value="${A.esc(alarm.name || '')}"></div>` +
      `<div class="field"><label>Sound</label><select id="alarmPreset" class="select" data-searchable="true">${SD.Constants.ALARM_PRESETS.map(x => A.option(x.id, x.name, alarm.preset === x.id)).join('')}</select></div>` +
      `<div class="field"><label>Stop method</label><select id="alarmStopMethod" class="select">${SD.Constants.ALARM_STOP_METHODS.map(x => A.option(x.id, x.name, alarm.stopMethod === x.id)).join('')}</select></div>` +
      `${alarm.stopMethod === 'keyboard' ? `<div class="field"><label>Keyboard shortcut</label><input id="alarmKeyboardShortcut" class="input" value="${A.esc(alarm.keyboardShortcut || '')}" placeholder="Ctrl+Shift+S"></div>` : ''}` +
      `${alarm.stopMethod === 'duration' ? `<div class="field"><label>Duration</label><div class="duration-control"><input id="alarmDuration" class="input" type="number" min="1" step="1" value="${A.esc(SD.Utils.timeFromSeconds(alarm.durationSeconds || 12, durationUnit))}"><select id="alarmDurationUnit" class="select">${units(durationUnit)}</select></div></div>` : ''}` +
      `<div class="field"><label>Volume · <strong id="alarmVolumeValue">${Math.round((Number(alarm.volume) || 0) * 100)}%</strong></label><input id="alarmVolume" class="range" data-range-key="alarm-volume" type="range" min="0" max="1" step="0.01" value="${Number(alarm.volume) || 0}"></div>` +
      `</div>` +
      `<div class="toggle-card-grid compact-toggle-grid section-gap">` +
      `<div class="toggle-card"><span><strong>Loop sound</strong></span><label class="master-switch"><input id="alarmLoop" type="checkbox" ${alarm.loop !== false ? 'checked' : ''}><span></span></label></div>` +
      `<div class="toggle-card"><span><strong>Use custom audio</strong></span><label class="master-switch"><input id="alarmUseCustom" type="checkbox" ${alarm.useCustom ? 'checked' : ''}><span></span></label></div>` +
      `</div>` +
      `<div class="field alarm-file-field section-gap"><label>Custom audio</label><div class="alarm-file-picker"><span class="file-name">${A.esc(alarm.customName || 'No custom file')}</span><button class="btn btn-small" type="button" data-action="choose-alarm-file">Choose File</button><input id="alarmFile" type="file" accept="audio/*" hidden></div></div>` +
      `<div class="row alarm-settings-actions section-gap">` +
      `<button class="btn" data-action="test-alarm">Test Alarm</button>` +
      `${!isDefault ? `<button class="btn" data-action="set-default-alarm-profile" data-id="${alarm.id}">Make Default</button>` : ''}` +
      `${alarm.customDataUrl ? `<button class="btn btn-small" data-action="clear-custom-alarm">Clear Custom Audio</button>` : ''}` +
      `<button class="btn btn-danger btn-small" data-action="delete-alarm-profile" ${A.profile()?.alarmProfiles?.length <= 1 ? 'disabled' : ''}>Delete</button>` +
      `</div>` +
      `<div class="input-limit">Custom audio maximum: ${Math.round(L.CUSTOM_SOUND_MAX_BYTES / 1024 / 1024)} MB</div>` +
      `</div>` +
      `</div>`;
  };

  A.pageAlarms = () => {
    const profile = A.profile();
    if (!profile) return noServer();

    const profiles = profile.alarmProfiles || [],
      active = Boolean(A.state?.runtime?.activeAlarm?.active),
      editing = profiles.find(x => x.id === A.alarmProfileDraftId) || null;

    if (!editing && A.alarmProfileDraftId) {
      A.alarmProfileDraftId = '';
      A.alarmDraft = null;
    }

    const rows = profiles.map(alarm => {
      const isDefault = alarm.id === profile.defaultAlarmProfileId,
        isEditing = editing?.id === alarm.id;
      return `<div class="configured-object-stack">` +
        `<div class="list-item rule-card alarm-profile-entry configured-object ${isEditing ? 'editing-object' : ''}" data-alarm-profile-id="${A.esc(alarm.id)}">` +
        `<div class="rule-card-main"><div class="row rule-card-title-row">${alarmProfileIcon()}<div class="list-title">${A.esc(alarm.name || 'Alarm Profile')}</div>${isDefault ? '<span class="alarm-default-label">Default</span>' : ''}</div></div>` +
        `<div class="row rule-card-actions alarm-profile-entry-actions">` +
        `<button class="btn btn-small" data-action="${isEditing ? 'close-alarm-profile' : 'edit-alarm-profile'}" data-id="${alarm.id}">${isEditing ? 'Close' : 'Edit'}</button>` +
        `<button class="btn btn-small" data-action="duplicate-alarm-profile" data-id="${alarm.id}">Duplicate</button>` +
        `</div></div>` +
        `${isEditing ? profileEditor(A.ensureAlarmDraft(), isDefault) : ''}` +
        `</div>`;
    }).join('');

    return `<section class="page alarm-profiles-page">` +
      `${head('Alarm Profiles', '', `<div class="row">${active ? '<button class="btn btn-stop-alarm btn-small" data-action="stop-alarm">STOP ALARM</button>' : ''}<button class="btn btn-primary btn-small" data-action="new-alarm-profile">+ Alarm Profile</button></div>`)}` +
      `<div class="configured-section">` +
      `<div class="section-kicker">Profiles for ${A.esc(profile.name)}</div>` +
      `<div class="card compact-configured-card"><div class="list alarm-profile-list">${rows || '<div class="empty">No Alarm Profiles configured.</div>'}</div></div>` +
      `</div>` +
      `</section>`;
  };
})();
