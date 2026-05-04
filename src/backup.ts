import { PutObjectCommandInput, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Storage } from "@google-cloud/storage";
import { spawn, spawnSync } from "child_process";
import { filesize } from "filesize";
import { createReadStream, createWriteStream, statSync } from "fs";
import { rm } from "fs/promises";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";

import { env } from "./env.js";
import { createMD5 } from "./util.js";

const uploadToS3 = async ({ name, path }: { name: string; path: string }) => {
  console.log("Uploading backup to S3...");
  const bucket = env.AWS_S3_BUCKET;
  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  };
  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`);
    clientOptions.endpoint = env.AWS_S3_ENDPOINT;
  }
  if (env.BUCKET_SUBFOLDER) {
    name = env.BUCKET_SUBFOLDER + "/" + name;
  }
  let params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: name,
    Body: createReadStream(path),
  };
  if (env.SUPPORT_OBJECT_LOCK) {
    console.log("MD5 hashing file...");
    const md5Hash = await createMD5(path);
    console.log("Done hashing file");
    params.ContentMD5 = Buffer.from(md5Hash, "hex").toString("base64");
  }
  const client = new S3Client(clientOptions);
  await new Upload({
    client,
    params: params,
  }).done();
  console.log("Backup uploaded to S3...");
};

const uploadToGCS = async ({ name, path }: { name: string; path: string }) => {
  console.log("Uploading backup to GCS...");
  const bucketName = env.GCP_BUCKET;
  const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nodeEnv = process.env.NODE_ENV || "local";
  let destName = `${nodeEnv}/${dateFolder}/${name}`;
  if (env.BUCKET_SUBFOLDER) {
    destName = `${env.BUCKET_SUBFOLDER}/${nodeEnv}/${dateFolder}/${name}`;
  }
  let storageConfig: any = {
    projectId: env.GCP_PROJECT_ID || undefined,
  };
  if (env.GCP_SERVICE_ACCOUNT_KEY) {
    const decoded = Buffer.from(env.GCP_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8");
    storageConfig.credentials = JSON.parse(decoded);
  }

  const storage = new Storage(storageConfig);
  const bucket = storage.bucket(bucketName);
  await bucket.upload(path, {
    destination: destName,
    gzip: false,
  });
  console.log("Backup uploaded to GCS...");
};

function parseBackupOptions(options: string) {
  return options.trim() === "" ? [] : options.trim().split(/\s+/);
}

function waitForProcessExit(child: ReturnType<typeof spawn>, stderr: string[]) {
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject({
        error: `pg_dump failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`,
        stderr: stderr.join("").trimEnd(),
      });
    });
  });
}

function runCommand(command: string, args: string[]) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parsePostgresMajor(versionText: string) {
  const match = versionText.match(/(\d+)(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function getServerMajorVersion() {
  const result = runCommand("psql", [
    `--dbname=${env.BACKUP_DATABASE_URL}`,
    "--tuples-only",
    "--no-align",
    "--command=SHOW server_version_num",
  ]);

  if (result.status !== 0) {
    throw {
      error: "Failed to detect PostgreSQL server version",
      stderr: result.stderr.trimEnd(),
    };
  }

  const versionNumber = Number.parseInt(result.stdout.trim(), 10);
  if (!Number.isFinite(versionNumber)) {
    throw {
      error: "PostgreSQL server returned an invalid server_version_num",
      stdout: result.stdout.trim(),
    };
  }

  return Math.floor(versionNumber / 10000);
}

function findPgDumpForServer(serverMajor: number) {
  const candidates = [
    `pg_dump-${serverMajor}`,
    `/usr/libexec/postgresql${serverMajor}/pg_dump`,
    `/usr/lib/postgresql/${serverMajor}/bin/pg_dump`,
    "pg_dump",
  ];

  for (const candidate of candidates) {
    const result = runCommand(candidate, ["--version"]);
    if (result.status !== 0) {
      continue;
    }

    const clientMajor = parsePostgresMajor(result.stdout);
    if (clientMajor !== null && clientMajor >= serverMajor) {
      console.log(`Using ${candidate}: ${result.stdout.trim()}`);
      return candidate;
    }
  }

  throw {
    error: `No compatible pg_dump found for PostgreSQL server major ${serverMajor}`,
    detail:
      "Install a PostgreSQL client with the same or newer major version in the backup image.",
  };
}

const dumpToFile = async (filePath: string) => {
  console.log("Dumping DB to file...");

  const serverMajor = getServerMajorVersion();
  const pgDumpCommand = findPgDumpForServer(serverMajor);
  const stderr: string[] = [];
  const pgDump = spawn(
    pgDumpCommand,
    [
      `--dbname=${env.BACKUP_DATABASE_URL}`,
      "--format=tar",
      ...parseBackupOptions(env.BACKUP_OPTIONS),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  pgDump.stderr?.on("data", (chunk: Buffer) => {
    stderr.push(chunk.toString("utf8"));
  });

  if (!pgDump.stdout) {
    throw { error: "pg_dump stdout stream was unavailable" };
  }

  await Promise.all([
    pipeline(pgDump.stdout, createGzip(), createWriteStream(filePath)),
    waitForProcessExit(pgDump, stderr),
  ]);

  if (stderr.length > 0) {
    console.log({ stderr: stderr.join("").trimEnd() });
    console.log(
      `Potential warnings detected; Please ensure the backup file "${path.basename(
        filePath
      )}" contains all needed data`
    );
  }

  const size = statSync(filePath).size;
  if (size === 0) {
    throw { error: "Backup archive file is empty after successful pg_dump" };
  }

  console.log("Backup archive file is valid");
  console.log("Backup filesize:", filesize(size));

  console.log("DB dumped to file...");
};

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await rm(path, { force: true });
};

export const backup = async () => {
  console.log("Initiating DB backup...");
  const date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `${env.BACKUP_FILE_PREFIX}-${timestamp}.tar.gz`;
  const filepath = path.join(os.tmpdir(), filename);
  await dumpToFile(filepath);
  if (env.BACKUP_PROVIDER === "gcp") {
    await uploadToGCS({ name: filename, path: filepath });
  } else {
    await uploadToS3({ name: filename, path: filepath });
  }
  await deleteFile(filepath);
  console.log("DB backup complete...");
};
