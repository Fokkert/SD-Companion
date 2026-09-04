(() => {
  const A = globalThis.SDApp, { head } = A.View;
  A.pageAppearance = () => {
    if (!A.appearanceDraftTheme) A.appearanceDraftTheme = A.state.appearance?.theme || "emerald-glass";
    const current = A.appearanceDraftTheme,
      themes = [
        ['emerald-glass', 'Emerald Dark', '#45ef94', '#0d6a43', 'Deep forest'],
        ['midnight-glass', 'Midnight', '#6693ff', '#09142f', 'Near-black navy'],
        ['graphite-glass', 'Graphite', '#d0d5dc', '#31343a', 'Neutral charcoal'],
        ['violet-glass', 'Violet Dusk', '#c58cff', '#4c276d', 'Purple medium-dark'],
        ['amber-glass', 'Amber Smoke', '#ffc45c', '#5a3711', 'Warm bronze'],
        ['frost-light', 'Frost Light', '#e9f4ff', '#1677c8', 'Cool light']
      ];
    return `<section class="page appearance-page">${head("Appearance", "", `<div class="row"><button class="btn btn-primary btn-small" data-action="save-appearance">Save</button><button class="btn btn-small" data-action="cancel-appearance">Reset</button></div>`)}<div class="card">` +
      `<div class="section-title">Themes</div>` +
      `<div class="theme-grid theme-grid-varied section-gap">${themes.map(([id, n, c1, c2, d]) => `<button class="theme-swatch ${current === id ? "active" : ""}" data-action="theme-draft" data-theme="${id}" style="--sw1:${c1};--sw2:${c2}"><i></i><b>${n}</b><small>${d}</small></button>`).join("")}</div></div></section>`;
  };
})();
