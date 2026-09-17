# Training Club — technical guide

## Stack

- React + Vite, single-page site.
- `phosphor-react` for UI icons.
- Main UI: `src/main.jsx`; styles and responsive rules: `src/style.css`.
- Visual assets: `public/hero-running-club.png`, `public/group-warmup.png`, `public/individual-training.png`, and `public/coach-aruzhan-editorial.png`.

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
