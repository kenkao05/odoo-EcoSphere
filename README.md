# EcoSphere — ESG Management Platform

**Odoo Hackathon 2026 submission**

🔗 **Live demo:** [odoo-ecosphere-nu.vercel.app/login](https://odoo-ecosphere-nu.vercel.app/login)
🔗 **Repository:** [github.com/kenkao05/odoo-EcoSphere](https://github.com/kenkao05/odoo-EcoSphere/)

Demo accounts:
| Role | Email | Password |
|---|---|---|
| Admin | `admin@ecosphere.demo` | `admin1234` |
| Employee | `employee@ecosphere.demo` | `employee1234` |

---

## The problem

Environmental, Social and Governance (ESG) tracking has become a critical part of how organizations are expected to operate — but most ERP systems collect operational data without connecting it to sustainability, employee well-being, or compliance in any structured way. ESG reporting ends up manual, disconnected, and impossible to monitor in real time.

**EcoSphere** integrates ESG directly into day-to-day operations: it measures sustainability metrics, drives employee participation through gamification, and rolls everything up into a single dashboard and reporting layer for management — across all three ESG pillars plus a gamification layer to drive adoption.

## Core modules

**Environmental** — Carbon accounting, configurable emission factors, sustainability goals, department-level carbon tracking, and an environmental dashboard.

**Social** — CSR activities with employee participation and proof-of-completion, diversity metrics (aggregate-only, with a suppression threshold below 5 employees to protect re-identification), and a Kudos peer-recognition feed.

**Governance** — ESG policies with employee acknowledgement tracking, audits, and compliance issue management with mandatory Owner + Due Date fields and automatic overdue flagging.

**Gamification** — Challenges with a full lifecycle (Draft → Active → Under Review → Completed, or Archived at any point), XP, auto-awarded badges, a redeemable rewards catalog, and department/global leaderboards.

**Settings & Administration** — Department and category management, configurable ESG score weighting (default 40% Environmental / 30% Social / 30% Governance, must sum to 100), and notification preferences.

**Reports** — Environmental, Social, Governance, and ESG Summary reports, plus a custom report builder with filters (department, date range, module) exportable to CSV/Excel.

## How scores roll up

```
Master Configuration (Departments, Categories, Emission Factors, Goals, Policies, Challenges)
        ↓
Daily operations (Carbon Transactions, CSR/Challenge Participation, Policy Acks, Audits)
        ↓
Environmental Score · Social Score · Governance Score  (per department)
        ↓
Department Total Score
        ↓
Overall ESG Score = weighted average across departments (configurable weighting)
        ↓
Organization Dashboard & Reports
```

Scoring is recalculated at the application layer whenever relevant data changes (a goal updates, a transaction logs, a challenge is approved) — not via database triggers. Functionally equivalent, easier to debug with a small team.

## Tech stack

- **Frontend:** React 18 (Vite) + Tailwind CSS + Recharts + Zod + Socket.io-client
- **Backend:** Node.js + Express (hand-written routes) + Socket.io (realtime notifications) + Multer (evidence file uploads)
- **Database:** PostgreSQL + Drizzle ORM + Drizzle Kit
- **Auth:** JWT + bcrypt, two roles (`admin`, `employee`)
- **Hosting:** Frontend on Vercel, backend + Postgres on Railway (a long-lived process is required for Socket.io, which rules out serverless hosting for the API)

## Honest scope notes

This build does not run inside Odoo — no Odoo instance exists anywhere in the stack. Every "via Odoo [module]" feature from the original brief was either rebuilt as a standalone equivalent or explicitly cut. In the interest of not overclaiming what's demoed:

- **Auto Emission Calculation** computes `quantity × emission factor` server-side, but from a manually entered Carbon Transaction — there are no separate Purchase/Manufacturing/Fleet/Expense ERP modules in this build for it to pull from automatically. The math is real and automatic; the data entry is not.
- **Training Completion** (named in the original brief's Social bullet list) is not built — there's no LMS or training data source anywhere in this schema.
- **PDF export** in the Custom Report Builder is not implemented. CSV and Excel export are.
- Evidence files for CSR/Challenge proof are stored on local disk on Railway, which is ephemeral — a redeploy wipes them. Fine for a demo, not durable storage.
- The compliance overdue-check runs on a 6-hour interval with no deduplication — a still-open overdue issue will re-notify every cycle rather than once.

Two data models (Emission Factor, Product ESG Profile) had no fields specified in the original brief; both were filled using external standards (GHG Protocol Scope 1/2/3 for the former) rather than invented arbitrarily.

## Local setup

**Backend**

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm run db:generate
npm run db:migrate
npm run seed            # creates demo accounts + starter data
npm run dev             # starts on :4000
```

**Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:4000/api" > .env
npm run dev              # starts on :5173
```

## Deployment

- **Backend → Railway:** connect the repo, root directory `/backend`, add a Postgres plugin, set `JWT_SECRET` and `FRONTEND_URL` (your deployed frontend's bare origin — no trailing path) as env vars.
- **Frontend → Vercel:** connect the repo, root directory `/frontend`, set `VITE_API_URL` to your Railway backend URL + `/api`.

## License

Built for Odoo Hackathon 2026. No license specified — add one if you intend this to be reused outside the hackathon.
