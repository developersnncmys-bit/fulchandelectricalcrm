# Fulchand Electrical — Billing & Receivables Management System

Cloud-ready, mobile-responsive web app for **Fulchand and Sons Electrical**. It digitalises the billing process end to end: site work recording, then PO, then bill, then payment, then outstanding.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · MongoDB (Mongoose, GridFS for files) · JWT cookie auth · jsPDF (invoice PDFs) · ExcelJS (Excel import/export) · Recharts

## Getting started

```bash
npm install
cp .env.example .env.local      # set MONGODB_URI and JWT_SECRET
npm run seed -- --reset         # sample data + 5 users (wipes the DB!)
npm run dev                     # http://localhost:3456
```

`npm run seed` without `--reset` adds only the default users and settings, if they are missing.

### Default logins (password `Fulchand@123`)

| Role | Email |
|---|---|
| Admin | admin@fulchand.in |
| Management | management@fulchand.in |
| Accounts Team | accounts@fulchand.in |
| Site Engineer | engineer@fulchand.in |
| Site Supervisor | supervisor@fulchand.in |

> Change these passwords (Users & Roles) before going live.

## Workflow

1. **Site Work & Material** (`/work-entries`): the supervisor enters work done and material used, or imports the site Excel sheet. A template is downloadable from the import dialog.
2. **Site Engineer validation**: the engineer validates or rejects with a reason. Imported sheets that were already validated offline can come in as *validated*.
3. **PO creation** (`/purchase-orders/new`): pick validated entries for a site. Items are aggregated into PO lines, then accounts enters rates, HSN and GST.
4. **PO approval tracking**: Draft → Sent to client → Approved (client PO no. and approval ref.) or Rejected. Upload the signed PO copy on the PO page.
5. **Automated bill** (`/invoices/new`): generated from an approved PO. Partial running (RA) bills are supported, and billed and balance quantities are tracked per PO line so over-billing is blocked.
   - CGST + SGST is used when the client's state matches the company's state, otherwise IGST. The total is rounded to the nearest rupee.
   - The invoice number is assigned on **Issue** using the configurable format (e.g. `FE/2026-27/0001`, reset each FY).
   - A professional PDF includes amount in words, bank details and terms.
6. **Submission**: marking a bill submitted sets the due date (submission date + client credit days).
7. **Payments**: record full or partial receipts with TDS and other deductions. Outstanding and paid status update automatically.
8. **Dashboard & MIS**: KPIs, monthly billing vs collections, ageing, client- and site-wise summary, top overdue bills.
9. **Reports** (`/reports`): client-wise, site-wise, PO register, invoice register (GST break-up), payments, outstanding with ageing. Every table exports to **Excel / PDF**.
10. **Documents** (`/documents`): central repository (MongoDB GridFS) for POs, bills, measurement sheets and photos, linked to records.

## Roles

Permissions are defined in `src/lib/roles.ts` and enforced on every API route through `handler(permission, …)` in `src/lib/api.ts`. Site Engineers and Supervisors see only the sites they are assigned to (Sites → Assigned team).

## Project structure

```
src/
  app/(app)/…        authenticated pages (dashboard, work-entries, purchase-orders, invoices, …)
  app/api/…          REST API route handlers
  app/login          sign-in
  components/        UI kit, shell/sidebar, forms, data table with export
  lib/               auth (jwt/session), db, gst, numbering, reports, services, export, invoice-pdf
  models/index.ts    Mongoose models
scripts/seed.mjs     seed data
scripts/smoke.mjs    end-to-end API workflow test: npm run smoke -- http://localhost:3456
```

## Deploying to the cloud

- **Database:** create a MongoDB Atlas cluster and set `MONGODB_URI`.
- **App:** deploy on Vercel, Render or any Node host. Set `MONGODB_URI` and a long random `JWT_SECRET`.
- Run `npm run seed` once against the production DB to create the admin user. Then change its password.
