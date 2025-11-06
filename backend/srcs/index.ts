import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import awsLambdaFastify from "@fastify/aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const app = Fastify({ logger: true });

async function setup() {
  await app.register(cors, { origin: "*" });

  const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-north-1" });

  const fortunes = [
    "you will write bug-free code today.",
    "your next deployment will be silky smooth.",
    "a merge conflict approaches, but you’ll win.",
    "something unexpected will happen today!",
    "you will find an excellent intern! ;)",
    "you will have a great day!",
    "a new opportunity is on the horizon.",
    "today is a perfect day to learn something new."
  ];

  app.get("/fortune", async (request) => {
    const name = (request.query as any).name || "Stranger";
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return { message: `${name}, ${fortune}` };
  });

  app.get("/photo", async () => {
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
}

// initialize routes/plugins
setup();

// ✅ export handler for AWS Lambda
export const handler = awsLambdaFastify(app);
