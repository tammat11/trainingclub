const json = (res, status, body) => res.status(status).json(body);

const clean = (value, limit) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Метод не поддерживается" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return json(res, 503, { error: "Приём заявок пока не настроен" });
  }

  const body = req.body || {};
  // Hidden field: browsers leave it empty, basic spam bots often fill it.
  if (body.website) return json(res, 200, { ok: true });

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const age = clean(body.age, 3);
  const time = clean(body.time, 30);
  const coach = clean(body.coach, 120);

  if (
    name.length < 2 ||
    !/^\+?[\d\s()\-]{10,22}$/.test(phone) ||
    !/^\d{1,3}$/.test(age) ||
    Number(age) < 12 ||
    Number(age) > 100 ||
    !["Утро", "Вечер"].includes(time) ||
    !["", "Аружан Рахимберлина", "Яна Бобровская", "Максим Фроловский"].includes(coach)
  ) {
    return json(res, 400, { error: "Проверьте данные заявки" });
  }

  const message = [
    "Новая заявка · Training Club",
    `ФИО: ${name}`,
    `Телефон: ${phone}`,
    `Возраст: ${age}`,
    `Удобное время: ${time}`,
    `Тренер: ${coach || "Не выбран"}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      return json(res, 502, { error: "Не удалось отправить заявку. Попробуйте позже" });
    }
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 502, { error: "Не удалось отправить заявку. Попробуйте позже" });
  }
}
