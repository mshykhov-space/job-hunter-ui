# Job Hunter UI

React dashboard for [Job Hunter](https://github.com/mshykhov/job-hunter). It provides public vacancy browsing and authenticated views for job status, preferences, statistics, and application materials.

## Run locally

Requires Node.js 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The development server runs at `http://localhost:5173` and uses `API_URL` from `.env.local` (default `http://localhost:8095`). Set `OIDC_ENABLED=true`, `OIDC_AUTHORITY`, and `OIDC_CLIENT_ID` to test authenticated views. `npm run dev:mock` starts an isolated mock-data preview.

## Build and test

```sh
npm run lint
npm test
npm run build
```

The Docker image serves the compiled application on port 8080 and reads the same configuration variables at startup.

## Structure

`src/features/` groups jobs, exploration, settings, and automation views. `src/app/` owns routing and providers; `src/config/` resolves runtime settings. See the [documentation map](docs/README.md) for architecture and UI contracts.

## License

[MIT](LICENSE)
