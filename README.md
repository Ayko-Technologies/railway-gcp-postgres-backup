# Postgres S3 backups

A simple NodeJS application to backup your PostgreSQL database to S3 via a cron.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/I4zGrH)

## Configuration

- `AWS_ACCESS_KEY_ID` - AWS access key ID.

- `AWS_SECRET_ACCESS_KEY` - AWS secret access key, sometimes also called an application key.

- `AWS_S3_BUCKET` - The name of the bucket that the access key ID and secret access key are authorized to access.

- `AWS_S3_REGION` - The name of the region your bucket is located in, set to `auto` if unknown.

- `BACKUP_DATABASE_URL` - The connection string of the database to backup.

- `BACKUP_CRON_SCHEDULE` - The cron schedule to run the backup on. Example: `0 5 * * *`

- `AWS_S3_ENDPOINT` - The S3 custom endpoint you want to use. Applicable for 3-rd party S3 services such as Cloudflare R2 or Backblaze R2.

- `AWS_S3_FORCE_PATH_STYLE` - Use path style for the endpoint instead of the default subdomain style, useful for MinIO. Default `false`

- `RUN_ON_STARTUP` - Run a backup on startup of this application then proceed with making backups on the set schedule.

- `BACKUP_FILE_PREFIX` - Add a prefix to the file name.

- `BUCKET_SUBFOLDER` - Define a subfolder to place the backup files in.

- `SINGLE_SHOT_MODE` - Run a single backup on start and exit when completed. Useful with the platform's native CRON schedular.

- `SUPPORT_OBJECT_LOCK` - Enables support for buckets with object lock by providing an MD5 hash with the backup file.

- `BACKUP_OPTIONS` - Add any valid pg_dump option, supported pg_dump options can be found [here](https://www.postgresql.org/docs/current/app-pgdump.html). Example: `--exclude-table=pattern`

## Running Locally

To run this backup tool locally, follow these steps:

1. **Install dependencies:**

   ```sh
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the project root and set the required variables. You can use either AWS S3 or Google Cloud Storage (GCP) as your backup provider.

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

   ### For Google Cloud Storage (GCP)

   ```env
   BACKUP_PROVIDER=gcp
   GCP_PROJECT_ID=your-gcp-project-id
   GCP_BUCKET=your-gcs-bucket-name
   GCP_SERVICE_ACCOUNT_KEY=path-to-your-service-account-keyfile.json // This should be a base64 encoded string of your service account json file.
   BACKUP_DATABASE_URL=your-postgres-connection-string
   # Optional: BUCKET_SUBFOLDER, etc.
   ```

3. **Run the backup:**

   ```sh
   npm start
   ```

   Or, to run a single backup and exit:

   ```sh
   SINGLE_SHOT_MODE=true npm start
   ```

Backups will be uploaded to the configured S3 or GCS bucket. See environment variable descriptions above for more options.

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
