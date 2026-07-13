import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, contentType } = body || {};
    if (!name || !contentType) {
      return new Response(JSON.stringify({ error: "name and contentType required" }), { status: 400 });
    }

    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || "us-east-1";
    if (!bucket) {
      return new Response(JSON.stringify({ error: "S3 bucket not configured" }), { status: 500 });
    }

      const timestamp = Date.now();
      const safeName = `${timestamp}-${name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const key = `uploads/${safeName}`;

      const client = new S3Client({ region });
      const putCommand = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
      const putUrl = await getSignedUrl(client, putCommand, { expiresIn: 300 });

      // We intentionally DO NOT return a signed GET here. Instead we return the
      // presigned PUT and the object key. Downloads should be performed via
      // the server-side proxy (`/api/download`) which enforces access control
      // and streams objects back to clients for tighter privacy control.
      return new Response(JSON.stringify({ putUrl, key }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "upload failed" }), { status: 500 });
  }
}
