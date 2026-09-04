(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  root.AlarmCatalog = Object.freeze({
    "beacon": {
      "name": "Beacon",
      "waveform": "sine",
      "sequence": [{ "frequency": 880, "duration": 180 }, { "frequency": 1175, "duration": 180 }, { "frequency": 0, "duration": 120 }, { "frequency": 880, "duration": 180 }, { "frequency": 1175, "duration": 220 }],
      "interval": 1450,
      "gainBoost": 1
    },
    "classic": {
      "name": "Classic Bell",
      "waveform": "triangle",
      "sequence": [{ "frequency": 740, "duration": 240 }, { "frequency": 0, "duration": 90 }, { "frequency": 740, "duration": 240 }, { "frequency": 0, "duration": 90 }, { "frequency": 980, "duration": 260 }],
      "interval": 1350,
      "gainBoost": 1
    },
    "pulse": {
      "name": "Soft Pulse",
      "waveform": "sine",
      "sequence": [{ "frequency": 520, "duration": 220 }, { "frequency": 660, "duration": 220 }, { "frequency": 520, "duration": 220 }],
      "interval": 1700,
      "gainBoost": 0.75
    },
    "chime": {
      "name": "Warm Chime",
      "waveform": "sine",
      "sequence": [{ "frequency": 660, "duration": 200 }, { "frequency": 880, "duration": 260 }, { "frequency": 1320, "duration": 300 }, { "frequency": 1760, "duration": 180 }],
      "interval": 1900,
      "gainBoost": 0.9
    },
    "urgent": {
      "name": "Urgent",
      "waveform": "square",
      "sequence": [{ "frequency": 1100, "duration": 120 }, { "frequency": 0, "duration": 55 }, { "frequency": 1100, "duration": 120 }, { "frequency": 0, "duration": 55 }, { "frequency": 1450, "duration": 170 }],
      "interval": 820,
      "gainBoost": 1.25
    },
    "rapid": {
      "name": "Rapid Alert",
      "waveform": "square",
      "sequence": [
        { "frequency": 1250, "duration": 85 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1250, "duration": 85 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1250, "duration": 85 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1500, "duration": 110 }
      ],
      "interval": 640,
      "gainBoost": 1.35
    },
    "siren": { "name": "Siren Sweep", "waveform": "sawtooth", "sweep": true, "sequence": [{ "from": 650, "to": 1450, "duration": 520 }, { "from": 1450, "to": 650, "duration": 520 }], "interval": 1150, "gainBoost": 1.2 },
    "alarmClock": {
      "name": "Alarm Clock",
      "waveform": "square",
      "sequence": [
        { "frequency": 950, "duration": 180 },
        { "frequency": 0, "duration": 70 },
        { "frequency": 950, "duration": 180 },
        { "frequency": 0, "duration": 220 },
        { "frequency": 950, "duration": 180 },
        { "frequency": 0, "duration": 70 },
        { "frequency": 950, "duration": 180 }
      ],
      "interval": 1250,
      "gainBoost": 1.3
    },
    "critical": {
      "name": "Critical",
      "waveform": "square",
      "sequence": [
        { "frequency": 1500, "duration": 100 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1700, "duration": 100 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1900, "duration": 160 },
        { "frequency": 0, "duration": 70 },
        { "frequency": 1500, "duration": 100 },
        { "frequency": 0, "duration": 45 },
        { "frequency": 1900, "duration": 180 }
      ],
      "interval": 760,
      "gainBoost": 1.45
    },
    "hammer": {
      "name": "Hammer Pulse",
      "waveform": "square",
      "sequence": [
        { "frequency": 420, "duration": 120 },
        { "frequency": 0, "duration": 60 },
        { "frequency": 420, "duration": 120 },
        { "frequency": 0, "duration": 180 },
        { "frequency": 420, "duration": 120 },
        { "frequency": 0, "duration": 60 },
        { "frequency": 420, "duration": 160 }
      ],
      "interval": 950,
      "gainBoost": 1.4
    },
    "sonar": { "name": "Sonar", "waveform": "sine", "sequence": [{ "frequency": 740, "duration": 90 }, { "frequency": 0, "duration": 160 }, { "frequency": 740, "duration": 90 }], "interval": 1300, "gainBoost": 1.05 },
    "radar": {
      "name": "Radar",
      "waveform": "triangle",
      "sequence": [{ "frequency": 620, "duration": 110 }, { "frequency": 0, "duration": 80 }, { "frequency": 820, "duration": 110 }, { "frequency": 0, "duration": 80 }, { "frequency": 1020, "duration": 140 }],
      "interval": 1180,
      "gainBoost": 1.1
    },
    "flightDeck": {
      "name": "Flight Deck",
      "waveform": "square",
      "sequence": [{ "frequency": 760, "duration": 120 }, { "frequency": 0, "duration": 45 }, { "frequency": 960, "duration": 120 }, { "frequency": 0, "duration": 45 }, { "frequency": 1160, "duration": 170 }],
      "interval": 880,
      "gainBoost": 1.25
    },
    "towerPing": { "name": "Tower Ping", "waveform": "sine", "sequence": [{ "frequency": 1040, "duration": 120 }, { "frequency": 0, "duration": 80 }, { "frequency": 1280, "duration": 150 }], "interval": 1500, "gainBoost": 1 },
    "warningPulse": {
      "name": "Warning Pulse",
      "waveform": "square",
      "sequence": [{ "frequency": 980, "duration": 140 }, { "frequency": 0, "duration": 70 }, { "frequency": 980, "duration": 140 }, { "frequency": 0, "duration": 70 }, { "frequency": 1180, "duration": 180 }],
      "interval": 900,
      "gainBoost": 1.32
    },
    "tripleBeep": {
      "name": "Triple Beep",
      "waveform": "sine",
      "sequence": [{ "frequency": 880, "duration": 95 }, { "frequency": 0, "duration": 75 }, { "frequency": 880, "duration": 95 }, { "frequency": 0, "duration": 75 }, { "frequency": 880, "duration": 120 }],
      "interval": 1200,
      "gainBoost": 1
    },
    "softBell": {
      "name": "Soft Bell",
      "waveform": "triangle",
      "sequence": [{ "frequency": 560, "duration": 220 }, { "frequency": 700, "duration": 260 }, { "frequency": 900, "duration": 320 }],
      "interval": 2300,
      "gainBoost": 0.8
    },
    "deepAlert": {
      "name": "Deep Alert",
      "waveform": "square",
      "sequence": [{ "frequency": 360, "duration": 180 }, { "frequency": 0, "duration": 90 }, { "frequency": 430, "duration": 220 }],
      "interval": 1120,
      "gainBoost": 1.35
    },
    "cleanPing": { "name": "Clean Ping", "waveform": "sine", "sequence": [{ "frequency": 1200, "duration": 130 }, { "frequency": 1520, "duration": 160 }], "interval": 1700, "gainBoost": 0.9 },
    "highTone": {
      "name": "High Tone",
      "waveform": "sine",
      "sequence": [{ "frequency": 1600, "duration": 160 }, { "frequency": 0, "duration": 90 }, { "frequency": 1600, "duration": 160 }],
      "interval": 1250,
      "gainBoost": 1.05
    },
    "lowTone": { "name": "Low Tone", "waveform": "sine", "sequence": [{ "frequency": 380, "duration": 250 }, { "frequency": 0, "duration": 100 }, { "frequency": 420, "duration": 250 }], "interval": 1550, "gainBoost": 1.1 },
    "doubleChime": {
      "name": "Double Chime",
      "waveform": "triangle",
      "sequence": [{ "frequency": 660, "duration": 160 }, { "frequency": 880, "duration": 220 }, { "frequency": 0, "duration": 180 }, { "frequency": 660, "duration": 160 }, { "frequency": 880, "duration": 260 }],
      "interval": 2100,
      "gainBoost": 0.95
    },
    "signalSweep": { "name": "Signal Sweep", "waveform": "sawtooth", "sweep": true, "sequence": [{ "from": 520, "to": 980, "duration": 420 }, { "from": 980, "to": 720, "duration": 300 }], "interval": 1350, "gainBoost": 1.1 },
    "warningSweep": { "name": "Warning Sweep", "waveform": "sawtooth", "sweep": true, "sequence": [{ "from": 850, "to": 1650, "duration": 430 }, { "from": 1650, "to": 850, "duration": 430 }], "interval": 980, "gainBoost": 1.3 },
    "digitalAlert": {
      "name": "Digital Alert",
      "waveform": "square",
      "sequence": [{ "frequency": 1320, "duration": 70 }, { "frequency": 0, "duration": 40 }, { "frequency": 1480, "duration": 70 }, { "frequency": 0, "duration": 40 }, { "frequency": 1640, "duration": 100 }],
      "interval": 720,
      "gainBoost": 1.2
    },
    "attention": {
      "name": "Attention",
      "waveform": "triangle",
      "sequence": [{ "frequency": 880, "duration": 260 }, { "frequency": 0, "duration": 120 }, { "frequency": 1040, "duration": 320 }],
      "interval": 1800,
      "gainBoost": 1.05
    },
    "priority": {
      "name": "Priority",
      "waveform": "square",
      "sequence": [{ "frequency": 1120, "duration": 110 }, { "frequency": 0, "duration": 55 }, { "frequency": 1320, "duration": 110 }, { "frequency": 0, "duration": 55 }, { "frequency": 1520, "duration": 150 }],
      "interval": 820,
      "gainBoost": 1.35
    },
    "dispatch": {
      "name": "Dispatch",
      "waveform": "sine",
      "sequence": [{ "frequency": 600, "duration": 120 }, { "frequency": 760, "duration": 120 }, { "frequency": 920, "duration": 160 }, { "frequency": 0, "duration": 100 }, { "frequency": 920, "duration": 160 }],
      "interval": 1300,
      "gainBoost": 1.05
    },
    "scanner": { "name": "Scanner", "waveform": "sawtooth", "sweep": true, "sequence": [{ "from": 440, "to": 1200, "duration": 360 }, { "from": 1200, "to": 440, "duration": 360 }], "interval": 1120, "gainBoost": 1.1 },
    "systemReady": {
      "name": "System Ready",
      "waveform": "sine",
      "sequence": [{ "frequency": 520, "duration": 130 }, { "frequency": 660, "duration": 130 }, { "frequency": 820, "duration": 180 }],
      "interval": 1900,
      "gainBoost": 0.85
    },
    "notify": { "name": "Notify", "waveform": "sine", "sequence": [{ "frequency": 880, "duration": 150 }, { "frequency": 0, "duration": 80 }, { "frequency": 1175, "duration": 180 }], "interval": 1600, "gainBoost": 0.95 },
    "alertOne": {
      "name": "Alert One",
      "waveform": "triangle",
      "sequence": [{ "frequency": 700, "duration": 180 }, { "frequency": 0, "duration": 80 }, { "frequency": 900, "duration": 220 }],
      "interval": 1400,
      "gainBoost": 1
    },
    "alertTwo": {
      "name": "Alert Two",
      "waveform": "square",
      "sequence": [{ "frequency": 850, "duration": 120 }, { "frequency": 0, "duration": 55 }, { "frequency": 1050, "duration": 120 }, { "frequency": 0, "duration": 55 }, { "frequency": 1250, "duration": 170 }],
      "interval": 860,
      "gainBoost": 1.25
    },
    "alertThree": {
      "name": "Alert Three",
      "waveform": "sawtooth",
      "sweep": true,
      "sequence": [{ "from": 700, "to": 1550, "duration": 360 }, { "from": 1550, "to": 700, "duration": 360 }, { "frequency": 0, "duration": 70 }, { "from": 900, "to": 1650, "duration": 300 }],
      "interval": 920,
      "gainBoost": 1.35
    }
  });
})();
