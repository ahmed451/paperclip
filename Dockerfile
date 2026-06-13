# syntax=docker/dockerfile:1.20
# =============================================================================
# Paperclip + Hermes — single self-contained build.
#
# Everything ABOVE the "ADDED" banner is upstream Paperclip's own Dockerfile,
# copied verbatim. The block BELOW the banner is the only local addition: a
# `paperclip-hermes` stage that installs the Hermes CLI on top of upstream's
# `production` stage.
#
# Build context = the Paperclip repo root. One command, no pre-step:
#     docker compose up -d --build      (compose targets `paperclip-hermes`)
#
# Re-syncing with upstream later: replace everything above the banner with the
# new upstream Dockerfile, keep the block below unchanged.
# -----------------------------------------------------------------------------
# Reproducible builds (priority 4): pin the base by digest, e.g.
#     FROM node:lts-trixie-slim@sha256:<digest> AS base
# Resolve the current digest with:
#     docker buildx imagetools inspect node:lts-trixie-slim
# =============================================================================
FROM node:lts-trixie-slim AS base
ARG USER_UID=1000
ARG USER_GID=1000
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates gosu curl gh git wget ripgrep python3 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# Modify the existing node user/group to have the specified UID/GID to match host user
RUN usermod -u $USER_UID --non-unique node \
  && groupmod -g $USER_GID --non-unique node \
  && usermod -g $USER_GID -d /paperclip node

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/adapters/acpx-local/package.json packages/adapters/acpx-local/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/gemini-local/package.json packages/adapters/gemini-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/
COPY packages/plugins/sdk/package.json packages/plugins/sdk/
COPY --parents packages/plugins/sandbox-providers/./*/package.json packages/plugins/sandbox-providers/
COPY packages/plugins/paperclip-plugin-fake-sandbox/package.json packages/plugins/paperclip-plugin-fake-sandbox/
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @paperclipai/ui build
RUN pnpm --filter @paperclipai/plugin-sdk build
RUN pnpm --filter @paperclipai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
ARG USER_UID=1000
ARG USER_GID=1000
WORKDIR /app
COPY --chown=node:node --from=build /app /app
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssh-client jq \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /paperclip \
  && chown node:node /paperclip

COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  USER_UID=${USER_UID} \
  USER_GID=${USER_GID} \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private \
  OPENCODE_ALLOW_ALL_MODELS=true

VOLUME ["/paperclip"]
EXPOSE 3100

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]

# =============================================================================
# >>> ADDED: Hermes CLI layer (local extension of upstream `production`) <<<
# Inherits ENTRYPOINT (gosu), CMD, ENV (incl. HOME=/paperclip), VOLUME, EXPOSE.
# =============================================================================
FROM production AS paperclip-hermes

# Stay root ON PURPOSE. The inherited docker-entrypoint.sh does `exec gosu node`
# at runtime to drop privileges. Do NOT add `USER node` here, and in compose do
# NOT set `user:` or `cap_drop: [ALL]` without re-adding SETUID/SETGID — any of
# those removes the privilege gosu needs and you get
#     "failed switching to node: operation not permitted".
USER root

# Base already provides python3, git, curl, ca-certificates, ripgrep — Hermes's
# usual shell-out tools. We only add uv + Hermes itself.
#
# Install uv to FIXED on-PATH dirs so nothing depends on $HOME (=/paperclip):
#   UV_INSTALL_DIR  -> the uv binary
#   UV_TOOL_BIN_DIR -> where `uv tool install` puts the `hermes` shim
#   UV_TOOL_DIR     -> the tool's venv
# Reproducible builds (priority 4): pin uv by appending a version to the script
# URL or exporting UV_VERSION before the curl; pin Hermes via the tag below.
ENV UV_INSTALL_DIR=/usr/local/bin \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_TOOL_DIR=/opt/uv-tools \
    INSTALLER_NO_MODIFY_PATH=1
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && uv --version

# Pinned Hermes tag. The shim lands in /usr/local/bin (already on PATH); at
# runtime `hermes` runs as the dropped-to `node` user and writes its state to
# $HOME/.hermes = /paperclip/.hermes, which is on the persistent volume.
RUN git clone --depth 1 --branch v2026.5.29.2 \
        https://github.com/NousResearch/hermes-agent.git /opt/hermes \
    && cd /opt/hermes \
    && uv tool install . \
    && hermes --version
