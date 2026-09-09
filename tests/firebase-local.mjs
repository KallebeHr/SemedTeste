let serial = 0;
export class Timestamp {
  constructor(ms) {
    this.ms = ms;
  }
  static now() {
    return new Timestamp(Date.now());
  }
  static fromDate(d) {
    return new Timestamp(d.getTime());
  }
  toDate() {
    return new Date(this.ms);
  }
  toMillis() {
    return this.ms;
  }
}
const copy = (v) =>
  v instanceof Timestamp
    ? new Timestamp(v.ms)
    : Array.isArray(v)
      ? v.map(copy)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)]))
        : v;
const role = localStorage.getItem("qa-role") || "admin";
export const auth = {
  currentUser: localStorage.getItem("qa-login")
    ? { uid: "qa-user", email: "teste@example.com" }
    : null,
};
export const db = {};
export const app = {};
export const storage = {};
const records = new Map([
  [
    "usuarios/qa-user",
    {
      nome: "Usuário de teste",
      papel: role,
      escolasVinculadas: ["escola-a", "escola-b"],
    },
  ],
  ["escolas/escola-a", { nome: "Escola de teste A", ativo: true }],
  ["escolas/escola-b", { nome: "Escola de teste B", ativo: true }],
  [
    "escolas/escola-a/estoque/arroz",
    {
      nome: "Arroz teste",
      categoria: "nao_perecivel",
      unidade: "kg",
      quantidadeAtual: 10,
      quantidadeMinima: 2,
      precoUnitario: 5,
      validade: null,
      ativo: true,
    },
  ],
  [
    "escolas/escola-b/estoque/feijao",
    {
      nome: "Feijão teste",
      categoria: "nao_perecivel",
      unidade: "kg",
      quantidadeAtual: 20,
      quantidadeMinima: 4,
      precoUnitario: 8,
      validade: null,
      ativo: true,
    },
  ],
]);
const listeners = new Set();
const authListeners = new Set();
const mock = {
  records,
  listeners,
  failNext: "",
  commits: 0,
  uploads: 0,
  storageObjects: new Map(),
  storageReads: 0,
  canceledUploads: 0,
};
window.__qa = mock;
export function collection(base, ...parts) {
  return { path: [base.path, ...parts].filter(Boolean).join("/") };
}
export function doc(base, ...parts) {
  const path = [base.path, ...(parts.length ? parts : ["qa-" + ++serial])]
    .filter(Boolean)
    .join("/");
  return { path, id: path.split("/").at(-1) };
}
export const documentId = () => "__name__";
export const where = (field, op, value) => ({
  type: "where",
  field,
  op,
  value,
});
export const orderBy = (field, direction) => ({
  type: "order",
  field,
  direction,
});
export const limit = (count) => ({ type: "limit", count });
export const query = (base, ...clauses) => ({ ...base, clauses });
export const serverTimestamp = () => Timestamp.now();
const snapshot = (path) => ({
  id: path.split("/").at(-1),
  exists: () => records.has(path),
  data: () => copy(records.get(path)),
});
function selection(q) {
  if (q.id) return snapshot(q.path);
  let docs = [...records.keys()]
    .filter(
      (p) =>
        p.startsWith(q.path + "/") &&
        p.split("/").length === q.path.split("/").length + 1,
    )
    .map(snapshot);
  for (const c of q.clauses || []) {
    if (c.type === "where")
      docs = docs.filter((d) => {
        const v = c.field === "__name__" ? d.id : d.data()[c.field];
        return c.op === "=="
          ? v === c.value
          : c.op === "in"
            ? c.value.includes(v)
            : c.op === "array-contains"
              ? v.includes(c.value)
              : true;
      });
    if (c.type === "order")
      docs.sort((a, b) => {
        const x = a.data()[c.field],
          y = b.data()[c.field];
        return (
          String(x?.ms ?? x).localeCompare(String(y?.ms ?? y)) *
          (c.direction === "desc" ? -1 : 1)
        );
      });
    if (c.type === "limit") docs = docs.slice(0, c.count);
  }
  return { docs };
}
function notify() {
  listeners.forEach((l) =>
    queueMicrotask(() => {
      if (listeners.has(l)) l.callback(selection(l.q));
    }),
  );
}
export function onSnapshot(q, callback, error, errorOption) {
  if (typeof callback !== "function") {
    callback = error;
    error = errorOption;
  }
  const l = { q, callback, error };
  listeners.add(l);
  queueMicrotask(() => {
    if (!listeners.has(l)) return;
    let falha = mock.queryError;
    if (
      mock.missingCompositeIndexes &&
      q.clauses?.some((c) => c.type === "where") &&
      q.clauses?.some((c) => c.type === "order")
    ) {
      falha = {
        code: "failed-precondition",
        message: "The query requires an index.",
      };
    }
    if (falha) {
      listeners.delete(l);
      error?.(falha);
    } else callback(selection(q));
  });
  return () => listeners.delete(l);
}
export const getDoc = async (r) => snapshot(r.path);
export const getDocFromServer = getDoc;
export const getDocs = async (r) => {
  if (mock.readError) throw mock.readError;
  if (mock.stallRead)
    await new Promise((resolve) => {
      mock.resumeRead = resolve;
    });
  return selection(r);
};
function apply(ops) {
  ops.forEach(([type, r, v]) =>
    records.set(
      r.path,
      type === "update" ? { ...records.get(r.path), ...copy(v) } : copy(v),
    ),
  );
  mock.commits++;
  notify();
}
export function writeBatch() {
  const ops = [];
  return {
    set: (r, v) => ops.push(["set", r, v]),
    update: (r, v) => ops.push(["update", r, v]),
    commit: async () => apply(ops),
  };
}
export async function runTransaction(db, callback) {
  if (mock.stallTransaction)
    await new Promise((resolve) => {
      mock.resumeTransaction = resolve;
    });
  const ops = [];
  const result = await callback({
    get: getDoc,
    set: (r, v) => ops.push(["set", r, v]),
    update: (r, v) => ops.push(["update", r, v]),
  });
  if (mock.failNext === "transaction") {
    mock.failNext = "";
    throw new Error("Falha simulada antes da confirmação");
  }
  apply(ops);
  if (mock.failNext === "lost-response") {
    mock.failNext = "";
    throw new Error("Resposta perdida após confirmação simulada");
  }
  return result;
}
export async function addDoc(c, v) {
  const r = doc(c);
  apply([["set", r, v]]);
  return r;
}
export async function updateDoc(r, v) {
  apply([["update", r, v]]);
}
export const ref = (s, path) => ({ path });
export async function uploadString(_r, _v) {
  if (mock.failNext === "upload") {
    mock.failNext = "";
    throw Object.assign(new Error("Falha simulada de upload"), {
      code: "storage/unauthorized",
    });
  }
  mock.uploads++;
}
export function uploadBytesResumable(r, bytes) {
  let resolve,
    reject,
    done = false;
  const callbacks = new Set();
  const task = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const totalBytes = bytes.size ?? bytes.byteLength;
  task.on = (_, callback) => {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  };
  task.cancel = () => {
    if (done) return false;
    done = true;
    mock.canceledUploads++;
    reject(Object.assign(new Error("Cancelado"), { code: "storage/canceled" }));
    return true;
  };
  task.finish = () => {
    if (done) return;
    done = true;
    if (mock.failNext === "upload") {
      mock.failNext = "";
      reject(
        Object.assign(new Error("Falha simulada de upload"), {
          code: "storage/unauthorized",
        }),
      );
      return;
    }
    if (mock.storageObjects.has(r.path)) {
      reject(
        Object.assign(new Error("Objeto não pode ser sobrescrito"), {
          code: "storage/unauthorized",
        }),
      );
      return;
    }
    mock.storageObjects.set(r.path, bytes);
    mock.uploads++;
    callbacks.forEach((f) => f({ bytesTransferred: totalBytes, totalBytes }));
    if (mock.failNext === "upload-lost-response") {
      mock.failNext = "";
      reject(
        Object.assign(new Error("Resposta de envio perdida"), {
          code: "storage/retry-limit-exceeded",
        }),
      );
      return;
    }
    resolve({ ref: r, bytesTransferred: totalBytes, totalBytes });
  };
  mock.lastUpload = task;
  if (!mock.stallUpload) queueMicrotask(task.finish);
  return task;
}
export async function getDownloadURL(r) {
  mock.storageReads++;
  if (mock.storageError) throw mock.storageError;
  if (mock.stallStorageLookup)
    return new Promise((resolve) => {
      mock.resolveStorageLookup = resolve;
    });
  if (!mock.storageObjects.has(r.path))
    throw Object.assign(new Error("Objeto ausente"), {
      code: "storage/object-not-found",
    });
  return "https://example.invalid/" + r.path;
}
export function onAuthStateChanged(a, callback) {
  authListeners.add(callback);
  setTimeout(() => callback(a.currentUser), 30);
  return () => authListeners.delete(callback);
}
export async function signInWithEmailAndPassword(a, email, password) {
  if (password === "errada")
    throw Object.assign(new Error("Senha errada"), {
      code: "auth/invalid-credential",
    });
  a.currentUser = { uid: "qa-user", email };
  localStorage.setItem("qa-login", "1");
  authListeners.forEach((f) => f(a.currentUser));
  return { user: a.currentUser };
}
export async function signOut(a) {
  a.currentUser = null;
  localStorage.removeItem("qa-login");
  authListeners.forEach((f) => f(null));
}
