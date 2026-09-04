(() => {
  const A = globalThis.SDApp;
  A.renderPage = () => {
    A.closeSoftSelects?.();
    const host = A.$("pageHost");
    const fn = {
      home: A.pageHome,
      bulk: A.pageBulkOperations,
      servers: A.pageServers,
      data: A.pageData,
      rules: A.pageRules,
      schedules: A.pageSchedules,
      profiles: A.pageProfiles,
      health: A.pageHealth,
      appearance: A.pageAppearance,
      alarms: A.pageAlarms,
      logs: A.pageLogs,
      audit: A.pageAudit,
      maintenance: A.pageMaintenance,
      help: A.pageHelp,
      settings: A.pageSettings
    }[A.page] || A.pageHome;
    try {
      host.innerHTML = fn();
    } catch (err) {
      console.error(`SD Companion page render failed: ${A.page}`, err);
      host.innerHTML = `<section class="page">` +
        `<div class="page-head">` +
        `<div>` +
        `<h1>${A.esc(A.page[0]?.toUpperCase() + A.page.slice(1) || "Page")}</h1>` +
        `<p>This page could not be rendered. Your saved configuration was not changed.</p>` +
        `</div>` +
        `</div>` +
        `<div class="card notice bad">` +
        `<b>UI render error</b>` +
        `<div class="help" style="margin-top:8px">${A.esc(err?.message || String(err))}</div>` +
        `<div class="row" style="margin-top:12px">` +
        `<button class="btn btn-primary" data-action="refresh-ui">Retry</button>` +
        `<button class="btn" data-page="home">Home</button>` +
        `</div>` +
        `</div>` +
        `</section>`;
      A.toast?.(`Could not render ${A.page}: ${err?.message || err}`, "error");
    }
    document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === A.page || (A.page === "settings" && b.dataset.nav === "settings")));
    document.querySelectorAll("[data-favicon]").forEach(img => img.addEventListener("error", () => {
      if (img.dataset.fallback) {
        img.src = img.dataset.fallback;
        delete img.dataset.fallback;
        img.removeAttribute("data-favicon");
        return;
      }
      const parent = img.parentElement;
      parent.textContent = (A.site()?.name || "SD").slice(0, 2).toUpperCase();
    }));
    document.querySelectorAll("[data-entity-icon]").forEach(img => img.addEventListener("error", () => img.remove(), { once: true }));
    A.enhanceSoftSelects?.(host);
  };
})();
