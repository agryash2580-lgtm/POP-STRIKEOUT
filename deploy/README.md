# Run StrikeOut on your own domain

This is a **single-server** setup. Docker Compose runs the Node application behind
Caddy HTTPS and keeps account, session, MFA and case records in a named data volume.
A domain alone does not run the app: you also need a server with Docker Compose,
public ports 80 and 443, and DNS pointing the domain at that server.

1. On the server, clone the GitHub repository. Create private configuration files:

   ```sh
   cp deploy/domain.env.example .env
   cp deploy/production.env.example .env.production
   chmod 600 .env .env.production
   ```

2. Replace `STRIKEOUT_DOMAIN` in `.env` with your own hostname. Set
   `MFA_ENCRYPTION_KEY` in `.env.production` to the output of `openssl rand -base64 32`.
   Keep that exact key across upgrades; losing it makes enrolled authenticator
   secrets unreadable. Add optional provider keys only when you choose to enable
   those integrations. These files are Git-ignored and excluded from Docker builds.

3. Point the hostname's DNS A/AAAA record at this server. Then start the stack:

   ```sh
   GIT_COMMIT_SHA=$(git rev-parse HEAD) docker compose up -d --build
   ```

   Caddy obtains the HTTPS certificate when DNS and ports are ready. Check the
   containers with `docker compose ps` and `docker compose logs --tail=100 app caddy`.
   Once HTTPS works, verify public health and demo assets with:

   ```sh
   DEPLOY_URL=https://your-real-domain.example npm run check:deployment
   ```

The application binds only to the internal Compose network. Keep only one `app`
replica: its JSON-file storage and in-process rate limits are not designed for
multiple application instances. The `strikeout_data` volume is essential. Back it
up securely before upgrades; `docker compose down -v` **deletes** it. Protect the
server and its backups because the files contain private user records. The health
endpoint proves a storage read, not that backups or optional search providers work.

This setup does not import records from an earlier hosting provider. A migration
must be planned separately before switching users to the new domain. Google OAuth,
if enabled, also needs a callback URL registered for that exact HTTPS domain.
The consented Instagram operator browser requires an additional Chromium runtime
and is not provisioned by this base image; keep that workflow disabled until an
operator has tested it on the chosen host.

## Automated stack verification

The GitHub **Readiness checks → self-host** job builds this Dockerfile and starts
this Compose stack on an isolated runner with a disposable `localhost` hostname,
MFA key, account and data volume. It checks HTTPS, secure session/challenge cookies,
MFA enrollment, the exposure gate, a masked supplied-document assessment, recovery
sign-in and deletion. It replaces the application container and requires the same
session, private case and encrypted authenticator to keep working afterwards.
It also checks that the app runs without root, private environment files are not
copied into the image, and startup refuses a missing MFA encryption key.

Local HTTPS uses Caddy's disposable local CA. The test trusts only that CA for its
own requests; it does not disable certificate checks or install a system-wide
certificate. This follows [Caddy's local HTTPS Docker guidance](https://caddyserver.com/docs/running#local-https-with-docker).
The scripts refuse to run outside the isolated CI fixture and refuse to overwrite
existing environment files. The workflow removes its containers and volumes even
after a failed check. No provider credentials, personal targets or email delivery
are involved. A passing job verifies the stack on a clean runner; public DNS,
public certificates, real integrations and backup recovery still need validation
on your actual server.

The image also includes the expired-authentication cleanup tool. Preview first:

```sh
docker compose exec -T app node scripts/cleanup-expired.mjs
```

Adding `--apply` removes only allowlisted authentication records expired more than
24 hours ago. Cases, evidence, verified email addresses and delivery receipts are
outside that sweep. Scheduling the sweep belongs to the chosen host's operations
setup; the base image does not silently schedule deletions.

## Encrypted offline backup and recovery

The local-file storage tool is `scripts/storage-backup.mjs`. Stop the application
before either operation; `--offline` acknowledges that prerequisite, it does not
stop the server for you. A running app can change several records during a copy,
so live snapshots are unsupported.

Generate a separate random 32-byte base64 backup key (`openssl rand -base64 32`)
and keep it in your private password manager. Keep the original `.env.production`
and its stable MFA key separately. The archive excludes configuration files and
checks the original MFA key's fingerprint before restoring. Losing either key
prevents complete recovery. Do not put a key in a command argument or GitHub.

On the Docker host, using Bash, enter the backup key without echoing it:

```sh
umask 077
set -o noclobber
read -r -s -p 'Backup key: ' STRIKEOUT_BACKUP_KEY
export STRIKEOUT_BACKUP_KEY
docker compose stop app
docker compose run --rm --no-deps -T -e STRIKEOUT_BACKUP_KEY app node scripts/storage-backup.mjs create --offline > snapshot.strikeout-backup
docker compose up -d --wait app
unset STRIKEOUT_BACKUP_KEY
```

Require a successful backup command before keeping the archive. Use a new filename
for each snapshot; `noclobber` protects existing files. Store the encrypted file
off the server and test recovery. It contains private historical account/case data,
so limit retention and access even though it is encrypted. Archives and backup-key
files are excluded from Git and Docker builds.

To recover on a replacement host, restore the original private configuration and
use a **new, empty data volume**. Keep the app stopped. The restore tool refuses to
overwrite any existing records; do not delete a working volume to make room.

```sh
read -r -s -p 'Backup key: ' STRIKEOUT_BACKUP_KEY
export STRIKEOUT_BACKUP_KEY
docker compose run --rm --no-deps -T -e STRIKEOUT_BACKUP_KEY app node scripts/storage-backup.mjs restore --offline < snapshot.strikeout-backup
unset STRIKEOUT_BACKUP_KEY
docker compose up -d --wait app
```

Restore authenticates the full archive before writing, validates filenames/JSON,
stages records privately, and never overwrites a destination file. The format uses
AES-256-GCM with a random nonce and authenticated version header through
[Node's crypto API](https://nodejs.org/api/crypto.html#class-cipheriv). It supports
up to 50,000 flat JSON files, 16 MiB per record, 64 MiB total source data and a
128 MiB archive. Unsupported entries, symlinks, changed files, bad keys and damaged
archives fail explicitly.

Sessions, pairing tokens, OAuth/MFA challenges, exposure grants, domain proofs,
quotas and pending email codes are omitted. Restored account-security versions
advance and old recovery codes are invalidated. Wait until the returned
`mfaCodesUsableAfter` time for a fresh authenticator code, then sign in and verify
again before an exposure check. Re-enroll MFA to obtain new recovery codes.
Verified email and case records are retained. A snapshot can contain accounts or
evidence deleted after it was created: review intervening deletion requests before
reopening the recovered service.

The GitHub self-host job performs a disposable volume-loss recovery test. It keeps
the encrypted archive only in memory, destroys only its own fixture volume,
restores into a new volume, and checks fresh MFA, recovered cases and a new
authorized assessment. This is separate from testing your off-server backup
location, retention policy and actual hosting environment.
