# pde-alex
Personal Digital Embassy for Alex

## Porkbun Desk configuration

The host includes `@flancer32/pde-desk-porkbun` for domain inventory and DNS
record listing, creation, and deletion. Set `PDE_DESK_PORKBUN__API_KEY` and
`PDE_DESK_PORKBUN__SECRET_API_KEY` in the application's private `.env` before
startup; both are required. Optional endpoint and timeout settings are listed
in `.env.example`. Never commit live credentials.

The Desk registers through CLI lifecycle metadata without network requests
at startup. CI uses dummy credentials only to verify composition. Live API
access requires valid Porkbun credentials and API access enabled for the
target domains. Runtime grants must explicitly authorize `porkbun.read` or
`porkbun.write` for exact domain scopes; listing all account domains also
requires `accountInventory: true` in the read Permission. DNS Operations
require Porkbun to be authoritative for the requested domain.

## Application composition check

Run the complete host startup and verify that all required Desks, Operations,
Capabilities, and Delegation editors are registered:

```sh
npm run check:app
```

This starts the configured Runtime and package lifecycle plugins, then shuts
them down after the check. It uses the application's configured database and
may initialize Runtime state, so use an isolated local database when you do not
want to touch the database configured for normal startup. CI runs the same
command against temporary SQLite and filesystem locations on every push and
pull request.

Check JavaScript and JSDoc types in the host's `src` and `bootstrap` directories
without emitting files:

```sh
npm run typecheck
```

# Database migration

The explicit Runtime DEM migration is available as:

```sh
npm exec -- teq db:migrate
```

Run it while the application is stopped and after taking an independent PostgreSQL backup. The command migrates the initial five-table predecessor, the Runtime v3 schema, and the previous Trusted Person schema to the latest Runtime DEM. The latest schema includes Client provenance, Delegation state, Mandate state, Trusted Person email identity, Trusted Person sessions, authentication challenges, and authentication-request rate-limit evidence. The command compiles source and target DEMs and invokes the TeqFW rebuild executor with explicit row transformations; when an older Trusted Person table has no email, it receives a deterministic `@invalid.local` marker because the source contains no email to recover. Source tables are moved to the `legacy_` namespace during the rebuild and removed only after the target catalog and migration history have been verified. The migration records effective-DEM snapshots and the applied schema transition through the TeqFW history service only after catalog validation succeeds.
