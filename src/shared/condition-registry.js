(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const choiceOps = ["is-any-of", "is-none-of", "equals", "not-equals", "exists", "not-exists"];
  const textOps = ["contains", "not-contains", "equals", "not-equals", "exists", "not-exists"];
  const numberOps = ["equals", "not-equals", "gt", "gte", "lt", "lte", "exists", "not-exists"];
  const dateOps = ["equals", "not-equals", "before", "on-or-before", "after", "on-or-after", "exists", "not-exists"];
  const registry = {
    project: { label: "Project", kind: "choices", source: "projects", operators: choiceOps, queryable: true, jqlField: "project" },
    issueType: { label: "Issue type", kind: "choices", source: "issueTypes", operators: choiceOps, queryable: true, jqlField: "issuetype" },
    status: { label: "Status", kind: "choices", source: "statuses", operators: choiceOps, queryable: true, jqlField: "status" },
    assignee: { label: "Assignee", kind: "choices", source: "users", operators: choiceOps, queryable: true, jqlField: "assignee" },
    reporter: { label: "Reporter", kind: "choices", source: "users", operators: choiceOps, queryable: true, jqlField: "reporter" },
    priority: { label: "Priority", kind: "choices", source: "priorities", operators: choiceOps, queryable: true, jqlField: "priority" },
    resolution: { label: "Resolution", kind: "choices", source: "resolutions", operators: choiceOps, queryable: true, jqlField: "resolution" },
    label: { label: "Label", kind: "text", operators: ["equals", "not-equals", "contains-any", "contains-all", "exists", "not-exists"], queryable: true, jqlField: "labels", array: true },
    summary: { label: "Summary", kind: "text", operators: textOps, queryable: true, jqlField: "summary" },
    description: { label: "Description", kind: "text", operators: ["contains", "not-contains", "exists", "not-exists"], queryable: true, jqlField: "description" },
    component: { label: "Component", kind: "text", operators: textOps, queryable: true, jqlField: "component" },
    createdAgeMinutes: { label: "Created age (minutes)", kind: "number", operators: ["gt", "gte", "lt", "lte"], queryable: false, min: 0, max: 5256000 },
    updatedAgeMinutes: { label: "Updated age (minutes)", kind: "number", operators: ["gt", "gte", "lt", "lte"], queryable: false, min: 0, max: 5256000 }
  };
  const BUILTIN_IDS = new Set(["project", "issuetype", "status", "assignee", "reporter", "priority", "resolution", "labels", "summary", "description", "components", "component", "created", "updated"]);
  const MULTI_OPERATORS = new Set(["is-any-of", "is-none-of", "contains-any", "contains-all"]);
  const EMPTY_OPERATORS = new Set(["exists", "not-exists"]);
  const clean = v => (v === null || v === undefined ? "" : String(v)).trim();
  const customJql = f => {
    const id = String(f?.id || f?.key || "");
    const m = id.match(/^customfield_(\d+)$/i);
    if (m) return `cf[${m[1]}]`;
    return String(f?.clauseNames?.[0] || f?.key || f?.name || id);
  };
  const schemaKind = f => {
    const schema = f?.schema || {},
      type = String(schema.type || "").toLowerCase(),
      items = String(schema.items || "").toLowerCase(),
      custom = String(schema.custom || "").toLowerCase(),
      effective = type === "array" ? items : type;
    if (effective === "number" || effective === "integer" || custom.includes("float") || custom.includes("number")) return "number";
    if (effective === "datetime" || custom.includes("datetime")) return "datetime";
    if (effective === "date" || custom.includes("datepicker")) return "date";
    if (effective === "boolean") return "boolean";
    if (effective === "user" || custom.includes("userpicker") || custom.includes("grouppicker")) return "choices";
    if (["option", "priority", "status", "issuetype", "project", "resolution", "version", "group"].includes(effective) || /(?:^|:)(?:select|multiselect|cascadingselect|radiobuttons|checkboxes)$/.test(custom)) return "choices";
    return "text";
  };
  const dynamicDefinition = f => {
    if (!f) return null;
    const kind = schemaKind(f),
      schema = f.schema || {},
      type = String(schema.type || "").toLowerCase(),
      items = String(schema.items || "").toLowerCase(),
      custom = String(schema.custom || "").toLowerCase(),
      isUser = type === "user" || items === "user" || custom.includes("userpicker") || custom.includes("grouppicker"),
      array = type === "array";
    let operators;
    if (array) {
      operators = kind === "choices" ? ["is-any-of", "is-none-of", "contains-all", "exists", "not-exists"] : ["contains-any", "contains-all", "exists", "not-exists"];
    }
    else operators = kind === "number" ? numberOps : (kind === "date" || kind === "datetime") ? dateOps : kind === "boolean" ? ["equals", "not-equals", "exists", "not-exists"] : kind === "choices" ? choiceOps : textOps;
    return {
      id: String(f.id || f.key),
      label: f.name || f.id,
      kind,
      source: isUser ? "users" : "",
      operators,
      queryable: f.searchable !== false,
      jqlField: customJql(f),
      schema,
      fieldId: String(f.id || f.key),
      array,
      isUser,
      dynamic: true
    };
  };
  const get = (id, site = null) => {
    if (registry[id]) return registry[id];
    const f = (site?.fields || []).find(x => String(x.id || x.key) === String(id));
    return dynamicDefinition(f);
  };
  const fields = site => {
    const out = Object.entries(registry).map(([id, x]) => ({ id, ...x }));
    const seen = new Set(out.map(x => x.id));
    for (const f of site?.fields || []) {
      const id = String(f.id || f.key || "");
      if (!id || BUILTIN_IDS.has(id.toLowerCase()) || seen.has(id)) continue;
      const d = dynamicDefinition(f);
      if (d) {
        seen.add(id);
        out.push(d);
      }
    }
    return out;
  };
  const valueMode = (field, operator) => EMPTY_OPERATORS.has(operator) ? "none" : MULTI_OPERATORS.has(operator) ? "multi" : "single";
  const conditionValues = c => {
    const mode = valueMode(c?.field, c?.operator);
    if (mode === "none") return [];
    if (mode === "multi") return (c?.values || []).map(clean).filter(Boolean);
    const v = clean(c?.value !== undefined && c?.value !== null && String(c.value) !== "" ? c.value : (c?.values || [])[0]);
    return v ? [v] : [];
  };
  const storedDefinition = c => {
    if (!c?.fieldKind) return null;
    const kind = String(c.fieldKind),
      schema = c.fieldSchema && typeof c.fieldSchema === "object" ? c.fieldSchema : {},
      array = String(schema.type || "").toLowerCase() === "array";
    let operators;
    if (array) operators = kind === "choices" ? ["is-any-of", "is-none-of", "contains-all", "exists", "not-exists"] : ["contains-any", "contains-all", "exists", "not-exists"];
    else operators = kind === "number" ? numberOps : (kind === "date" || kind === "datetime") ? dateOps : kind === "boolean" ? ["equals", "not-equals", "exists", "not-exists"] : kind === "choices" ? choiceOps : textOps;
    return { id: String(c.field || ""), kind, operators, queryable: true, jqlField: c.jqlField || c.field, schema, dynamic: true, array };
  };
  const normalizeCondition = (c, site = null) => {
    if (!c || typeof c !== "object") return c;
    const def = get(c.field, site) || storedDefinition(c) || get("project");
    if (!def.operators.includes(c.operator)) c.operator = def.operators[0];
    if (def.dynamic) {
      c.fieldKind = def.kind;
      c.jqlField = def.jqlField;
      c.fieldSchema = def.schema;
    }
    const mode = valueMode(c.field, c.operator),
      existing = (c.values || []).map(clean).filter(Boolean),
      single = clean(c.value) || existing[0] || "";
    if (mode === "none") {
      c.value = "";
      c.values = [];
    }
    else if (mode === "multi") {
      c.values = [...new Set(existing.length ? existing : (single ? [single] : []))];
      c.value = "";
    }
    else {
      c.value = single;
      c.values = [];
    }
    return c;
  };
  root.ConditionRegistry = Object.freeze({ registry, get, fields, valueMode, conditionValues, normalizeCondition, dynamicDefinition, schemaKind, storedDefinition, MULTI_OPERATORS, EMPTY_OPERATORS });
})();
