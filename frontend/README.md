# Spaceborn CRM frontend

The React application uses Vite, Tailwind CSS, DaisyUI, and Font Awesome. Use the Node release pinned in the root `.nvmrc`.

From the project root:

```sh
npm ci --prefix frontend
npm run dev:frontend
npm test --prefix frontend
npm run build --prefix frontend
```

During development, Vite listens on port 3000 and proxies `/api` to the backend on port 5000. Run `npm run dev:backend` in a second terminal. Put public `REACT_APP_` settings in the root `.env` shared with the backend and Docker Compose. The production build is written to `frontend/build/` and is served by Express in Docker.

When hosting the frontend separately, set `REACT_APP_API_URL` to the backend URL ending in `/api` and rebuild. See the [root README](../README.md) for Docker, demo sign-in, and Resend configuration.
