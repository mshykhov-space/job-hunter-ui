# Product context

## Product and users

Job Hunter is a vacancy discovery and management dashboard. Public visitors can explore collected vacancies. Authenticated users can review jobs and manage preferences. The automation operations page is available only to the configured owner through the `read:automation` permission; controls additionally require `write:automation`.

## Primary workflows

- Explore public vacancies at `/explore`.
- Review, filter, and update authenticated vacancies at `/jobs`.
- Inspect vacancy history at `/statistics`.
- Manage matching, provider, outreach, and Telegram preferences at `/settings`.
- Inspect private runner health and durable automation workflow runs at `/automation`.

The current automation workflow is a three-step synthetic recovery drill. It verifies leasing, checkpoints, retries, process restart recovery, and owner controls. It does not open vacancy pages, capture screenshots, fill forms, or submit applications. Those browser-operation capabilities require separate workflow types and explicit product contracts.

## Platform and content constraints

- React 19, TypeScript, Vite, Ant Design 6, TanStack Query, and React Router 7.
- Dark-first UI with a complete light theme.
- Desktop and `390x844` mobile layouts are required verification targets.
- Server state belongs to TanStack Query and API calls use the shared authenticated client.
- Runtime OIDC configuration controls authentication; protected routes and API permissions remain authoritative.
- Expired sessions recover through a bounded refresh grant. Temporary provider failures retain credentials for retry; provider logout follows only explicit Logout.
- Global rematching requires `manage:jobs`; ordinary users manage only personal job state and preferences.
- Operational copy must identify whether a run is synthetic or vacancy-related and must not imply unsupported scheduling, screenshots, or submissions.

## Accessibility and success criteria

- All primary actions are keyboard reachable and have visible focus.
- Status is conveyed with text as well as color.
- Controls meet a practical 44-pixel touch target on mobile.
- Loading, empty, error, read-only, active, paused, failed, stopped, and completed states remain understandable.
- Static detection, automated WCAG scanning, console inspection, and failed-request inspection pass for affected routes.

## Evidence sources

Repository instructions, route definitions, feature components, mock handlers, tests, theme tokens, and the Kotlin API contract are authoritative. Design-intelligence search results are advisory and are not product facts.
