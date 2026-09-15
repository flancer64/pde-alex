# pde-alex
Personal Digital Embassy for Alex
# Database migration

The explicit Runtime DEM migration is available as:

```sh
npm exec -- teq db:migrate
```

Run it while the application is stopped and after taking an independent PostgreSQL backup. The command migrates the initial five-table predecessor, the Runtime v3 schema, and the previous Trusted Person schema to the latest Runtime DEM. The latest schema includes Client provenance, Delegation state, Mandate state, Trusted Person email identity, Trusted Person sessions, authentication challenges, and authentication-request rate-limit evidence. The command compiles source and target DEMs and invokes the TeqFW rebuild executor with explicit row transformations; when an older Trusted Person table has no email, it receives a deterministic `@invalid.local` marker because the source contains no email to recover. Source tables are moved to the `legacy_` namespace and retained for audit and recovery; they are not deleted by the command. The migration records effective-DEM snapshots and the applied schema transition through the TeqFW history service only after catalog validation succeeds.
