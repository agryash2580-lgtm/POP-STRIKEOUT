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
