# How to Run the System Locally (Windows)

This guide explains how to start the Adroit Integrated Management Platform on your local Windows machine without using Docker.

## Prerequisites
1. **Node.js** (v20 or higher) must be installed.
2. **PostgreSQL** must be installed and running locally on port `5432`.

## 1. Environment Configuration
Ensure you have a `.env` file in the root directory (you can copy `.env.example` if needed). It must contain your local database credentials and an initial admin account:

```env
# Database connection
POSTGRES_DB=adroit
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/adroit

# Admin Credentials
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=Admin123
```

## 2. Install Dependencies
Open PowerShell or your terminal in the root folder and run:
```powershell
npm install
```

## 3. Start the Backend Server
In the same terminal (or a new tab), start the backend API:
```powershell
npm run dev:server
```
*The server will apply any missing database migrations and start on `http://127.0.0.1:3000`.*

## 4. Start the Frontend Web App
Open a new terminal tab in the root folder and start the React frontend:
```powershell
npm run dev:web
```
*Vite will start the frontend on `http://localhost:5173`.*

## 5. Access the System
1. Open your web browser and go to **[http://localhost:5173](http://localhost:5173)**.
2. Log in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you configured in the `.env` file (e.g., `admin@gmail.com` / `Admin123`).
