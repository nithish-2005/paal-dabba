# How to Deploy Paal Dabba to Cloudflare Pages and Render

Since your application has a Frontend (React) and a Backend (Node.js + SQLite), you need to deploy them separately. Cloudflare Pages is perfect for the frontend, but it cannot run the SQLite database directly. We will use **Render** (free tier) for the backend.

## Part 1: Deploy Backend (Render)

1.  **Push your code to GitHub** (if you haven't already).
2.  Go to [Render.com](https://render.com) and create an account.
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Configure the service**:
    *   **Name**: `paal-dabba-api` (or similar)
    *   **Root Directory**: `.` (leave strictly empty or `.`)
    *   **Environment**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server/index.js`
    *   **Free Plan**: Select "Free".
6.  **Environment Variables** (Add these):
    *   `PORT`: `10000` (or leave default, Render sets this automatically)
    *   `NODE_ENV`: `production`
7.  Click **Create Web Service**.
8.  **Wait for deployment**. Once live, copy the **URL** (e.g., `https://paal-dabba-api.onrender.com`).

**Note about Database**: On Render's free tier, the SQLite database file will be reset every time the server restarts (which happens on new deployments or inactivity). For a permanent database, you should use Render's Disk feature (paid) or switch to a hosted database like PostgreSQL (Render offers a free Postgres too).

## Part 2: Deploy Frontend (Cloudflare Pages)

1.  Go to [Cloudflare Dashboard](https://dash.cloudflare.com).
2.  Navigate to **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**.
3.  Select your GitHub repository.
4.  **Configure the build**:
    *   **Project Name**: `paal-dabba`
    *   **Framework Preset**: `Vite`
    *   **Root User**: `client` (This is important! Tell Cloudflare the frontend is in the `client` folder)
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
5.  **Environment Variables** (Add one):
    *   **Variable Name**: `VITE_API_URL`
    *   **Value**: The Render Backend URL from Part 1, followed by `/api` (e.g., `https://paal-dabba-api.onrender.com/api`).
6.  Click **Save and Deploy**.

## Part 3: Final Checks

1.  Open your Cloudflare Pages URL (e.g., `https://paal-dabba.pages.dev`).
2.  The app should load and fetch data from your Render backend.
