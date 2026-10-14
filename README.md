# Job Hunter UI

React dashboard for [Job Hunter](https://github.com/mshykhov-space/job-hunter). It provides public vacancy browsing and authenticated views for job status, preferences, statistics, and application materials.

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

Sessions persist in the configured OIDC user store. The application restores expired
access tokens with a refresh grant, limits provider requests to ten seconds, and
serializes renewals across requests and browser tabs when Web Locks is available.
Temporary renewal failures preserve the session for retry; an invalid refresh grant
clears local application authentication. Explicit Logout signs out at the provider.

Personal dashboard access does not grant global rematching. The operator-only
`manage:jobs` permission controls that action; see the API's user-onboarding guide
for provisioning and LinkedIn-only search setup.

## Structure

`src/features/` groups jobs, exploration, settings, and automation views. `src/app/` owns routing and providers; `src/config/` resolves runtime settings. See the [design documentation](docs/design/README.md) for the interface and [API grouping contract](docs/API_JOB_GROUPING.md) for vacancy grouping.

## License

[MIT](LICENSE)
