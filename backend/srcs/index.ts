import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

(async () => {
  const server = Fastify({ logger: true });
  await server.register(cors, { origin: "*" });

  const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-north-1" });

  const fortunes = [
    "You will write bug-free code today",
    "Your next deployment will be silky smooth",
    "A merge conflict approaches, but you’ll win",
    "Something unexpected will happen today",
    "You will find an excellent intern! ;)",
    "You will have a great day!",
    "A new opportunity is on the horizon.",
    "Today is a perfect day to learn something new."
  ];

  server.get("/fortune", async (request) => {
    const name = (request.query as any).name || "Stranger";
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return { message: `${name}, ${fortune}.` };
  });

  server.get("/photo", async () => {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.PHOTO_BUCKET!,
        Key: process.env.PHOTO_KEY!,
      }),
      { expiresIn: 3600 }
    );
    return { url };
  });

  const port = Number(process.env.PORT) || 4241;
  await server.listen({ port, host: "0.0.0.0" });
})();
