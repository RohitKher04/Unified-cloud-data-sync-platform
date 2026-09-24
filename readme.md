# Unified Cloud Data Sync Platform

## Run the development environment

Requirements: Docker Desktop with Docker Compose.

1. Copy `.env.example` to `.env`. Change `POSTGRES_PASSWORD` to a local development value.
2. From the repository root, start the services:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

3. Open the frontend at <http://localhost:5173> and the FastAPI docs at <http://localhost:8000/docs>.

The development override mounts the backend and frontend source folders into their containers for hot reload. PostgreSQL data is kept in the `postgres_data` Docker volume.

Stop the services with `Ctrl+C`, or run:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

To delete the local database volume and all its data, run `docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v`.
