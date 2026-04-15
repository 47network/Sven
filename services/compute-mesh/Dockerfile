FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/compute-mesh/package.json ./packages/compute-mesh/package.json
COPY services/compute-mesh/package.json ./services/compute-mesh/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY packages/compute-mesh ./packages/compute-mesh
COPY services/compute-mesh ./services/compute-mesh
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/compute-mesh && npm run build --workspace=services/compute-mesh

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
COPY --from=build /app/services/compute-mesh/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/compute-mesh/dist ./dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/compute-mesh/package.json ./node_modules/@sven/compute-mesh/package.json
COPY --from=build /app/packages/compute-mesh/dist ./node_modules/@sven/compute-mesh/dist
COPY --from=build /app/services/compute-mesh/migrations ./migrations
USER node
CMD ["node", "dist/index.js"]
