import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import logger from "../logger/winston.logger.js";
import { ApiError } from "./ApiError.js";
import { getLocalPath, removeLocalFile } from "./helpers.js";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const upload = async (file, key) => {
  try {
    const localPath = getLocalPath(file?.filename);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: file.mimetype,
      ACL: "public-read",
      Body: await readFile(localPath),
    });

    await s3Client.send(command);

    // ${process.env.CLOUDFRONT_DOMAIN}/${key}
    const publicLink = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;

    removeLocalFile(localPath);

    return publicLink;
  } catch (error) {
    logger.error(error);
    throw new ApiError(500, "Error Uploading File");
  }
};
