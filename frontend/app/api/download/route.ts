import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ error: "key required" }), { status: 400 });
    }

    // Optional: require a special header for downloads if configured
    const apiKey = process.env.DOWNLOAD_API_KEY;
    if (apiKey) {
      const provided = req.headers.get("x-download-key");
      if (provided !== apiKey) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      }
    }

    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || "us-east-1";
    if (!bucket) {
      return new Response(JSON.stringify({ error: "S3 bucket not configured" }), { status: 500 });
    }

    const client = new S3Client({ region });
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const res = await client.send(cmd as any);

    // The SDK returns a Body stream (Node Readable, or Blob in some runtimes)
    // Return it directly as a streaming Response with the original content-type
    const body: any = (res as any).Body;
    const contentType = (res as any).ContentType || "application/octet-stream";

    // If the body is a Node.js Readable, convert to WebReadable
    let stream: ReadableStream | BodyInit = body;
    if (body && typeof (body as any).pipe === "function") {
      // Node Readable -> Web stream
      // @ts-ignore
      stream = (body as any).pipe ? (body as any) : body;
    }

    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "download failed" }), { status: 500 });
  }
}
