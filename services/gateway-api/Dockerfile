FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app

# Copy configs
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway-api/package.json services/gateway-api/

# Strip file: deps from gateway so npm doesn't try to resolve missing packages
RUN node -e "\
  const fs=require('fs');\
  const p=JSON.parse(fs.readFileSync('services/gateway-api/package.json','utf8'));\
  for(const k of Object.keys(p.dependencies||{})){if(p.dependencies[k].startsWith('file:'))delete p.dependencies[k]}\
  fs.writeFileSync('services/gateway-api/package.json',JSON.stringify(p,null,2))"

RUN npm install --include=dev

# Copy all sources (restores original gateway package.json with file: refs)
COPY packages/shared packages/shared
COPY packages/trading-platform packages/trading-platform
COPY packages/compute-mesh packages/compute-mesh
COPY packages/design-system packages/design-system
COPY packages/document-intel packages/document-intel
COPY packages/marketing-intel packages/marketing-intel
COPY packages/model-router packages/model-router
COPY packages/quantum-sim packages/quantum-sim
COPY packages/security-toolkit packages/security-toolkit
COPY services/gateway-api services/gateway-api
COPY docs/community docs/community
COPY docs/release/status docs/release/status

# Build shared
RUN npm run build --workspace=packages/shared

# Build pillar packages (pure TS, no npm deps)
RUN for pkg in trading-platform compute-mesh design-system document-intel \
    marketing-intel model-router quantum-sim security-toolkit; do \
    echo "Building @sven/$pkg..." && cd /app/packages/$pkg && npx tsc; \
  done

# Symlink @sven/* packages into node_modules so tsc NodeNext resolution finds them
RUN mkdir -p /app/node_modules/@sven \
  && ln -sf /app/packages/shared /app/node_modules/@sven/shared \
  && ln -sf /app/packages/trading-platform /app/node_modules/@sven/trading-platform \
  && ln -sf /app/packages/compute-mesh /app/node_modules/@sven/compute-mesh \
  && ln -sf /app/packages/design-system /app/node_modules/@sven/design-system \
  && ln -sf /app/packages/document-intel /app/node_modules/@sven/document-intel \
  && ln -sf /app/packages/marketing-intel /app/node_modules/@sven/marketing-intel \
  && ln -sf /app/packages/model-router /app/node_modules/@sven/model-router \
  && ln -sf /app/packages/quantum-sim /app/node_modules/@sven/quantum-sim \
  && ln -sf /app/packages/security-toolkit /app/node_modules/@sven/security-toolkit

# Build gateway
RUN cd /app/services/gateway-api && npx tsc
RUN cp -r services/gateway-api/src/db/migrations services/gateway-api/dist/db/
RUN cp -r services/gateway-api/src/db/rollbacks services/gateway-api/dist/db/

# ── Runtime ──
FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/services/gateway-api/dist services/gateway-api/dist
COPY --from=builder /app/services/gateway-api/package.json services/gateway-api/package.json
COPY --from=builder /app/docs/community docs/community
COPY --from=builder /app/docs/release/status docs/release/status

# Symlink all @sven/* packages into node_modules for runtime resolution
RUN rm -rf node_modules/@sven && mkdir -p node_modules/@sven \
  && ln -s ../../packages/shared node_modules/@sven/shared \
  && ln -s ../../packages/trading-platform node_modules/@sven/trading-platform \
  && ln -s ../../packages/compute-mesh node_modules/@sven/compute-mesh \
  && ln -s ../../packages/design-system node_modules/@sven/design-system \
  && ln -s ../../packages/document-intel node_modules/@sven/document-intel \
  && ln -s ../../packages/marketing-intel node_modules/@sven/marketing-intel \
  && ln -s ../../packages/model-router node_modules/@sven/model-router \
  && ln -s ../../packages/quantum-sim node_modules/@sven/quantum-sim \
  && ln -s ../../packages/security-toolkit node_modules/@sven/security-toolkit

ENV SVEN_LLM_MODEL=qwen2.5:7b
ENV SVEN_LLM_ENDPOINT=http://10.47.47.13:11434
ENV SVEN_LOOP_AUTOSTART=true

EXPOSE 3000
USER node
CMD ["node", "services/gateway-api/dist/index.js"]

