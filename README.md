# pde-alex
Personal Digital Embassy for Alex
# Database migration

The explicit legacy Runtime migration is available as:

```sh
npm exec -- teq db:migrate
```

Run it while the application is stopped and after taking an independent PostgreSQL backup. The command accepts only the reviewed pre-Dynamic-Client-Registration schema, renames all legacy tables to `__legacy_backup`, creates the compiled Runtime DEM schema, and copies transformed rows. The backup tables are intentionally retained for audit and recovery; remove them only after an independent verification.
