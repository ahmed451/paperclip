# Portable Paperclip + Hermes agent

A self-contained, host-isolated, copy-and-recreate-able Paperclip instance with
the Hermes CLI baked in. This README maps each file to your five priorities.

## TL;DR — first run

```bash
git clone https://github.com/ahmed451/paperclip.git
cd paperclip

# drop these files into the checkout (build context = repo root)
cp /path/to/Dockerfile  .
cp /path/to/compose.yaml .
cp /path/to/.env.example .env      # then edit .env
# Paperclip already ships a scripts/ folder — just add these two into it.
# Replace /path/to with wherever you saved the files (e.g. ~/Downloads).
cp /path/to/backup.sh  scripts/
cp /path/to/restore.sh scripts/
chmod +x scripts/backup.sh scripts/restore.sh

# fill in secrets
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env
# OPENROUTER_API_KEY=...   (edit .env)

docker compose up -d --build
docker compose logs -f paperclip      # watch it come up on 127.0.0.1:3100
```

Onboarding (create the first user / CEO) goes through the normal entrypoint, so
it runs as `node` and writes to node-owned paths — no `--entrypoint sh`, no
read-only or user overrides:

```bash
docker compose run --rm paperclip pnpm paperclipai onboard
```

(Depending on your fork, first-run onboarding may also be available in the web
UI. Either way, do NOT seed the volume with a root shell — that was the original
cause of the permission mess.)

---

## Priority 1 — buildable standalone (no manual `paperclip-base`)

The old setup needed a manual `docker build -t paperclip-base <git-url>` before
compose could build. That's gone. `Dockerfile` is upstream Paperclip's own
multi-stage build (`base → deps → build → production`) **verbatim**, plus one
appended stage, `paperclip-hermes`, that adds the Hermes CLI on top of
`production`. Compose builds that target directly:

```yaml
build: { context: ., dockerfile: Dockerfile, target: paperclip-hermes }
```

One `docker compose up -d --build` builds everything from source. Re-syncing
with upstream = replace everything above the `>>> ADDED` banner with the new
upstream Dockerfile; the Hermes block stays put.

> Note: upstream already builds the UI to static assets and serves it with
> `SERVE_UI=true` / `NODE_ENV=production`. The Vite "dev-mode" errors you hit
> earlier were caused by poking the image with a raw shell + read-only/user
> overrides, not by the image itself. The normal server never runs Vite.

## Priority 2 — state moves with you (`scripts/backup.sh` / `restore.sh`)

Named volumes do **not** travel when you copy the compose file — they live in
`/var/lib/docker/volumes` on the host. Two volumes hold all state:

- `paperclip_db` — Postgres
- `paperclip_data` — Paperclip config **and** Hermes `~/.hermes` (because
  `HOME=/paperclip`, which is this volume — that's why no separate `hermes_home`
  volume exists anymore)

`backup.sh` produces a logical `pg_dump` (version-safe, consistent) plus a tar
of `paperclip_data`. Those two files + `Dockerfile` + `compose.yaml` + `.env`
fully reconstruct the agent elsewhere:

```bash
./scripts/backup.sh ./backups
# → backups/db-<ts>.sql.gz  +  backups/paperclip_data-<ts>.tgz

# on the new host, after `docker compose up -d --build`:
./scripts/restore.sh backups/db-<ts>.sql.gz backups/paperclip_data-<ts>.tgz
```

(`PROJECT` env var in both scripts must match `name:` in compose.yaml —
`paperclip4` by default — since that prefixes the real volume names.)

## Priority 3 — host containment (corrected for gosu)

The big wins are already in place by *omission*: no Docker socket mounted, no
`privileged`, no host bind mounts. Keep it that way.

The important correction from earlier: this image's entrypoint runs
`exec gosu node "$@"`, i.e. it **starts as root and drops to `node` itself**.
So the hardening must NOT remove the privilege gosu needs. The compose file:

- **does not** set `user:` and the Dockerfile **does not** add `USER node`
  (either makes the container start non-root, so `gosu` → "operation not
  permitted" — the exact error you saw).
- `cap_drop: [ALL]` then `cap_add` only `SETUID, SETGID, CHOWN, DAC_OVERRIDE,
  FOWNER, SETPCAP` — enough for gosu's drop and the entrypoint's chown, nothing
  more.
- `security_opt: [no-new-privileges:true]` — safe, because it blocks *gaining*
  privileges, not *dropping* them.
- `mem_limit`, `pids_limit`, `cpus` on both services.
- **No `read_only`** on the server: it legitimately writes under `/app` and
  `/paperclip` at runtime. Upstream's own compose doesn't use it either.

If you want to go further (rootless Docker / Podman, or gVisor `runsc`), those
sit *under* this config and don't conflict — they neutralize container-root
entirely. Worth it only if you stop trusting the agent code itself.

## Priority 4 — reproducible rebuilds (digest pinning)

Pin the mutable bases by digest so a rebuild months later is identical. Resolve
current digests, then edit the files:

```bash
docker buildx imagetools inspect node:lts-trixie-slim   # → Dockerfile FROM ... @sha256:
docker buildx imagetools inspect postgres:16            # → compose image: ... @sha256:
```

Hermes is already pinned (`--branch v2026.5.29.2`). `uv` is installed from
`astral.sh/uv/install.sh` (latest at build time) — to pin it, export a specific
`UV_VERSION` before the curl, or download a tagged release. Everything else is
locked by `pnpm-lock.yaml` / `--frozen-lockfile`.

## Priority 5 — network egress (a decision, not a default)

Your isolation goal was "don't touch the host," which the above covers. Egress
control is a *separate* concern (data exfiltration / call-home), so it's left
**off** by default. If you later want it:

- **Cheap win:** the database never needs the internet. Put `paperclip-db` on a
  second network marked `internal: true`; keep `paperclip` on `sandbox` for its
  provider calls. The DB can then talk to the server but not the outside world.
- **Full lockdown:** the agent itself must reach the model provider, so you
  can't just cut its egress. The pattern is an allowlist forward-proxy
  (e.g. a small `tinyproxy`/`squid` container) on its own egress network, mark
  `sandbox` `internal: true`, and point the agent at the proxy via
  `HTTP(S)_PROXY`, allowing only the provider host(s). That's a real project on
  its own — adopt it only if call-home is in your threat model.

---

## What changed vs the original setup

- `paperclip-init` — **kept, but now a correct chown** (was a `chmod a+rwX`
  band-aid). Upstream's entrypoint only chowns `/paperclip` when it *remaps* the
  uid; with the default uid it skips that, so a root-owned fresh volume needs
  this one-shot `chown -R 1000:1000` or `node` can't write (EACCES on
  `/paperclip/.cache`).
- `hermes_home` volume and `HOME=/hermes-home` — **removed**; `HOME=/paperclip`
  is already the data volume, so `~/.hermes` persists there.
- `user: "1000:1000"`, `USER node`, blanket `cap_drop: [ALL]`, `read_only` —
  **removed/corrected**; they broke gosu. Replaced with the curated cap set.
- Manual `paperclip-base` pre-build — **removed**; single targeted multi-stage
  build.
