FROM node:26.13.1-trixie-slim AS node-base
RUN npm install --global npm@12.2.3 --no-audit --no-fund && npm cache clean --force

FROM node-base AS frontend-build
WORKDIR /app

COPY frontend/package*.json frontend/.npmrc ./frontend/
RUN npm ci --prefix frontend --no-audit --no-fund

COPY frontend ./frontend
ARG REACT_APP_API_URL
ARG REACT_APP_DRIVE_FOLDER_ID
ARG REACT_APP_FRONTEND_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG REACT_APP_LOCKOUT_DURATION
ARG REACT_APP_MAX_LOGIN_ATTEMPTS
ARG REACT_APP_SESSION_TIMEOUT
ARG PUBLIC_REFRESH_THRESHOLD
ARG PUBLIC_MOCK_MODE
RUN REACT_APP_TOKEN_REFRESH_THRESHOLD="$PUBLIC_REFRESH_THRESHOLD" \
    REACT_APP_USE_MOCK_AUTH="$PUBLIC_MOCK_MODE" \
    npm run build --prefix frontend

FROM node-base AS production
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend --no-audit --no-fund && npm cache clean --force

COPY backend ./backend
COPY --from=frontend-build /app/frontend/build ./frontend/build

EXPOSE 5000
CMD ["node", "backend/server.js"]
