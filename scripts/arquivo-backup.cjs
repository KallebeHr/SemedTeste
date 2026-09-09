const crypto = require("node:crypto"),
  zlib = require("node:zlib");
const { Timestamp, GeoPoint } = require("firebase-admin/firestore");
const MAX = 256 * 1024 * 1024;
function codificar(v) {
  if (v === null) return { t: "null" };
  if (v instanceof Timestamp)
    return { t: "timestamp", s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint) return { t: "geo", a: v.latitude, o: v.longitude };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array)
    return { t: "bytes", v: Buffer.from(v).toString("base64") };
  if (
    v &&
    typeof v.path === "string" &&
    typeof v.listCollections === "function"
  )
    return { t: "ref", v: v.path };
  if (Array.isArray(v)) return { t: "array", v: v.map(codificar) };
  if (typeof v === "object")
    return {
      t: "map",
      v: Object.keys(v)
        .sort()
        .map((k) => [k, codificar(v[k])]),
    };
  if (typeof v === "number" && !Number.isFinite(v))
    return { t: "number", v: String(v) };
  if (["number", "string", "boolean"].includes(typeof v))
    return { t: typeof v, v };
  throw new Error("Tipo não suportado no backup: " + typeof v);
}
function decodificar(x, db) {
  if (!x || typeof x.t !== "string")
    throw new Error("Valor inválido no arquivo.");
  switch (x.t) {
    case "null":
      return null;
    case "timestamp":
      return new Timestamp(x.s, x.n);
    case "geo":
      return new GeoPoint(x.a, x.o);
    case "bytes":
      return Buffer.from(x.v, "base64");
    case "ref":
      return db.doc(x.v);
    case "array":
      return x.v.map((v) => decodificar(v, db));
    case "map":
      return Object.fromEntries(x.v.map(([k, v]) => [k, decodificar(v, db)]));
    case "number":
      return Number(x.v);
    case "string":
    case "boolean":
      return x.v;
    default:
      throw new Error("Tipo desconhecido no arquivo.");
  }
}
function resumo(x) {
  return crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
}
function criptografar(conteudo, senha) {
  if (typeof senha !== "string" || senha.length < 16)
    throw new Error("Use uma senha de backup com pelo menos 16 caracteres.");
  const json = Buffer.from(JSON.stringify(conteudo));
  if (json.length > MAX)
    throw new Error(
      "Arquivo excede 256 MiB. Use a exportação gerenciada para este volume.",
    );
  const salt = crypto.randomBytes(16),
    iv = crypto.randomBytes(12),
    key = crypto.scryptSync(senha, salt, 32, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from("SEDUC-BACKUP-1"));
  const body = Buffer.concat([c.update(zlib.gzipSync(json)), c.final()]);
  return Buffer.from(
    JSON.stringify({
      formato: "seduc-backup",
      versao: 1,
      kdf: "scrypt-32768-8-1",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: c.getAuthTag().toString("base64"),
      dados: body.toString("base64"),
    }),
  );
}
function abrir(bytes, senha) {
  if (bytes.length > MAX) throw new Error("Arquivo excessivamente grande.");
  const x = JSON.parse(bytes.toString());
  if (
    x.formato !== "seduc-backup" ||
    x.versao !== 1 ||
    x.kdf !== "scrypt-32768-8-1"
  )
    throw new Error("Formato de backup não reconhecido.");
  try {
    const key = crypto.scryptSync(senha, Buffer.from(x.salt, "base64"), 32, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const d = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(x.iv, "base64"),
    );
    d.setAAD(Buffer.from("SEDUC-BACKUP-1"));
    d.setAuthTag(Buffer.from(x.tag, "base64"));
    return JSON.parse(
      zlib.gunzipSync(
        Buffer.concat([d.update(Buffer.from(x.dados, "base64")), d.final()]),
        { maxOutputLength: MAX },
      ),
    );
  } catch {
    throw new Error("Senha incorreta, arquivo alterado ou backup inválido.");
  }
}
module.exports = { codificar, decodificar, resumo, criptografar, abrir };
