## Backend Features

### Authentication

- User registration with email verification.
- Resend email verification OTP.
- User login and access token issuance.
- Refresh and logout endpoints.
- Authenticated user profile endpoint.

### Google Integration

- Connect a Google account using OAuth 2.0.
- Validate the one-time OAuth state and use PKCE.
- Encrypt Google credentials before storing them.
- List connected integrations.
- Disconnect a Google account.

### Gmail Synchronization

- Trigger an authenticated Gmail initial sync.
- Run sync jobs in the background with Celery and Redis.
- Fetch Gmail profile information and messages.
- Normalize message headers, recipients, snippet, body, received time, and read/starred status.
- Store synchronized messages in PostgreSQL and avoid duplicate records.
- Save the Gmail history ID as a cursor after a successful sync.
- Track sync job status and processed, created, and updated counts.

The current initial sync fetched 100 messages in the local run. Each run is capped at 100 messages.

### Database and Architecture

- Use SQLAlchemy models and Alembic migrations for users, integrations, credentials, emails, sync jobs, and sync cursors.
- Separate API routes, services, repositories, providers, Gmail clients, and message mapping.

### Not Implemented Yet

- Incremental Gmail synchronization.
- Fetching more than 100 messages per run.
- Email list, detail, and search endpoints.