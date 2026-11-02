import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./election.css";

const isAdmin = new URLSearchParams(location.search).has("admin");

// Schedule times are fixed at UTC+5, so shift and format in UTC to avoid stale browser tz data.
const formatDate = (iso) =>
  new Date(Date.parse(iso) + 5 * 3600e3).toLocaleString("ru-RU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
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

function Steps({ phase, schedule }) {
  const steps = [
    ["nomination", "Выдвижение кандидатов", `до ${formatDate(schedule.votingStart)}`],
    ["voting", "Голосование", `до ${formatDate(new Date(Date.parse(schedule.votingEnd) - 60e3).toISOString())}`],
    ["closed", "Итоги", "Воскресенье"],
  ];
  return (
    <ol className="steps">
      {steps.map(([key, title, when], i) => (
        <li key={key} className={phase === key ? "active" : ""}>
          <span>{i + 1}</span>
          <b>{title}</b>
          <small>{when}</small>
        </li>
      ))}
    </ol>
  );
}

function CandidateCard({ c, data, children }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`candidate ${c.eligible ? "" : "muted"}`}>
      <div className="candidateHead">
        {children}
        <div>
          <h3>{c.name}</h3>
          <p className="meta">
            {data.positions[c.position]} · в клубе {data.tenures[c.tenure].toLowerCase()}
          </p>
          {!c.eligible && <p className="tag">Стаж меньше года — не участвует в голосовании</p>}
        </div>
      </div>
      <button type="button" className="link" onClick={() => setOpen(!open)}>
        {open ? "Скрыть план" : "План развития клуба"}
      </button>
      {open && <p className="plan">{c.plan}</p>}
    </article>
  );
}

function CandidateList({ data }) {
  return Object.entries(data.positions).map(([position, title]) => {
    const list = data.candidates.filter((c) => c.position === position);
    return (
      <section key={position}>
        <h2>
          {title} <span className="count">{list.length}</span>
        </h2>
        {list.length ? (
          list.map((c) => <CandidateCard key={c.id} c={c} data={data} />)
        ) : (
          <p className="empty">Пока никто не выдвинулся</p>
        )}
      </section>
    );
  });
}

function NominationForm({ data, onDone }) {
  const [form, setForm] = useState({ name: "", phone: "", position: "", tenure: "", plan: "" });
  const [status, setStatus] = useState({ sending: false, error: "", done: false });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ sending: true, error: "", done: false });
    try {
      await post("/api/election", { action: "nominate", ...form, website: e.currentTarget.elements.website.value });
      setStatus({ sending: false, error: "", done: true });
      setForm({ name: "", phone: "", position: "", tenure: "", plan: "" });
      onDone();
    } catch (error) {
      setStatus({ sending: false, error: error.message, done: false });
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Выдвинуть кандидатуру</h2>
      <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
      <label>
        ФИО
        <input required minLength="3" value={form.name} onChange={set("name")} />
      </label>
      <label>
        Телефон из списка резидентов
        <input required type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 7__ ___ __ __" />
      </label>
      <div className="row">
        <label>
          Должность
          <select required value={form.position} onChange={set("position")}>
            <option value="" disabled>
              Выберите
            </option>
            {Object.entries(data.positions).map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </label>
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
      </div>
      <label>
        Пошаговый план развития клуба
        <textarea required minLength="10" maxLength="2000" rows="6" value={form.plan} onChange={set("plan")} />
      </label>
      {status.error && <p className="error" role="alert">{status.error}</p>}
      {status.done && <p className="success">Кандидатура принята и появилась в списке</p>}
      <button className="primary" disabled={status.sending}>
        {status.sending ? "Отправляем…" : "Выдвинуться"}
      </button>
    </form>
  );
}

function Ballot({ data, onDone }) {
  const [choices, setChoices] = useState({});
  const [phone, setPhone] = useState("");
  const [voted, setVoted] = useState(() => storage.get("tc-election-voted"));
  const [status, setStatus] = useState({ sending: false, error: "" });
  const open = Object.keys(data.positions).filter((p) => !voted.includes(p));

  const submit = async (e) => {
    e.preventDefault();
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
      <div className="card">
        <h2>Ваш голос учтён</h2>
        <p className="muted-text">Спасибо! Следите за голосованием ниже.</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Бюллетень</h2>
      <p className="muted-text">Один голос на каждую должность. Изменить голос нельзя.</p>
      <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
      {open.map((position) => {
        const list = data.candidates.filter((c) => c.position === position && c.eligible);
        return (
          <fieldset key={position}>
            <legend>{data.positions[position]}</legend>
            {list.length ? (
              list.map((c) => (
                <CandidateCard key={c.id} c={c} data={data}>
                  <input
                    type="radio"
                    name={position}
                    checked={choices[position] === c.id}
                    onChange={() => setChoices({ ...choices, [position]: c.id })}
                    aria-label={c.name}
                  />
                </CandidateCard>
              ))
            ) : (
              <p className="empty">Нет кандидатов</p>
            )}
          </fieldset>
        );
      })}
      <label>
        Телефон из списка резидентов
        <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 7__ ___ __ __" />
      </label>
      {status.error && <p className="error" role="alert">{status.error}</p>}
      <button className="primary" disabled={status.sending || !Object.keys(choices).length}>
        {status.sending ? "Отправляем…" : "Проголосовать"}
      </button>
    </form>
  );
}

function Results({ data, candidates = data.candidates }) {
  return (
    <div className="card">
      <h2>Ход голосования</h2>
      {Object.entries(data.positions).map(([position, title]) => {
        const { voters, counts } = data.results[position];
        const list = candidates
          .filter((c) => c.position === position && c.eligible)
          .map((c) => ({ ...c, votes: counts[c.id] || 0 }))
          .sort((a, b) => b.votes - a.votes);
        return (
          <div key={position} className="results">
            <h3>
              {title} <span className="count">{voters} голосов</span>
            </h3>
            {list.map((c) => (
              <div key={c.id} className="bar">
                <div className="barLabel">
                  <span>{c.name}</span>
                  <b>
                    {c.votes} · {voters ? Math.round((c.votes / voters) * 100) : 0}%
                  </b>
                </div>
                <div className="track">
                  <div style={{ width: `${voters ? (c.votes / voters) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
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

  if (!data) {
    return (
      <form className="card" onSubmit={(e) => (e.preventDefault(), run({ action: "overview" }))}>
        <h2>Админ-панель</h2>
        <label>
          Ключ администратора
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        {message && <p className="error">{message}</p>}
        <button className="primary">Войти</button>
      </form>
    );
  }

  return (
    <>
      <div className="card">
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
      <div className="card">
        <h2>
          Резиденты <span className="count">{data.residents}</span>
        </h2>
        <label>
          Телефоны — по одному в строке, добавляются к списку
          <textarea rows="5" value={phones} onChange={(e) => setPhones(e.target.value)} />
        </label>
        <button className="primary" onClick={() => run({ action: "residents", phones })}>
          Добавить
        </button>
        {message && <p className="success">{message}</p>}
      </div>
      <div className="card">
        <h2>Кандидаты</h2>
        {!data.candidates.length && <p className="empty">Пока никто не выдвинулся</p>}
        {data.candidates.map((c) => (
          <div key={c.id} className={`adminRow ${c.hidden ? "muted" : ""}`}>
            <div>
              <b>{c.name}</b>
              <p className="meta">
                {POSITION_NAMES[c.position]} · стаж {c.tenure} · +7{c.phone}
                {c.hidden && " · скрыт"}
              </p>
            </div>
            <button className="link" onClick={() => run({ action: c.hidden ? "show" : "hide", id: c.id })}>
              {c.hidden ? "Вернуть" : "Скрыть"}
            </button>
          </div>
        ))}
      </div>
      <Results
        data={{ positions: POSITION_NAMES, results: data.results }}
        candidates={data.candidates.map((c) => ({ ...c, eligible: !c.hidden && c.tenure !== "lt1" }))}
      />
    </>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

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
    if (isAdmin) return;
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <main>
      <header>
        <a className="logo" href="/">
          TRAINING CLUB
        </a>
      </header>
      <h1>Выборы президента и офицеров клуба</h1>
      {isAdmin ? (
        <Admin />
      ) : !data ? (
        <p className="muted-text">{error || "Загрузка…"}</p>
      ) : (
        <>
          <Steps phase={data.phase} schedule={data.schedule} />
          {data.phase === "before" && (
            <div className="card">
              <h2>Выдвижение начнётся {formatDate(data.schedule.nominationStart)}</h2>
            </div>
          )}
          {data.phase === "nomination" && (
            <>
              <NominationForm data={data} onDone={load} />
              <CandidateList data={data} />
            </>
          )}
          {data.phase === "voting" && (
            <>
              <Ballot data={data} onDone={load} />
              <Results data={data} />
            </>
          )}
          {data.phase === "closed" && (
            <>
              <div className="card">
                <h2>Голосование завершено</h2>
                <p className="muted-text">Итоги подведём в воскресенье.</p>
              </div>
              <Results data={data} />
            </>
          )}
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
