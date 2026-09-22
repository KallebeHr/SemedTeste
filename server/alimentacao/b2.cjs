const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  GetBucketAclCommand,
} = require("@aws-sdk/client-s3");
function aclPrivada(acl) {
  return (
    !!acl?.Owner?.ID &&
    Array.isArray(acl.Grants) &&
    acl.Grants.length > 0 &&
    acl.Grants.every(
      ({ Grantee, Permission }) =>
        Grantee?.Type === "CanonicalUser" &&
        Grantee.ID === acl.Owner.ID &&
        !Grantee.URI &&
        Permission === "FULL_CONTROL",
    )
  );
}
function criarB2(env, transporte) {
  const {
    B2_ENDPOINT: endpoint,
    B2_REGION: region,
    B2_BUCKET: bucket,
    B2_KEY_ID: accessKeyId,
    B2_APPLICATION_KEY: secretAccessKey,
  } = env;
  if (
    !/^https:\/\/s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(endpoint || "") ||
    !region ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new Error("B2 não configurado.");
  if (new URL(endpoint).hostname !== `s3.${region}.backblazeb2.com`)
    throw new Error("Região B2 divergente.");
  const s3 =
    transporte ||
    new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
    });
  async function conferirPrivacidade() {
    const acl = await s3.send(new GetBucketAclCommand({ Bucket: bucket }), {
      abortSignal: AbortSignal.timeout(8000),
    });
    if (!aclPrivada(acl)) throw new Error("O bucket B2 deve ser privado.");
  }
  return {
    async put(key, buffer, mime) {
      await conferirPrivacidade();
      const r = await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mime,
          ContentLength: buffer.length,
          ServerSideEncryption: "AES256",
        }),
        { abortSignal: AbortSignal.timeout(35000) },
      );
      if (!r.VersionId)
        throw new Error("B2 não confirmou a versão do arquivo.");
      return r.VersionId;
    },
    async get(key, version) {
      await conferirPrivacidade();
      const r = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key, VersionId: version }),
        { abortSignal: AbortSignal.timeout(25000) },
      );
      if (r.ContentLength > 2 * 1024 * 1024) {
        r.Body.destroy?.();
        throw new Error("Arquivo excede o limite.");
      }
      return Buffer.from(await r.Body.transformToByteArray());
    },
  };
}
module.exports = { criarB2, aclPrivada };
