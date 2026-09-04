(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const quote = v => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const vals = c => root.ConditionRegistry?.conditionValues?.(c) || (c.values?.length ? c.values : [c.value]).filter(v => v !== "" && v !== null && v !== undefined);
  const safeField = f => /^(?:[A-Za-z][A-Za-z0-9_.]*|cf\[\d+\])$/.test(String(f || "")) ? String(f) : quote(String(f || ""));
  const scalar = (v, meta) => meta?.kind === "number" && Number.isFinite(Number(v)) ? String(Number(v)) : meta?.kind === "boolean" && /^(true|false)$/i.test(String(v)) ? String(v).toLowerCase() : quote(v);
  const clause = c => {
    const meta = root.ConditionRegistry?.get(c.field) || ((c.jqlField || c.fieldKind) ? { queryable: true, jqlField: c.jqlField, kind: c.fieldKind } : null);
    if (!meta?.queryable) return "";
    const f = safeField(meta.jqlField || c.jqlField || c.field);
    if (!f) return "";
    const op = c.operator || "equals", v = vals(c), q = v.map(x => scalar(x, meta));
    let out = "";
    if (op === "exists") out = `${f} is not EMPTY`;
    else if (op === "not-exists") out = `${f} is EMPTY`;
    else if (!v.length) return "";
    else if (["equals", "is-any-of"].includes(op)) out = v.length === 1 ? `${f} = ${q[0]}` : `${f} in (${q.join(", ")})`;
    else if (["not-equals", "is-none-of"].includes(op)) out = v.length === 1 ? `${f} != ${q[0]}` : `${f} not in (${q.join(", ")})`;
    else if (op === "contains") out = `${f} ~ ${quote(v[0])}`;
    else if (op === "not-contains") out = `${f} !~ ${quote(v[0])}`;
    else if (op === "contains-any") out = `(${v.map(x => `${f} = ${scalar(x, meta)}`).join(" OR ")})`;
    else if (op === "contains-all") out = `(${v.map(x => `${f} = ${scalar(x, meta)}`).join(" AND ")})`;
    else if (op === "gt" || op === "after") out = `${f} > ${q[0]}`;
    else if (op === "gte" || op === "on-or-after") out = `${f} >= ${q[0]}`;
    else if (op === "lt" || op === "before") out = `${f} < ${q[0]}`;
    else if (op === "lte" || op === "on-or-before") out = `${f} <= ${q[0]}`;
    if (c.negate && out) out = `NOT (${out})`;
    return out;
  };
  const conditionJql = logic => {
    const rootOp = logic?.operator === "OR" ? "OR" : "AND", groups = [];
    for (const g of logic?.groups || []) {
      const all = g.conditions || [],
        parts = all.map(clause),
        usable = parts.filter(Boolean),
        groupOp = g.operator === "OR" ? "OR" : "AND";
      if (!usable.length) continue;
      if (groupOp === "OR" && usable.length !== all.length) continue;
      let text = `(${usable.join(` ${groupOp} `)})`;
      if (g.negate) text = `NOT ${text}`;
      groups.push(text);
    }
    return groups.length ? groups.join(` ${rootOp} `) : "";
  };
  const stripOrder = jql => String(jql || "").replace(/\s+ORDER\s+BY\s+[\s\S]*$/i, "").trim();
  const baseJql = rule => {
    const parts = [];
    const ids = (rule.source?.filterIds || []).filter(Boolean);
    if (ids.length) parts.push(`(${ids.map(id => `filter = ${quote(id)}`).join(" OR ")})`);
    const raw = stripOrder(rule.source?.jql);
    if (raw) parts.push(`(${raw})`);
    const derived = conditionJql(rule.logic);
    if (derived) parts.push(`(${derived})`);
    return parts.join(" AND ");
  };
  const cursorJql = (base, cursor, overlapSeconds = 600) => {
    if (!base) return "";
    let since = "";
    if (cursor?.lastSuccessfulAt) {
      const seconds = Math.max(root.Constants.LIMITS.CURSOR_OVERLAP_MIN_SECONDS, Number(overlapSeconds) || 600),
        d = new Date(new Date(cursor.lastSuccessfulAt).getTime() - seconds * 1000);
      since = d.toISOString().slice(0, 16).replace("T", " ");
    }
    return `${base}${since ? ` AND updated >= ${quote(since)}` : ""} ORDER BY updated ASC`;
  };
  const preview = (rule, cursor = null) => ({ baseJql: baseJql(rule), effectiveJql: cursorJql(baseJql(rule), cursor, rule.polling?.cursorOverlapSeconds || 600), hasConstraint: Boolean(baseJql(rule)) });
  root.RuleQuery = Object.freeze({ quote, clause, conditionJql, baseJql, cursorJql, preview, stripOrder });
})();
