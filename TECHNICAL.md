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
- A valid local submission shows a success state; no backend is connected yet.
- Mobile navigation opens from the menu button below 850 px.
- Trainer content and weekly schedule are data arrays at the top of `src/main.jsx`.

## Integration note

To send leads to a CRM, replace the local `submit` handler in `src/main.jsx` with an API request and keep the current success state only after a confirmed response. The destination for applications still needs to be selected (CRM, email, Telegram bot, or another endpoint).
