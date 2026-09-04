(() => {
  const A = globalThis.SDApp, { head } = A.View;
  A.pageAppearance = () => {
    if (!A.appearanceDraftTheme) A.appearanceDraftTheme = A.state.appearance?.theme || "emerald-glass";
    const current = A.appearanceDraftTheme,
      themes = [
        ['emerald-glass', 'Emerald Dark', '#45ef94', '#0d6a43'],
        ['midnight-glass', 'Midnight', '#6693ff', '#09142f'],
        ['graphite-glass', 'Graphite', '#d0d5dc', '#31343a'],
        ['violet-glass', 'Violet Dusk', '#c58cff', '#4c276d'],
        ['amber-glass', 'Amber Smoke', '#ffc45c', '#5a3711'],
        ['crimson-glass', 'Crimson Night', '#ff6f86', '#56101f'],
        ['ocean-glass', 'Ocean Night', '#4ed3e7', '#0b4a58'],
        ['copper-glass', 'Copper Night', '#e9874f', '#5a2613']
      ];
    return `<section class="page appearance-page">${head("Appearance", "", `<div class="row"><button class="btn btn-primary btn-small" data-action="save-appearance">Save</button><button class="btn btn-small" data-action="cancel-appearance">Reset</button></div>`)}<div class="card">` +
      `<div class="section-title">Themes</div>` +
      `<div class="theme-grid theme-grid-varied section-gap">${themes.map(([id, n, c1, c2]) => `<button class="theme-swatch ${current === id ? "active" : ""}" data-action="theme-draft" data-theme="${id}" style="--sw1:${c1};--sw2:${c2}"><i></i><b>${n}</b></button>`).join("")}</div></div></section>`;
  };
})();
