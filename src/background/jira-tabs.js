(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    { normalizeBaseUrl } = root.Utils;
  const tabMatchesSite = (tab, site) => {
    const url = tab?.url || tab?.pendingUrl || "";
    if (!url || !site?.baseUrl) return false;
    const base = normalizeBaseUrl(site.baseUrl);
    return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`) || url.startsWith(`${base}#`);
  };
  const matchingTabs = async site => (await chrome.tabs.query({ url: ["https://*/*", "http://*/*"] }))
    .filter(t => tabMatchesSite(t, site))
    .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || Number(b.status === "complete") - Number(a.status === "complete"));
  const candidateTabs = async site => (await matchingTabs(site)).filter(t => !t.discarded);
  const browserStatus = async site => {
    const tabs = await matchingTabs(site);
    return {
      tabOpen: tabs.length > 0,
      tabCount: tabs.length,
      tabUrls: tabs.map(t => t.url),
      activeTab: Boolean(tabs.find(t => t.active)),
      completeTabs: tabs.filter(t => t.status === "complete").length,
      discardedTabs: tabs.filter(t => t.discarded).length
    };
  };
  root.JiraTabs = Object.freeze({ matchingTabs, candidateTabs, browserStatus });
})();
