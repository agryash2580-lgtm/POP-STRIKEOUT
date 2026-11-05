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
