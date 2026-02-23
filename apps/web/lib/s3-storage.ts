import crypto from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare global {
  // eslint-disable-next-line no-var
  var __RONDAFLOW_S3_CLIENT__: S3Client | undefined;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }
  return value;
}

function getS3Client() {
  if (!globalThis.__RONDAFLOW_S3_CLIENT__) {
    globalThis.__RONDAFLOW_S3_CLIENT__ = new S3Client({
      endpoint: requireEnv("SUPABASE_S3_ENDPOINT"),
      region: process.env.SUPABASE_S3_REGION || "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv("SUPABASE_S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("SUPABASE_S3_SECRET_ACCESS_KEY")
      }
    });
  }
  return globalThis.__RONDAFLOW_S3_CLIENT__;
}

export function getFotosBucket() {
  return requireEnv("SUPABASE_S3_BUCKET");
}

function extensionByMime(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export function parseDataUrlImage(dataUrl: string) {
  // Compatível com targets antigos (sem flag dotAll /s)
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Formato de imagem invalido (data URL).");
  }
  const mimeType = match[1].toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Arquivo enviado nao e imagem.");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) {
    throw new Error("Imagem vazia.");
  }
  return {
    mimeType,
    bytes,
    sizeBytes: bytes.byteLength,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    extension: extensionByMime(mimeType)
  };
}

export function buildFotoObjectPath(params: {
  rondaId: string;
  itemRespostaId?: string;
  originalName: string;
  extension: string;
}) {
  const safeBase = params.originalName
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "foto";

  const rand = crypto.randomUUID();
  const itemSegment = params.itemRespostaId ? `itens/${params.itemRespostaId}` : "geral";
  return `rondas/${params.rondaId}/${itemSegment}/${safeBase}-${rand}.${params.extension}`;
}

export async function uploadFotoObject(params: {
  objectPath: string;
  bytes: Buffer;
  mimeType: string;
}) {
  const client = getS3Client();
  const bucket = getFotosBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.objectPath,
      Body: params.bytes,
      ContentType: params.mimeType
    })
  );
  return { bucketId: bucket, objectPath: params.objectPath };
}

export async function deleteFotoObject(objectPath: string) {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getFotosBucket(),
      Key: objectPath
    })
  );
}

export async function createFotoSignedUrl(objectPath: string, expiresInSeconds = 3600) {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getFotosBucket(),
      Key: objectPath
    }),
    { expiresIn: expiresInSeconds }
  );
}
