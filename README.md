# Paperless Milk Delivery System

A complete web-based application for managing milk delivery, customers, and billing.

## Features
- **Admin Dashboard**: Overview of daily deliveries and total customers.
- **Customer Management**: Add/Edit customers with default milk quantities.
- **Daily Log**: View daily deliveries, set one-time overrides (extra/less milk).
- **Billing**: Automatic monthly bill generation based on default quantities and overrides.
- **WhatsApp Integration**: Sends mock notifications for bills and changes.

## Tech Stack
- **Frontend**: React (Vite) + Modern CSS (Dark Theme)
- **Backend**: Node.js (Express) + SQLite
- **Database**: `server/milk_delivery.db` (Auto-created)

## Installation
1. Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. Run the application:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:5000`

## Login
- **Username**: `admin`
- **Password**: `admin123`

## Usage
1. **Set Price**: Go to Settings and set the milk price per liter (e.g., 60).
2. **Add Customers**: Go to Customers tab.
3. **Daily Operations**: Use "Daily Log" to check deliveries and add overrides for specific days.
4. **Billing**: Go to Billing tab at month-end to generate reports.
