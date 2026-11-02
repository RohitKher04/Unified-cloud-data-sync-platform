# Unified Cloud Data Sync Platform

A high-performance, multi-account cloud data synchronization platform built with **FastAPI**, **PostgreSQL**, **Celery**, **Redis**, and a modern **React + Vite** frontend.

---

## Backend Features

### Authentication & Security
- **Email Verification (OTP):** User registration with time-limited (5-minute) 6-digit OTP verification via SMTP.
- **Resend OTP Flow:** Rate-limited OTP resend with 60-second cooldown and max 3 attempts.
- **Argon2id Password Hashing:** Secure password hashing with password complexity validation rules.
- **Dual-Token JWT Sessions:** Short-lived access tokens (30 mins) and long-lived refresh tokens (7 days) tracked and hashed in the database.
- **Session Revocation:** Secure logout and token rotation on refresh to prevent replay attacks.
- **User Profile:** Authenticated current user endpoint (`/api/v1/users/me`).

### Google Integration & OAuth 2.0
- **OAuth 2.0 with PKCE:** Secure authorization code flow using Proof Key for Code Exchange (PKCE) with encrypted code verifiers.
- **CSRF State Protection:** One-time, time-limited state hash storage and atomic state consumption on callback.
- **Encrypted Token Storage:** Symmetric Fernet encryption for access and refresh tokens at rest in PostgreSQL.
- **Automatic Token Refresh:** Automatically detects token expiration and transparently refreshes Google credentials before sync operations.
- **Multi-Account & Reconnect Support:** Support for connecting multiple accounts and clean reconnection of previously disconnected accounts.
- **Token Revocation & Disconnect:** Full OAuth token revocation directly with Google's authorization servers on account disconnect.

### Gmail Synchronization Engine
- **Background Task Execution:** Asynchronous job execution via Celery workers with Redis message broker.
- **Initial Sync:** Full mailbox traversal with batching, auto-paging, and duplicate-safe PostgreSQL upsert (`ON CONFLICT DO UPDATE`).
- **Incremental Delta Sync:** Uses the Gmail History API (`historyId`) to sync only delta changes (new incoming emails, read/unread status updates, starred items, and deletions) without re-downloading entire mailboxes.
- **Automatic Delta Fallback:** Graceful fallback to initial sync if the stored Gmail `historyId` has expired (HTTP 404).
- **Rate-Limit Resilience:** Built-in exponential backoff (15s, 30s, 60s) and throttling between API calls to prevent Google quota exhaustion (HTTP 429/403).
- **Cooperative Cancellation:** Sync jobs check cancellation flags periodically every 25 records to stop immediately upon user request without corrupting database state.
- **Job Progress Tracking:** Real-time sync job status (`queued`, `running`, `completed`, `failed`, `cancelled`) with record counters (`processed`, `created`, `updated`).

### Email Management & API
- **List & Filter Endpoints:** Paginated email listing with filters for account/integration, read status (`is_read`), and starred status (`is_starred`).
- **Full-Text Search:** Case-insensitive search across sender, subject, and email snippets.
- **Email Detail View:** Complete email retrieval including body text, sanitized HTML, sender/recipient metadata, labels, and attachment details.
- **Flag Updates:** Inline toggle endpoints for starring/unstarring and marking emails as read/unread.

### Database & Architecture
- **Layered Architecture:** Strict separation between API routes, service orchestration, provider adapters, and database repositories.
- **Provider & Registry Pattern:** Abstract `IntegrationProvider` interface and central `ProviderRegistry` enabling extensible addition of new cloud services (e.g., Slack, Notion, GitHub).
- **Schema Migrations:** Managed schema versions using Alembic and modern SQLAlchemy 2.0 declarative models.

---

## Frontend Features (React + Vite + TypeScript)

### Dashboard & Analytics
- Live sync status overview and quick stats (total emails synced, connected accounts, unread count).
- Recent emails preview with smart timestamps.

### Integrations Hub
- One-click Google account connection with OAuth redirect handling.
- Account status badges (Connected / Disconnected / Error).
- Account disconnect and reconnect workflows with confirmation dialogs.

### Email Inbox & Reader
- **Multi-Account Selector:** Dedicated account dropdown with individual message counts and global view.
- **Contextual Sync Actions:** Scoped "Sync Now" and "Cancel" buttons that appear when an individual account is selected.
- **Filter Tabs:** Instant switching between "All", "Unread" (with live count badge), and "Starred" emails.
- **Instant Search:** Debounced real-time keyword search across subject, snippet, and sender.
- **Slide-Over Detail Drawer:** Read full email conversations with sender details, recipient chips, CC/BCC breakdowns, and attachment cards.
- **Sandboxed HTML Iframe:** Safe, isolated HTML email rendering with automatic theme-matching (light/dark mode) and sanitized styling.
- **Keyboard Shortcuts:** Fast list navigation (`j`/`k`), open (`Enter`), search focus (`/`), and help dialog (`?`).
- **Live Sync Polling:** Automatic polling updates email lists and counts in real time while background sync jobs are running.