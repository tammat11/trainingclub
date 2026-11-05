# Training Club — technical guide

## Stack

- React + Vite, single-page site.
- `phosphor-react` for UI icons.
- Main UI: `src/main.jsx`; styles and responsive rules: `src/style.css`.
- Visual assets: `public/hero-running-club.png`, `public/group-warmup.png`, `public/individual-training.png`, `public/coach-aruzhan-editorial.png`, and `public/coach-yana-bobrovskaya.jpg`.

## Run

```bash
npm install
npm run dev
npm run build
```

## Behavior

- Anchor navigation scrolls to page sections.
- All primary signup buttons open the same lead form.
- The signup form collects name, phone, age, preferred time, and optional trainer.
- `/api/lead` is a server-side function that sends validated applications to Telegram. The success state appears only after Telegram confirms delivery.
- Mobile navigation opens from the menu button below 850 px.
- Trainer content and weekly schedule are data arrays at the top of `src/main.jsx`.

## Integration note

Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the hosting provider's server-side environment. Do not prefix them with `VITE_` or put them in Git. The bot must be started by the recipient or added to the destination group before it can send messages. Vite's plain `npm run dev` serves only the frontend; use a serverless-aware local runtime to exercise `/api/lead` end to end.

## Club elections (`/vybory/`)

Temporary page for electing the club president and officers. Separate Vite entry: `vybory/index.html` → `src/election.jsx`, `src/election.css`.

- Schedule (Almaty, UTC+5) is in `SCHEDULE` in `api/_election.js`: nominations Mon 2 Nov – Wed 4 Nov 20:00, voting until Sat 7 Nov 23:59, then closed. The admin can override the phase.
- Only phones from the resident list can nominate or vote. Phones are matched by their last 10 digits.
- Nomination: full name, phone, position (president or officer), tenure, step-by-step plan. One nomination per phone per position. Tenure is shown on the card; it does not limit who is on the ballot.
- Voting: one ballot per phone per position, no re-voting. President is single-choice; officers are multi-choice (each picked officer gets one vote). Live results are public during voting.
- Admin panel: `/vybory/?admin` with `ELECTION_ADMIN_KEY`. Add resident phones, hide or restore candidates, switch the phase manually.
- Storage: Upstash Redis (Vercel Marketplace). Keys use the `tc-election:` prefix. Resident phones live only in Redis, never in Git.
- `npm run dev` serves the election API with an in-memory store and admin key `dev`.
