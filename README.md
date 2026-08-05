# Postgres GCS backups

A simple Node.js application that backs up PostgreSQL databases to Google Cloud Storage (GCS) on a cron. S3 and S3-compatible object storage are also supported.

## Configuration

### Provider

- `BACKUP_PROVIDER` - Storage provider: `gcp` for Google Cloud Storage (the primary provider) or `s3` for Amazon S3 and S3-compatible storage. Defaults to `gcp`.

### Google Cloud Storage (GCP)

Set these when `BACKUP_PROVIDER=gcp`.

- `GCP_BUCKET` - The Google Cloud Storage bucket that will receive backups.

- `GCP_SERVICE_ACCOUNT_KEY` - A base64-encoded Google Cloud service-account JSON key. The service account must be allowed to write objects to `GCP_BUCKET`.

- `GCP_PROJECT_ID` - The Google Cloud project ID. Optional when it can be inferred from the service-account credentials.

### Amazon S3 and S3-compatible storage

Set these when `BACKUP_PROVIDER=s3`.

- `AWS_ACCESS_KEY_ID` - AWS access key ID.

- `AWS_SECRET_ACCESS_KEY` - AWS secret access key, sometimes also called an application key.

- `AWS_S3_BUCKET` - The bucket that the configured credentials are authorized to access.

- `AWS_S3_REGION` - The region your bucket is located in; set to `auto` if unknown.

- `AWS_S3_ENDPOINT` - Custom S3 endpoint. Use this for third-party S3 services such as Cloudflare R2 or Backblaze B2.

- `AWS_S3_FORCE_PATH_STYLE` - Use path-style addressing instead of the default subdomain-style addressing; useful for MinIO. Defaults to `false`.

- `SUPPORT_OBJECT_LOCK` - Provide an MD5 hash with the backup file for buckets that use object lock. Defaults to `false`.

### Backup behaviour

- `BACKUP_DATABASE_URL` - The connection string of the database to back up.

- `BACKUP_CRON_SCHEDULE` - Cron schedule for backups. Defaults to `0 5 * * *`.

- `RUN_ON_STARTUP` - Run a backup when the application starts, then continue on the configured schedule. Defaults to `false`.

- `SINGLE_SHOT_MODE` - Run one backup at startup and exit. Useful with a platform's native cron scheduler. Defaults to `true`.

- `BACKUP_FILE_PREFIX` - Prefix for backup file names. Defaults to `backup`.

- `BUCKET_SUBFOLDER` - Subfolder in the target bucket for backup files.

- `BACKUP_OPTIONS` - Any valid `pg_dump` option. See the [pg_dump documentation](https://www.postgresql.org/docs/current/app-pgdump.html). Example: `--exclude-table=pattern`

## Running Locally

To run this backup tool locally, follow these steps:

1. **Install dependencies:**

   ```sh
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the project root and set the required variables. Google Cloud Storage (GCP) is the primary provider; AWS S3 and S3-compatible storage are also supported.

   ### For Google Cloud Storage (GCP)

   ```env
   BACKUP_PROVIDER=gcp
   GCP_PROJECT_ID=your-gcp-project-id
   GCP_BUCKET=your-gcs-bucket-name
   # Base64-encoded contents of a service-account JSON key file
   GCP_SERVICE_ACCOUNT_KEY=your-base64-encoded-service-account-key
   BACKUP_DATABASE_URL=your-postgres-connection-string
   # Optional: BUCKET_SUBFOLDER, BACKUP_FILE_PREFIX, etc.
   ```

   ### For AWS S3

   ```env
   BACKUP_PROVIDER=s3
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   AWS_S3_BUCKET=your-bucket-name
   AWS_S3_REGION=your-region
   BACKUP_DATABASE_URL=your-postgres-connection-string
   # Optional: AWS_S3_ENDPOINT, AWS_S3_FORCE_PATH_STYLE, BUCKET_SUBFOLDER, etc.
   ```

3. **Run the backup:**

   ```sh
   npm start
   ```

   Or, to run a single backup and exit:

   ```sh
   SINGLE_SHOT_MODE=true npm start
   ```

Backups will be uploaded to the configured GCS or S3 bucket. See the configuration reference above for more options.

## Restoring a Backup

To restore a backup from S3 or GCP, download the desired backup file and run:

```sh
# Unzip and restore using pg_restore
# Replace <backup-file> and <connection-string> as needed

gzip -cd <backup-file> | pg_restore --dbname=<connection-string> --format=tar
```

### For GCP

1. Go to your bucket in the Google Cloud Console.
2. Navigate to the date-based subfolder (e.g., `2025-08-15/`).
3. Download the backup file you want to restore.
4. Use the command above to restore.

### For S3

1. Go to your bucket in the AWS Console.
2. Find and download the backup file you want to restore.
3. Use the command above to restore.

You can also automate downloads using the AWS CLI or Google Cloud SDK if needed.

## Deployment Notes

On Railway, this backup runs in **single shot mode** by default. Each deployment or scheduled run will execute one backup and then exit. Use Railway's native cron to schedule a cron job in this mode. To change this behavior, adjust the `SINGLE_SHOT_MODE` environment variable in your Railway project settings.

The Docker image installs multiple PostgreSQL clients using the `PG_CLIENT_VERSIONS` build argument. At runtime, the backup process detects the database server major version and chooses a compatible `pg_dump`. PostgreSQL does not support using an older `pg_dump` against a newer server, so include every server major version you expect to run.
