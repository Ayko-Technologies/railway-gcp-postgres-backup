import { bool, envsafe, str } from "envsafe";

export const env = envsafe({
  AWS_ACCESS_KEY_ID: str({
    desc: "AWS access key ID",
    default: "",
    allowEmpty: true,
  }),
  AWS_SECRET_ACCESS_KEY: str({
    desc: "AWS secret access key",
    default: "",
    allowEmpty: true,
  }),
  AWS_S3_BUCKET: str({
    desc: "AWS S3 bucket name",
    default: "",
    allowEmpty: true,
  }),
  AWS_S3_REGION: str({
    desc: "AWS S3 region",
    default: "",
    allowEmpty: true,
  }),
  BACKUP_DATABASE_URL: str({
    desc: "The connection string of the database to backup.",
  }),
  BACKUP_CRON_SCHEDULE: str({
    desc: "The cron schedule to run the backup on.",
    default: "0 5 * * *",
    allowEmpty: true,
  }),
  AWS_S3_ENDPOINT: str({
    desc: "The S3 custom endpoint you want to use.",
    default: "",
    allowEmpty: true,
  }),
  AWS_S3_FORCE_PATH_STYLE: bool({
    desc: "Use path style for the endpoint instead of the default subdomain style, useful for MinIO",
    default: false,
    allowEmpty: true,
  }),
  RUN_ON_STARTUP: bool({
    desc: "Run a backup on startup of this application",
    default: false,
    allowEmpty: true,
  }),
  GCP_PROJECT_ID: str({
    desc: "Google Cloud Project ID",
    default: "",
    allowEmpty: true,
  }),
  GCP_BUCKET: str({
    desc: "Google Cloud Storage bucket name",
    default: "",
    allowEmpty: true,
  }),
  GCP_SERVICE_ACCOUNT_KEY: str({
    desc: "Path to GCP service account keyfile",
    default: "",
    allowEmpty: true,
  }),
  GCP_KEYJSON: str({
    desc: "GCP service account credentials as a JSON string",
    default: "",
    allowEmpty: true,
  }),
  BACKUP_PROVIDER: str({
    desc: "Backup provider: s3 or gcp",
    default: "s3",
    allowEmpty: true,
  }),
  BACKUP_FILE_PREFIX: str({
    desc: "Prefix to the file name",
    default: "backup",
  }),
  BUCKET_SUBFOLDER: str({
    desc: "A subfolder to place the backup files in",
    default: "",
    allowEmpty: true,
  }),
  SINGLE_SHOT_MODE: bool({
    desc: "Run a single backup on start and exit when completed",
    default: true,
    allowEmpty: true,
  }),
  // This is both time consuming and resource intensive so we leave it disabled by default
  SUPPORT_OBJECT_LOCK: bool({
    desc: "Enables support for buckets with object lock by providing an MD5 hash with the backup file",
    default: false,
  }),
  BACKUP_OPTIONS: str({
    desc: "Any valid pg_dump option.",
    default: "",
    allowEmpty: true,
  }),
});
