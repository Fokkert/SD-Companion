(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const ops = new Map();
  const start = (id, type, meta = {}) => {
    if (!id) id = crypto.randomUUID();
    const old = ops.get(id);
    if (old) return old;
    const op = { id, type, meta, controller: new AbortController(), cancelled: false, startedAt: Date.now() };
    ops.set(id, op);
    return op;
  };
  const signal = id => ops.get(id)?.controller.signal || null;
  const cancel = id => {
    const op = ops.get(id);
    if (!op) return false;
    op.cancelled = true;
    try {
      op.controller.abort('User cancelled operation');
    } catch {}
    return true;
  };
  const throwIfCancelled = id => {
    const op = ops.get(id);
    if (op?.cancelled || op?.controller.signal.aborted) {
      const e = new Error('Operation cancelled.');
      e.code = 'OPERATION_CANCELLED';
      throw e;
    }
  };
  const finish = id => {
    if (id) ops.delete(id);
  };
  const isActive = id => ops.has(id);
  root.Operations = Object.freeze({ start, signal, cancel, throwIfCancelled, finish, isActive });
})();
