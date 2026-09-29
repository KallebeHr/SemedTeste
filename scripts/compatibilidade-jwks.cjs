// Workaround for auth0/node-jwks-rsa#507 in serverless CommonJS runtimes.
// Keep jose v6 and its security updates; load ESM using the supported async API.
const fs = require("node:fs");
const path = require("node:path");
const file = path.join(path.dirname(require.resolve("jwks-rsa")), "utils.js");
const source = fs.readFileSync(file, "utf8");
const marker = "  const jose = await import('jose');";
if (!source.includes(marker)) {
  const oldImport = "const jose = require('jose');";
  const entry = "async function retrieveSigningKeys(jwks) {";
  if (!source.includes(oldImport) || !source.includes(entry)) {
    throw new Error("A dependência jwks-rsa mudou; revise a compatibilidade ESM antes de publicar.");
  }
  fs.writeFileSync(file, source.replace(oldImport, "").replace(entry, entry + "\n" + marker));
}
const passportFile = path.join(path.dirname(file), "integrations", "passport.js");
const passport = fs.readFileSync(passportFile, "utf8");
if (!passport.includes("const jose = await import('jose');")) {
  const entry = "return function secretProvider(req, rawJwtToken, cb) {";
  if (!passport.includes("const jose = require('jose');") || !passport.includes(entry) || !passport.includes("    try {")) {
    throw new Error("A integração passport de jwks-rsa mudou; revise a compatibilidade ESM.");
  }
  fs.writeFileSync(passportFile, passport.replace("const jose = require('jose');", "")
    .replace(entry, "return async function secretProvider(req, rawJwtToken, cb) {")
    .replace("    try {", "    try {\n      const jose = await import('jose');"));
}
