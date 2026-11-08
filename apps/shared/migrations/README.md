# Database migrations

All database schema changes for every service belong in this directory.

Use monotonically increasing UTC prefixes, for example:

```text
20261015170000_create_catalog.sql
```

Migrations are immutable after reaching a shared environment. Correct an applied migration with a new forward migration rather than editing history.
