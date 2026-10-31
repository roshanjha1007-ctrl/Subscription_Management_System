# Yash's Deliverables: Core Backend and Subscription Agent

**Project:** 5-Hour Multi-Agent Subscription MVP (Brightloop)  **Role:** Core backend (auth, products, plans, subscriptions) and Subscription Agent tools

---

## 0. Golden rule: do not break the code

` ~~Read this before writing a single line. Four people share ~~ `one repo, and one broken push blocks everyone.

1. **Pull before you start, rebase before you push.** Run `git pull --rebase origin main` first. Never force-push.
2. **Never push code that does not start.** Before every push, run the server and hit at least one route.
3. **Do not rename routes, fields or collections without telling the team.** Others depend on them. Announce any change immediately.
4. **Do not edit other people's files.** Roshan owns DB schemas and the orchestrator. Rohit owns invoice, payment and finance code. Yatharth owns the frontend. If you need a change in their area, ask them.
5. **Add, do not rewrite.** Prefer adding a new function or route over changing a working one.
6. **Small commits.** One working feature per commit, with a clear message such as `feat: add plan create/list API`.
7. **Never commit secrets.** Keep keys in `.env`. Commit only `.env.example`.
8. **Keep a working fallback.** If a new feature breaks things and you cannot fix it in 10 minutes, revert it (`git revert` or `git stash`) and push nothing broken.
9. **No new features after 04:15.** Stabilisation only.
10. **Test with real seeded data after 02:00.** No mock-only modules.

### Safe workflow for every task

```
  git pull --rebase origin main
            |
            v
   write ONE small feature
            |
            v
   start server, test the route (Postman / curl)
            |
      works? ---- no ----> fix it or revert it
            |
           yes
            v
   git add . && git commit -m "feat: ..."
            |
            v
   git pull --rebase origin main  (again, then re-test)
            |
            v
   git push origin main
            |
            v
   tell the team in chat if any route or field changed
```

---

## 1. What Yash owns

| # | Deliverable | Done when |
| --- | --- | --- |
| 1 | Basic authentication and roles | Register, login, token, role check all work |
| 2 | Products CRUD (with variants) | Create, list, view, update products |
| 3 | Plans CRUD | Create and list plans with billing period and flags |
| 4 | Subscription creation and lifecycle | Create, view, and move through valid statuses only |
| 5 | Subscription APIs | Clean list and detail endpoints, filtered by user role |
| 6 | Subscription Agent tools | Agent can fetch real subscription records |

**Hand-offs:**

```
  Roshan (DB + orchestrator)  --- schemas, DB connection ---> Yash
  Yash  --- subscription records, status ---> Rohit (invoices)
  Yash  --- APIs ---> Yatharth (frontend)
  Yash  --- Subscription Agent tools ---> Roshan (orchestrator registry)
```

---

## 2. Timeline for Yash

| Time | What Yash does |
| --- | --- |
| 00:00 to 00:30 | Agree on API routes, payloads, field names, env variable names. Get the project running locally. Create the backend skeleton. |
| 00:30 to 02:00 | Build auth, products, plans, subscriptions and the status lifecycle. Push runnable increments. |
| 02:00 to 03:30 | Build the Subscription Agent tools. Connect with Roshan's orchestrator and Yatharth's frontend. Verify data shapes. |
| 03:30 to 04:15 | Run the full demo path with real seeded data. Fix integration bugs. |
| 04:15 to 04:45 | Stabilise only. Test happy path and failure cases. Check role boundaries. |
| 04:45 to 05:00 | Rehearse the demo. Document run steps. |

---

## 3. Step 0: Setup and agreement (first 30 minutes)

**Steps**

1. Clone the repo and confirm it runs on your machine.
2. Create the backend folder structure (adjust names to match what the team agrees):

```
  backend/
    src/
      config/        (env, db connection - Roshan provides db)
      middleware/    (auth, role check, error handler)
      routes/        (auth, products, plans, subscriptions)
      controllers/   (request handling)
      services/      (business logic, e.g. status transitions)
      agents/tools/  (subscription agent tools)
    .env.example
```

3. Write down and share the **API contract** (routes, request body, response shape) with the team before coding.
4. Agree on **env variable names** (for example `MONGODB_URI`, `JWT_SECRET`, `PORT`) and commit them in `.env.example`.
5. Agree on **collection and field names** with Roshan. Do not invent your own.

**Do not break:** do not start coding routes until the contract is shared. Changing field names later breaks Rohit and Yatharth.

---

## 4. Deliverable 1: Authentication and roles

**Goal:** users can register and log in, and each request knows who the user is and what role they have.

**Roles:** `admin`, `staff`, `customer`.

**Endpoints**

| Method | Route | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Customer self sign-up | Public |
| POST | `/api/auth/login` | Returns token and user info | Public |
| GET | `/api/auth/me` | Current user | Logged in |
| POST | `/api/auth/staff` | Create staff member | Admin only |

**Steps**

1. Create the User model (or use Roshan's schema): name, email (unique), password hash, role, createdAt.
2. Add a **unique index on email**.
3. Validate the password: more than 8 characters, one uppercase, one lowercase, one special character. Example regex: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/`.
4. Hash passwords with bcrypt. Never store plain text.
5. On login, return a signed JWT containing user id and role.
6. Write an `authenticate` middleware that reads the token and attaches `req.user`.
7. Write a `requireRole(...roles)` middleware, for example `requireRole('admin')`.
8. Seed one admin, one staff and two customers for the demo.

**Do not break**

- Add the middleware as new files. Do not change how other people's routes are wired without telling them.
- Never return the password hash in any response.
- Keep the token format stable. Yatharth stores it and Roshan's orchestrator reads the user from it.

**Test checklist**

- Register with a weak password: rejected.
- Register with an existing email: rejected.
- Login with correct details: token returned.
- Customer calling the staff-create route: 403.

---

## 5. Deliverable 2: Products (with variants)

**Goal:** admin can create and list products. Variants change the price.

**Fields:** name, type, salesPrice, costPrice, notes, variants (for example `[{ attribute: 'brand', value: 'Odoo', extraPrice: 560 }]`).

**Endpoints**

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/products` | Admin |
| GET | `/api/products` | Logged in (with pagination) |
| GET | `/api/products/:id` | Logged in |
| PUT | `/api/products/:id` | Admin |

**Steps**

1. Create the product schema (with Roshan).
2. Build create, list, get and update.
3. Validate that prices are numbers and not negative.
4. Add pagination to the list route (`?page=1&limit=20`).
5. Write a small helper `getVariantPrice(product, variant)` that returns salesPrice plus extraPrice. Rohit will use the same helper for invoices, so tell him it exists.

**Do not break**

- Keep `salesPrice` as the field name. Invoice code reads it.
- Do not delete products that are used in subscriptions. Mark them inactive instead.

---

## 6. Deliverable 3: Plans

**Goal:** admin defines how a product is billed.

**Fields:** name, price, billingPeriod (`daily`, `weekly`, `monthly`, `yearly`), minQuantity, availableFrom, availableTo, and flags: `autoClose`, `closable`, `pausable`, `renewable`.

**Endpoints**

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/plans` | Admin |
| GET | `/api/plans` | Logged in |
| GET | `/api/plans/:id` | Logged in |
| PUT | `/api/plans/:id` | Admin |

**Steps**

1. Create the plan schema.
2. Validate that billingPeriod is one of the four allowed values.
3. Validate that `availableTo` is after `availableFrom`.
4. Build create, list, get and update.
5. Only show plans that are currently available when a subscription is being created.

**Do not break:** keep `billingPeriod` values exactly as listed. The scheduler or the "run billing" logic depends on them.

---

## 7. Deliverable 4: Subscriptions and status lifecycle

**Goal:** create a subscription and move it through valid statuses only.

**Fields:** subscriptionNumber (unique, auto-generated, for example `SUB-0001`), customerId, planId, startDate, expiryDate, paymentTerms, nextInvoiceDate, status, and lines (productId, variant, quantity, unitPrice, tax, amount).

**Status flow**

```
  Draft --> Quotation --> Confirmed --> Active --> Closed
```

Only forward moves are allowed. Closed is final.

**Endpoints**

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/subscriptions` | Admin, staff |
| GET | `/api/subscriptions` | Role-filtered |
| GET | `/api/subscriptions/:id` | Role-filtered |
| PATCH | `/api/subscriptions/:id/status` | Admin, staff |

**Steps**

1. Create the schema and a **unique index on subscriptionNumber**.
2. Auto-generate the number on create.
3. On create, calculate each line `amount = quantity x unitPrice` using the variant helper. Set the starting status to `Draft`.
4. Set `nextInvoiceDate` equal to `startDate` when the subscription becomes Active. Rohit uses this field.
5. Write a transition map in one place:

```
  const allowed = {
    Draft:      ['Quotation'],
    Quotation:  ['Confirmed'],
    Confirmed:  ['Active'],
    Active:     ['Closed'],
    Closed:     []
  };
```

6. In the status endpoint, reject any move not listed (return 400 with a clear message).
7. Add indexes on `status`, `customerId` and `nextInvoiceDate` for speed.
8. Pagination on the list route.

**Do not break**

- Keep the status values exactly as written, with the same capitalisation. Rohit and Yatharth compare against them.
- Keep `nextInvoiceDate`, `lines`, `customerId` and `status` as stable field names. Invoice generation reads them.
- Do not let the status endpoint skip steps.

**Test checklist**

- Draft straight to Active: rejected.
- Draft to Quotation to Confirmed to Active: works.
- Closed to anything: rejected.

---

## 8. Deliverable 5: Role-based access on subscription APIs

**Rules**

| Role | Sees |
| --- | --- |
| Admin | All subscriptions |
| Staff | All subscriptions (limited actions) |
| Customer | Only their own (`customerId === req.user.id`) |

**Steps**

1. In the list and detail controllers, if the role is `customer`, add `customerId: req.user.id` to the query.
2. On the detail route, a customer requesting someone else's subscription gets 403 or 404.
3. Enforce this in the backend, not just in the UI.

**Do not break:** apply the filter inside a shared function so the Subscription Agent tool reuses the same logic. Do not copy and paste it.

---

## 9. Deliverable 6: Subscription Agent tools

**Goal:** the AI Subscription Agent answers using real database records, never invented values.

```
  User question
       |
  Orchestrator (Roshan) picks Subscription Agent
       |
  Subscription Agent calls Yash's tool
       |
  Tool calls the same service layer as the REST API
       |
  MongoDB returns real records
```

**Tools to build**

| Tool name | Input | Output |
| --- | --- | --- |
| `list_subscriptions` | user context, optional status | List of subscriptions for that user |
| `get_subscription` | user context, subscription id or number | One subscription with lines and status |
| `update_subscription_status` (optional) | user context, id, new status | Updated record (needs confirmation) |

**Steps**

1. Reuse the existing service functions. Do not write separate database queries for the tools.
2. Every tool receives the **authorised user context** (id and role) from the orchestrator. Apply the same role filter as the REST API.
3. Return clean JSON with only the needed fields.
4. Register the tools with Roshan's agent registry using the format he defines.
5. For any write action (such as changing status), require explicit user confirmation and backend authorisation before it runs.
6. Test using three prompts: "Show my active subscriptions", "What is the status of SUB-0001?", "List all draft subscriptions" (admin).

**Do not break**

- Tools must call services, not edit the database directly.
- If a record is not found, return a clear "not found" result. Do not make the agent guess.
- Never let a customer's agent session see another customer's data.

---

## 10. Quick fixes that raise the score (do these if time allows)

These came from the plan review and are cheap:

1. Password validation (already in section 4).
2. Variant price add-on (already in section 5).
3. Plan flags: autoClose, closable, pausable, renewable (already in section 6).
4. Admin-only checks on plan create and staff create.
5. Indexes on status, customerId, nextInvoiceDate.
6. Pagination on all list routes (helps the under-2-seconds target).

---

## 11. Integration checkpoints

| Time | Check |
| --- | --- |
| 00:30 | Contract shared. Server starts. |
| 02:00 | Auth, products, plans, subscriptions all work in Postman. Pushed to main. |
| 03:30 | Frontend shows real subscriptions. Agent tool returns real data. |
| 04:15 | Full demo path passes with one test customer. |
| 04:45 | No new features. Bugs only. |

**What others need from Yash**

- **Rohit:** stable subscription fields (`lines`, `status`, `nextInvoiceDate`, `customerId`) and the variant price helper.
- **Yatharth:** working endpoints, a Postman collection or short API list, and the token format.
- **Roshan:** agent tool functions in the agreed registry format.

---

## 12. Final definition of done for Yash

- [ ] Server starts from a clean clone using `.env.example`.
- [ ] Register and login work, with password rules enforced.
- [ ] Admin, staff and customer roles are enforced on the backend.
- [ ] Admin can create and list products (with a variant price) and plans.
- [ ] A subscription can be created and moved Draft to Quotation to Confirmed to Active to Closed, and invalid jumps are rejected.
- [ ] A customer cannot see another customer's subscriptions.
- [ ] List routes are paginated and indexed.
- [ ] Subscription Agent tools return real records for at least three request types.
- [ ] Seed data exists so the demo needs no manual database edits.
- [ ] Everything is pushed to main and nothing is broken.

---

## 13. If something breaks

```
  Something broke
       |
  Did it work before your last change?
       |
   yes --> git stash or git revert your change, confirm it works again
       |
   no  --> check logs, check the route in Postman, check field names against the contract
       |
  Still stuck after 10 minutes?
       |
  Tell the team. Do not push a broken fix.
```

**Known limitations to mention during the demo:** no password reset email, no real scheduler, no quotation templates, simple tax only. Label them as next steps.
