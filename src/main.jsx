import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ArrowUpRight from "phosphor-react/dist/icons/ArrowUpRight.esm.js";
import Check from "phosphor-react/dist/icons/Check.esm.js";
import CaretDown from "phosphor-react/dist/icons/CaretDown.esm.js";
import List from "phosphor-react/dist/icons/List.esm.js";
import X from "phosphor-react/dist/icons/X.esm.js";
import InstagramLogo from "phosphor-react/dist/icons/InstagramLogo.esm.js";
import TelegramLogo from "phosphor-react/dist/icons/TelegramLogo.esm.js";
import WhatsappLogo from "phosphor-react/dist/icons/WhatsappLogo.esm.js";
import "./style.css";

const benefits = [
  [
    "01",
    "Подходит каждому",
    "Группы для начинающих и опытных бегунов — тренер адаптирует нагрузку под ваш уровень.",
  ],
  [
    "02",
    "Профессиональные тренеры",
    "Профессионалы по лёгкой атлетике помогают прогрессировать безопасно и уверенно.",
  ],
  [
    "03",
    "Сильное окружение",
    "Тренировки, забеги и новые знакомства с людьми, которые разделяют ваши цели.",
  ],
  [
    "04",
    "В центре города",
    "Занимаемся на запасном поле Центрального стадиона — удобно добираться утром.",
  ],
];
const schedule = [
  { day: "ПН", sessions: [] },
  {
    day: "ВТ",
    sessions: [
      ["06:30 — 07:30", "Групповая тренировка", "Аружан"],
      ["19:00 — 20:00", "Групповая тренировка", "Аружан"],
      ["19:00 — 20:00", "Групповая тренировка", "Яна"],
    ],
  },
  { day: "СР", sessions: [] },
  {
    day: "ЧТ",
    sessions: [
      ["06:30 — 07:30", "Групповая тренировка", "Аружан"],
      ["19:00 — 20:00", "Групповая тренировка", "Аружан"],
      ["19:00 — 20:00", "Групповая тренировка", "Яна"],
    ],
  },
  { day: "ПТ", sessions: [] },
  { day: "СБ", sessions: [] },
  { day: "ВС", sessions: [["08:00 — 09:30", "Открытая тренировка", ""]] },
];

const coaches = [
  {
    name: "Аружан Рахимберлина",
    image: "/coach-aruzhan-editorial.png",
    achievements: [
      "15 лет в беге",
      "10-кратная чемпионка РК",
      "17-кратная призёрка РК",
      "Призёрка Азии",
      "Победы на международных и любительских стартах",
    ],
    quote: "Лучше сделать и пожалеть, чем жалеть, что не сделал",
  },
  {
    name: "Яна Бобровская",
    image: "/group-warmup.png",
    achievements: [
      "12 лет в спорте",
      "Чемпионка и призёрка Казахстана",
      "Кандидат в мастера спорта по лёгкой атлетике и скайраннингу",
      "Мастер спорта по пауэрлифтингу",
      "Магистр физической культуры и спорта",
    ],
    quote:
      "Спорт и дисциплина закаляют твой дух. А сильный дух помогает принимать самые важные решения в твоей жизни",
  },
  {
    name: "Максим Фроловский",
    image: "/individual-training.png",
    achievements: [
      "Мастер спорта РК",
      "3 национальных рекорда U23 на дистанциях 1500–3000 м",
      "Национальный рекорд на 10 км",
      "26-кратный чемпион РК",
      "Бронзовый призёр чемпионата Азии 2024",
    ],
    quote: "Тот, у кого есть зачем жить, может вынести почти что угодно",
  },
];
function App() {
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState({ name: "", age: "", time: "", coach: "" });
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone, website: e.currentTarget.elements.website.value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отправить заявку");
      setDone(true);
    } catch (error) {
      setSubmitError(error.message || "Не удалось отправить заявку. Попробуйте позже");
    } finally {
      setSending(false);
    }
  };
  return (
    <main>
      <header>
        <a className="logo" href="#top">
          TRAINING CLUB
        </a>
        <nav className={menu ? "show" : ""}>
          <a href="#about">О клубе</a>
          <a href="#schedule">Расписание</a>
          <a href="#pricing">Членство</a>
          <a href="#coach">Тренеры</a>
          <a href="#contact">Контакты</a>
        </nav>
        <button className="join mini" onClick={() => setOpen(true)}>
          Вступить в клуб <ArrowUpRight />
        </button>
        <button className="burger" onClick={() => setMenu(!menu)}>
          {menu ? <X /> : <List />}
        </button>
      </header>
      <section className="hero" id="top">
        <img src="/hero-running-club.png" />
        <div className="heroShade"></div>
        <div className="heroCopy">
          <p className="eyebrow">БЕГОВОЙ КЛУБ · АЛМАТЫ · АСТАНА · ШЫМКЕНТ</p>
          <h1>
            Сильные тела
            <br />
            <i>— Крепкие связи</i>
          </h1>
          <p className="lead">
            Тренировки с профессиональными тренерами в сильном комьюнити.
          </p>
          <button className="join" onClick={() => setOpen(true)}>
            Начать бегать <ArrowUpRight />
          </button>
        </div>
        <div className="heroStat">
          <b>06:30</b>
          <span>старт утренних тренировок</span>
        </div>
      </section>
      <section className="ticker">
        <div className="tickerTrack">
          {[0, 1, 2, 3].map((group) => (
            <span
              className="tickerGroup"
              aria-hidden={group ? "true" : undefined}
              key={group}
            >
              <b>RUN TOGETHER</b><i>·</i>
              <b>GROW STRONGER</b><i>·</i>
              <b>ALMATY RUNNING COMMUNITY</b><i>·</i>
            </span>
          ))}
        </div>
      </section>
      <section className="intro" id="about">
        <div>
          <p className="eyebrow red">TRAINING CLUB</p>
          <h2>
            Больше, чем
            <br />
            просто бег.
          </h2>
        </div>
        <div className="introText">
          <p>
            Мы помогаем достигать спортивных результатов, улучшать здоровье и
            находить своих людей.
          </p>
          <p>
            Открытые утренние тренировки, специализированные группы и программы
            под ваш уровень подготовки.
          </p>
          <a href="#schedule">
            Посмотреть расписание <CaretDown />
          </a>
        </div>
      </section>
      <section className="mosaic">
        <div className="photo p1"></div>
        <div className="redcard">
          <span>01</span>
          <h3>
            Открытые
            <br />
            тренировки
          </h3>
          <p>Можно начать уже завтра.</p>
        </div>
        <div className="redcard dark">
          <span>02</span>
          <h3>
            Индивидуальный
            <br />
            подход
          </h3>
          <p>Двигаемся в вашем темпе.</p>
        </div>
        <div className="photo p2"></div>
      </section>
      <section className="benefits">
        <div className="sectionHead">
          <p className="eyebrow">ПОЧЕМУ МЫ</p>
          <h2>
            Тренируйтесь
            <br />
            <i>с комфортом.</i>
          </h2>
        </div>
        <div className="benefitGrid">
          {benefits.map((x) => (
            <article key={x[0]}>
              <span>{x[0]}</span>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="schedule" id="schedule">
        <div className="sectionHead light">
          <p className="eyebrow red">РИТМ НЕДЕЛИ</p>
          <h2>
            Расписание
            <br />
            тренировок
          </h2>
          <p>Запасное поле Центрального стадиона</p>
        </div>
        <div className="days">
          {schedule.map((item) => (
            <div className={item.sessions.length ? "active" : ""} key={item.day}>
              <b>{item.day}</b>
              {item.sessions.length ? (
                <div className="sessionList">
                  {item.sessions.map((session, index) => (
                    <div className="session" key={`${item.day}-${index}`}>
                      <strong>{session[0]}</strong>
                      <span>{session[1]}</span>
                      {session[2] && <em>Тренер {session[2]}</em>}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="emptyDay">—</span>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="team" id="coach">
        <div className="teamHeading">
          <p className="eyebrow red">КОМАНДА</p>
          <h2>Тренеры,<br /><i>которые ведут вперёд.</i></h2>
        </div>
        <div className="coachGrid">
          {coaches.map((coach, index) => (
            <article className="coachCard" key={coach.name}>
              <div className="coachImage" style={{ backgroundImage: `url(${coach.image})` }}>
                <span>0{index + 1}</span>
              </div>
              <div className="coachDetails">
                <h3>{coach.name}</h3>
                <ul>{coach.achievements.map((item) => <li key={item}>{item}</li>)}</ul>
                <blockquote>«{coach.quote}»</blockquote>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="pricing" id="pricing">
        <div className="sectionHead">
          <p className="eyebrow">ЧЛЕНСТВО</p>
          <h2>
            Выберите
            <br />
            <i>свой темп.</i>
          </h2>
        </div>
        <div className="priceCards">
          <article>
            <p>НАЧИНАЮЩИЕ</p>
            <h3>32 000 ₸</h3>
            <span>в месяц · тренировка 60 минут</span>
            <ul>
              <li>
                <Check />
                Постановка техники
              </li>
              <li>
                <Check />
                Комфортный старт
              </li>
              <li>
                <Check />
                Групповая поддержка
              </li>
            </ul>
            <button onClick={() => setOpen(true)}>
              Присоединиться <ArrowUpRight />
            </button>
          </article>
          <article className="featured">
            <p>ПРОДВИНУТЫЕ</p>
            <h3>42 000 ₸</h3>
            <span>в месяц · тренировка 90 минут</span>
            <ul>
              <li>
                <Check />
                Работа на результат
              </li>
              <li>
                <Check />
                Персональная нагрузка
              </li>
              <li>
                <Check />
                Подготовка к стартам
              </li>
            </ul>
            <button onClick={() => setOpen(true)}>
              Присоединиться <ArrowUpRight />
            </button>
          </article>
        </div>
      </section>
      <section className="cta" id="contact">
        <p className="eyebrow">ПЕРВАЯ ТРЕНИРОВКА</p>
        <h2>
          Начните
          <br />
          <i>сейчас.</i>
        </h2>
        <button className="join pale" onClick={() => setOpen(true)}>
          Записаться на первую тренировку <ArrowUpRight />
        </button>
      </section>
      <footer>
        <a className="logo" href="#top">
          TRAINING CLUB
        </a>
        <div>
          <p>Алматы · Астана · Шымкент</p>
          <a href="tel:+77075837707">+7 707 583 77 07</a>
          <a href="https://instagram.com/trainingclub.kz">@trainingclub.kz</a>
        </div>
        <div className="social">
          <a aria-label="Instagram">
            <InstagramLogo />
          </a>
          <a aria-label="WhatsApp">
            <WhatsappLogo />
          </a>
          <a aria-label="Telegram">
            <TelegramLogo />
          </a>
        </div>
        <p>© 2026 Training Club</p>
      </footer>
      {open && (
        <div className="modal" onMouseDown={() => setOpen(false)}>
          <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close"
              onClick={() => setOpen(false)}
            >
              <X />
            </button>
            {done ? (
              <div className="success">
                <Check />
                <h3>Вы в команде!</h3>
                <p>Мы свяжемся с вами и расскажем о ближайшей тренировке.</p>
              </div>
            ) : (
              <>
                <p className="eyebrow red">ПРИСОЕДИНИТЬСЯ</p>
                <h3>
                  Ваша первая
                  <br />
                  тренировка
                </h3>
                <p>Оставьте номер — подберём подходящую группу.</p>
                <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ФИО" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                />
                <div className="formRow">
                  <input required value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Возраст" inputMode="numeric" />
                  <select required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
                    <option value="">Удобное время</option><option>Утро</option><option>Вечер</option>
                  </select>
                </div>
                <select value={form.coach} onChange={(e) => setForm({ ...form, coach: e.target.value })}>
                  <option value="">Без указания тренера</option><option>Аружан Рахимберлина</option><option>Яна Бобровская</option><option>Максим Фроловский</option>
                </select>
                {submitError && <p className="formError" role="alert">{submitError}</p>}
                <button className="join" disabled={sending}>
                  {sending ? "Отправляем…" : "Записаться"} <ArrowUpRight />
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
