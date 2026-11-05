import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./election.css";

const isAdmin = new URLSearchParams(location.search).has("admin");
const STAGES = [
  ["nomination", "Выдвижение"],
  ["voting", "Голосование"],
  ["closed", "Итоги"],
];

// Schedule times are fixed at UTC+5, so shift and format in UTC to avoid stale browser tz data.
const formatDate = (iso, offsetMs = 0) =>
  new Date(Date.parse(iso) + offsetMs + 5 * 3600e3).toLocaleString("ru-RU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

// "+7 (701) 234-56-78" while typing; the server accepts any format with 10 meaningful digits.
const formatPhone = (value) => {
  let digits = value.replace(/\D/g, "");
  // Drop the country code we rendered ourselves, or a pasted 8/7 prefix.
  if (value.trim().startsWith("+7")) digits = digits.slice(1);
  if (digits.length > 10 && /^[78]/.test(digits)) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  let out = `+7 (${parts[0]}`;
  if (digits.length > 3) out += `) ${parts[1]}`;
  if (digits.length > 6) out += `-${parts[2]}`;
  if (digits.length > 8) out += `-${parts[3]}`;
  return out;
};
const votesLabel = (n) => {
  const forms = ["голос", "голоса", "голосов"];
  const i = n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
  return `${n} ${forms[i]}`;
};
const phoneComplete = (value) => value.replace(/\D/g, "").length === 11;

function PhoneInput({ value, onChange }) {
  return (
    <input
      required
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      placeholder="+7 (7__) ___-__-__"
    />
  );
}

// Center-crops to 4:5 and downsizes so the upload stays well under the server limit.
const resizePhoto = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = 4 / 5;
      let sw = img.width;
      let sh = img.height;
      if (sw / sh > ratio) sw = sh * ratio;
      else sh = sw / ratio;
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 750;
      canvas.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, 600, 750);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Не удалось открыть фото. Выберите JPG или PNG"));
    img.src = URL.createObjectURL(file);
  });

const post = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отправить. Попробуйте позже");
  return result;
};

const storage = {
  get: (key) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

// Officers name their own role, e.g. "Офицер по мероприятиям".
const roleLabel = (c) => (c.position === "officer" ? c.officerRole || "Офицер" : "Президент");

const photoUrl = (c) => (c.photo ? `/api/election-photo?id=${c.id}` : "");
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function Avatar({ c, className = "" }) {
  return c.photo ? (
    <img className={className} src={photoUrl(c)} alt={c.name} loading="lazy" />
  ) : (
    <div className={`${className} noPhoto`}>{initials(c.name)}</div>
  );
}

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Date.parse(target) - now);
  return [86400e3, 3600e3, 60e3, 1e3].map((unit, i, all) =>
    Math.floor((i ? left % all[i - 1] : left) / unit),
  );
}

function Countdown({ target, label }) {
  const parts = useCountdown(target);
  return (
    <div className="countdown">
      <span className="countdownLabel">{label}</span>
      <div className="countdownGrid">
        {["дн", "ч", "мин", "сек"].map((unit, i) => (
          <div key={unit}>
            <b>{String(parts[i]).padStart(2, "0")}</b>
            <small>{unit}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ data }) {
  const { phase, schedule } = data;
  const copy = {
    before: ["Скоро старт", `Выдвижение начнётся ${formatDate(schedule.nominationStart)}.`],
    nomination: [
      "Идёт выдвижение",
      "Резиденты могут выдвинуть себя на пост президента или офицера и рассказать, как будут развивать клуб.",
    ],
    voting: ["Идёт голосование", "Один голос за президента, за офицеров — можно за нескольких. Голосовать можно один раз, результаты обновляются в реальном времени."],
    closed: ["Голосование завершено", "Итоги подведём в воскресенье. Спасибо всем, кто проголосовал!"],
  }[phase];
  const deadline = {
    before: [schedule.nominationStart, "До старта выдвижения"],
    nomination: [schedule.votingStart, "До конца выдвижения"],
    voting: [schedule.votingEnd, "До конца голосования"],
  }[phase];
  const stageIndex = STAGES.findIndex(([key]) => key === phase);

  return (
    <section className="hero">
      <img className="heroBg" src="/hero-running-club.png" alt="" />
      <div className="heroShade" />
      <header className="topbar">
        <a className="logo" href="/">
          <span>TC</span>TRAINING CLUB
        </a>
        <span className="pill live">
          <i />
          {copy[0]}
        </span>
      </header>
      <div className="heroBody">
        <p className="eyebrow">Выборы клуба · ноябрь 2026</p>
        <h1>
          Президент
          <br />и офицеры клуба
        </h1>
        <p className="lead">{copy[1]}</p>
        {deadline && <Countdown target={deadline[0]} label={deadline[1]} />}
        <ol className="stages">
          {STAGES.map(([key, title], i) => (
            <li key={key} className={i < stageIndex ? "done" : i === stageIndex ? "active" : ""}>
              <span>{title}</span>
              <small>
                {key === "nomination"
                  ? `до ${formatDate(schedule.votingStart)}`
                  : key === "voting"
                    ? `до ${formatDate(schedule.votingEnd, -60e3)}`
                    : "воскресенье"}
              </small>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PlanModal({ c, data, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={onClose}>
      <article className="modalCard" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <Avatar c={c} className="modalPhoto" />
        <div className="modalBody">
          <span className={`chip ${c.position}`}>{roleLabel(c)}</span>
          <h3>{c.name}</h3>
          <p className="meta">В клубе: {data.tenures[c.tenure].toLowerCase()}</p>
          <h4>План развития клуба</h4>
          <p className="plan">{c.plan}</p>
        </div>
      </article>
    </div>
  );
}

function CandidateCard({ c, data, selected, onSelect, onOpen }) {
  const selectable = Boolean(onSelect);
  return (
    <article
      className={`card ${c.eligible ? "" : "ineligible"} ${selected ? "selected" : ""} ${selectable ? "selectable" : ""}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="cardPhoto">
        <Avatar c={c} />
        {selectable && <span className={`check ${selected ? "on" : ""}`}>✓</span>}
        {!c.eligible && <span className="badge">Скрыт</span>}
      </div>
      <div className="cardBody">
        <span className={`chip ${c.position}`}>{roleLabel(c)}</span>
        <h3>{c.name}</h3>
        <p className="meta">В клубе {data.tenures[c.tenure].toLowerCase()}</p>
        <button
          type="button"
          className="link"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(c);
          }}
        >
          План развития →
        </button>
      </div>
    </article>
  );
}

function PositionTabs({ data, value, onChange, count }) {
  return (
    <div className="tabs" role="tablist">
      {[["all", "Все"], ...Object.entries(data.positions)].map(([key, title]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={value === key ? "on" : ""}
          onClick={() => onChange(key)}
        >
          {key === "officer" ? "Офицеры" : title}
          <span>{count(key)}</span>
        </button>
      ))}
    </div>
  );
}

function CandidateList({ data, onOpen }) {
  const [position, setPosition] = useState("all");
  const matches = (c, key) => key === "all" || c.position === key;
  const list = data.candidates.filter((c) => matches(c, position));
  return (
    <section className="block">
      <div className="blockHead">
        <h2>Кандидаты</h2>
        <PositionTabs
          data={data}
          value={position}
          onChange={setPosition}
          count={(key) => data.candidates.filter((c) => matches(c, key)).length}
        />
      </div>
      {list.length ? (
        <div className="grid">
          {list.map((c) => (
            <CandidateCard key={c.id} c={c} data={data} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="emptyState">Пока никто не выдвинулся — станьте первым</div>
      )}
    </section>
  );
}

function NominationForm({ data, onDone }) {
  const blank = { name: "", phone: "", position: "", officerRole: "", tenure: "", plan: "", photo: "" };
  const [form, setForm] = useState(blank);
  const [status, setStatus] = useState({ sending: false, error: "", done: false });
  const fileRef = useRef(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const pickPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setForm({ ...form, photo: await resizePhoto(file) });
      setStatus({ ...status, error: "" });
    } catch (error) {
      setStatus({ ...status, error: error.message });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.photo) return setStatus({ sending: false, error: "Прикрепите фото кандидата", done: false });
    if (!phoneComplete(form.phone)) return setStatus({ sending: false, error: "Введите номер полностью", done: false });
    setStatus({ sending: true, error: "", done: false });
    try {
      await post("/api/election", { action: "nominate", ...form, website: e.currentTarget.elements.website.value });
      setStatus({ sending: false, error: "", done: true });
      setForm(blank);
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (error) {
      setStatus({ sending: false, error: error.message, done: false });
    }
  };

  return (
    <form className="panel" id="nominate" onSubmit={submit}>
      <h2>Выдвинуть кандидатуру</h2>
      <p className="muted">Только для резидентов клуба. Номер телефона должен быть в списке резидентов.</p>
      <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />

      <label className="photoPick">
        {form.photo ? <img src={form.photo} alt="" /> : <span className="photoPlaceholder">+</span>}
        <span>
          <b>{form.photo ? "Заменить фото" : "Фото кандидата"}</b>
          <small>Портрет, лицо хорошо видно</small>
        </span>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} />
      </label>

      <label>
        ФИО
        <input required minLength="3" value={form.name} onChange={set("name")} placeholder="Фамилия Имя Отчество" />
      </label>
      <label>
        Телефон
        <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
      </label>
      <div className="field">
        <span>Должность</span>
        <div className="segmented">
          {Object.entries(data.positions).map(([key, title]) => (
            <button
              key={key}
              type="button"
              className={form.position === key ? "on" : ""}
              onClick={() => setForm({ ...form, position: key })}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      {form.position === "officer" && (
        <label>
          Тип офицера
          <input
            required
            minLength="2"
            maxLength="80"
            value={form.officerRole}
            onChange={set("officerRole")}
            placeholder="Например: офицер по мероприятиям"
          />
        </label>
      )}
      <label>
        Сколько вы в клубе
        <select required value={form.tenure} onChange={set("tenure")}>
          <option value="" disabled>
            Выберите
          </option>
          {Object.entries(data.tenures).map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Пошаговый план развития клуба
        <textarea
          required
          minLength="10"
          maxLength="2000"
          rows="6"
          value={form.plan}
          onChange={set("plan")}
          placeholder={"1. …\n2. …\n3. …"}
        />
        <small className="counter">{form.plan.length} / 2000</small>
      </label>
      {status.error && <p className="error" role="alert">{status.error}</p>}
      {status.done && <p className="success">Кандидатура принята и уже в списке</p>}
      <button className="primary" disabled={status.sending || !form.position}>
        {status.sending ? "Отправляем…" : "Выдвинуться"}
      </button>
    </form>
  );
}

function Ballot({ data, onDone, onOpen }) {
  const [choices, setChoices] = useState({});
  const [phone, setPhone] = useState("");
  const [voted, setVoted] = useState(() => storage.get("tc-election-voted"));
  const [status, setStatus] = useState({ sending: false, error: "" });
  const open = Object.keys(data.positions).filter((p) => !voted.includes(p));

  const submit = async (e) => {
    e.preventDefault();
    if (!phoneComplete(phone)) return setStatus({ sending: false, error: "Введите номер полностью" });
    setStatus({ sending: true, error: "" });
    try {
      const result = await post("/api/election", {
        action: "vote",
        phone,
        choices,
        website: e.currentTarget.elements.website.value,
      });
      const next = [...new Set([...voted, ...result.recorded, ...result.repeated])];
      storage.set("tc-election-voted", next);
      setVoted(next);
      setStatus({
        sending: false,
        error: result.repeated.length ? "По одной из должностей с этого номера уже голосовали" : "",
      });
      onDone();
    } catch (error) {
      setStatus({ sending: false, error: error.message });
    }
  };

  if (!open.length) {
    return (
      <section className="panel thanks">
        <span className="bigCheck">✓</span>
        <h2>Ваш голос учтён</h2>
        <p className="muted">Спасибо! Следите за ходом голосования ниже.</p>
      </section>
    );
  }

  return (
    <form className="block" onSubmit={submit}>
      <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
      {open.map((position) => {
        const list = data.candidates.filter((c) => c.position === position && c.eligible);
        return (
          <section key={position} className="ballotGroup">
            <div className="blockHead">
              <h2>{position === "officer" ? "Выберите офицеров" : "Выберите президента"}</h2>
              <span className="muted">{position === "officer" ? "Можно несколько" : "Один голос"}</span>
            </div>
            {list.length ? (
              <div className="grid">
                {list.map((c) => (
                  <CandidateCard
                    key={c.id}
                    c={c}
                    data={data}
                    onOpen={onOpen}
                    selected={position === "officer" ? (choices.officer || []).includes(c.id) : choices[position] === c.id}
                    onSelect={() =>
                      setChoices((prev) => {
                        if (position !== "officer") return { ...prev, [position]: c.id };
                        const current = prev.officer || [];
                        const officer = current.includes(c.id) ? current.filter((id) => id !== c.id) : [...current, c.id];
                        const { officer: _, ...rest } = prev;
                        return officer.length ? { ...rest, officer } : rest;
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="emptyState">Нет кандидатов</div>
            )}
          </section>
        );
      })}
      <div className="voteBar">
        <div className="voteBarInner">
          <div className="voteSummary">
            {open.map((p) => {
              const ids = [choices[p] || []].flat();
              const names = data.candidates.filter((x) => ids.includes(x.id)).map((x) => x.name);
              return (
                <span key={p}>
                  {p === "officer" ? "Офицеры" : data.positions[p]}: <b>{names.length ? names.join(", ") : "не выбран"}</b>
                </span>
              );
            })}
          </div>
          <PhoneInput value={phone} onChange={setPhone} />
          <button className="primary" disabled={status.sending || !Object.keys(choices).length}>
            {status.sending ? "Отправляем…" : "Проголосовать"}
          </button>
        </div>
        {status.error && <p className="error" role="alert">{status.error}</p>}
      </div>
    </form>
  );
}

function Results({ data, candidates = data.candidates, title = "Ход голосования" }) {
  return (
    <section className="block">
      <div className="blockHead">
        <h2>{title}</h2>
        <span className="pill live small">
          <i />
          онлайн
        </span>
      </div>
      <div className="resultsGrid">
        {Object.entries(data.positions).map(([position, label]) => {
          const { voters, counts } = data.results[position];
          const list = candidates
            .filter((c) => c.position === position && c.eligible)
            .map((c) => ({ ...c, votes: counts[c.id] || 0 }))
            // Officers are not competing for one seat, so they keep their order and no leader is marked.
            .sort((a, b) => (position === "officer" ? 0 : b.votes - a.votes));
          return (
            <div key={position} className="panel results">
              <div className="resultsHead">
                <h3>{position === "officer" ? "Офицеры" : label}</h3>
                <span className="muted">{votesLabel(voters)}</span>
              </div>
              {list.map((c, i) => {
                const share = voters ? (c.votes / voters) * 100 : 0;
                return (
                  <div key={c.id} className={`resultRow ${position !== "officer" && i === 0 && c.votes ? "leader" : ""}`}>
                    <Avatar c={c} className="resultAvatar" />
                    <div className="resultMain">
                      <div className="resultLabel">
                        <span>{c.name}</span>
                        <b>{votesLabel(c.votes)}</b>
                      </div>
                      <div className="track">
                        <div style={{ width: `${share}%` }} />
                      </div>
                      {c.position === "officer" && c.officerRole && <small>{c.officerRole}</small>}
                    </div>
                  </div>
                );
              })}
              {!list.length && <p className="muted">Нет кандидатов</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const PHASE_NAMES = {
  before: "ещё не началось",
  nomination: "выдвижение",
  voting: "голосование",
  closed: "завершено",
};
const POSITION_NAMES = { president: "Президент", officer: "Офицер" };

function Admin() {
  const [key, setKey] = useState(() => sessionStorage.getItem("tc-election-key") || "");
  const [data, setData] = useState(null);
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");

  const run = async (body) => {
    setMessage("");
    try {
      const result = await post("/api/election-admin", { key, ...body });
      sessionStorage.setItem("tc-election-key", key);
      setData(result);
      if (body.action === "residents") {
        setPhones("");
        setMessage(
          `Добавлено номеров: ${result.added}` +
            (result.invalid.length ? `. Не распознаны: ${result.invalid.join(", ")}` : ""),
        );
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main className="adminPage">
      <header className="topbar static">
        <a className="logo" href="/vybory/">
          <span>TC</span>TRAINING CLUB
        </a>
        <span className="pill">Админ-панель</span>
      </header>
      {!data ? (
        <form className="panel narrow" onSubmit={(e) => (e.preventDefault(), run({ action: "overview" }))}>
          <h2>Вход</h2>
          <label>
            Ключ администратора
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          {message && <p className="error">{message}</p>}
          <button className="primary">Войти</button>
        </form>
      ) : (
        <div className="adminGrid">
          <div className="panel">
            <h2>Этап: {PHASE_NAMES[data.phase]}</h2>
            <label>
              Переключение этапа
              <select value={data.override} onChange={(e) => run({ action: "phase", phase: e.target.value })}>
                <option value="auto">По расписанию</option>
                {Object.entries(PHASE_NAMES).map(([key, title]) => (
                  <option key={key} value={key}>
                    Вручную: {title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="panel">
            <h2>
              Резиденты <span className="muted">{data.residents}</span>
            </h2>
            <label>
              Телефоны — по одному в строке, любой формат. Добавляются к списку.
              <textarea
                rows="6"
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                placeholder={"+7 701 234 56 78\n87012345678"}
              />
            </label>
            <button className="primary" onClick={() => run({ action: "residents", phones })}>
              Добавить
            </button>
            {message && <p className="success">{message}</p>}
          </div>
          <div className="panel wide">
            <h2>Кандидаты</h2>
            {!data.candidates.length && <p className="muted">Пока никто не выдвинулся</p>}
            {data.candidates.map((c) => (
              <div key={c.id} className={`adminRow ${c.hidden ? "ineligible" : ""}`}>
                <Avatar c={c} className="resultAvatar" />
                <div className="resultMain">
                  <b>{c.name}</b>
                  <p className="meta">
                    {roleLabel(c)} · стаж {c.tenure} · {formatPhone(c.phone)}
                    {c.hidden && " · скрыт"}
                  </p>
                </div>
                <button className="link" onClick={() => run({ action: c.hidden ? "show" : "hide", id: c.id })}>
                  {c.hidden ? "Вернуть" : "Скрыть"}
                </button>
              </div>
            ))}
          </div>
          <div className="wide">
            <Results
              title="Голоса"
              data={{ positions: POSITION_NAMES, results: data.results }}
              candidates={data.candidates.map((c) => ({ ...c, eligible: !c.hidden }))}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openCandidate, setOpenCandidate] = useState(null);
  const closeModal = useCallback(() => setOpenCandidate(null), []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/election", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setError("");
    } catch (e) {
      setError(e.message || "Не удалось загрузить данные");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (!data) {
    return <div className="loading">{error || "Загрузка…"}</div>;
  }

  return (
    <>
      <Hero data={data} />
      <main className="content">
        {data.phase === "nomination" && (
          <div className="split">
            <CandidateList data={data} onOpen={setOpenCandidate} />
            <NominationForm data={data} onDone={load} />
          </div>
        )}
        {data.phase === "voting" && (
          <>
            <Ballot data={data} onDone={load} onOpen={setOpenCandidate} />
            <Results data={data} />
          </>
        )}
        {data.phase === "closed" && <Results data={data} title="Результаты голосования" />}
      </main>
      <footer className="footer">Training Club · Алматы</footer>
      {openCandidate && <PlanModal c={openCandidate} data={data} onClose={closeModal} />}
    </>
  );
}

createRoot(document.getElementById("root")).render(isAdmin ? <Admin /> : <App />);
