import { supabase } from "../lib/supabase.js";
import { requireUser } from "../lib/session.js";
import { el, errorMessage, setBusy, setNotice, toast } from "../lib/ui.js";
import "../lib/snow.js";

const subjectEl = document.getElementById("examSubject");
const titleEl = document.getElementById("examTitle");
const metaEl = document.getElementById("examMeta");
const stateEl = document.getElementById("examState");
const formEl = document.getElementById("examForm");
const listEl = document.getElementById("questionList");
const answeredEl = document.getElementById("answeredCount");
const submitBtn = document.getElementById("submitBtn");
const resultEl = document.getElementById("examResult");
const backBtn = document.getElementById("backBtn");

backBtn.addEventListener("click", () => location.replace("dashboard.html"));

await requireUser();

const testId = new URLSearchParams(location.search).get("test");

/** Answers keyed by question id: string[] for choices, string for free text. */
const answers = new Map();
let questions = [];

function updateAnsweredCount() {
  const done = questions.filter(question => {
    const value = answers.get(question.id);
    return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
  }).length;

  answeredEl.textContent = `${done} of ${questions.length} answered`;
  answeredEl.className = done === questions.length ? "sub answered-all" : "sub";
}

function choiceInput(question, option) {
  // Radios for one answer, checkboxes for several — the control itself tells
  // the student how many they may pick.
  const multiple = question.type === "multiple";
  const input = el("input", {
    type: multiple ? "checkbox" : "radio",
    name: `q-${question.id}`,
    value: option.id,
  });

  input.addEventListener("change", () => {
    if (multiple) {
      const chosen = new Set(answers.get(question.id) ?? []);
      input.checked ? chosen.add(option.id) : chosen.delete(option.id);
      answers.set(question.id, [...chosen]);
    } else {
      answers.set(question.id, [option.id]);
    }
    updateAnsweredCount();
  });

  return el("label", { className: "choice" }, [input, el("span", { text: option.text })]);
}

function questionCard(question, index) {
  const points = Number(question.points) || 1;

  const header = el("div", { className: "question-head" }, [
    el("span", { className: "question-number", text: `Q${index + 1}` }),
    el("p", { className: "question-prompt", text: question.prompt }),
    el("span", {
      className: "question-points",
      text: `${points} ${points === 1 ? "mark" : "marks"}`,
    }),
  ]);

  let body;
  if (question.type === "text") {
    const input = el("input", { type: "text", placeholder: "Your answer" });
    input.addEventListener("input", () => {
      answers.set(question.id, input.value);
      updateAnsweredCount();
    });
    body = el("div", { className: "question-body" }, [input]);
  } else {
    const options = Array.isArray(question.options) ? question.options : [];
    body = el(
      "div",
      { className: "question-body" },
      options.map(option => choiceInput(question, option))
    );

    if (question.type === "multiple") {
      body.append(el("small", { className: "hint", text: "Select all that apply." }));
    }
  }

  return el("article", { className: "question-card" }, [header, body]);
}

function showResult({ score, total, percentage }) {
  formEl.hidden = true;
  resultEl.hidden = false;

  const passed = Number(percentage) >= 40;

  resultEl.replaceChildren(
    el("div", { className: `result-panel ${passed ? "result-pass" : "result-fail"}` }, [
      el("p", { className: "result-eyebrow", text: "Submitted" }),
      el("p", { className: "result-score", text: `${score} / ${total}` }),
      el("p", { className: "result-percent", text: `${percentage}%` }),
      el("p", {
        className: "sub",
        text: "Your teacher can see this result now. It is also on your dashboard.",
      }),
    ])
  );
}

async function submit() {
  const unanswered = questions.length - Number(answeredEl.textContent.split(" ")[0]);
  if (unanswered > 0) {
    const ok = confirm(`${unanswered} question(s) are unanswered. Submit anyway?`);
    if (!ok) return;
  }

  const reset = setBusy(submitBtn, "Submitting...");

  try {
    // Graded on the server: the browser never sees the answer key, and the
    // score it reports is the score that was stored.
    const { data, error } = await supabase.rpc("submit_exam", {
      p_test_id: testId,
      p_answers: Object.fromEntries(answers),
    });
    if (error) throw error;

    showResult(data);
    toast("Test submitted and graded.", "success");
  } catch (err) {
    console.error("Submit failed:", err);
    toast(
      err?.code === "PGRST202"
        ? "Built-in tests are not set up yet. Run supabase/migrations/0007_builtin_exams.sql."
        : errorMessage(err, "Could not submit your test."),
      "error"
    );
    reset();
  }
}

async function loadExam() {
  if (!testId) {
    setNotice(stateEl, "No test was specified.", "error");
    return;
  }

  setNotice(stateEl, "Loading test...");

  const { data, error } = await supabase.rpc("get_exam", { p_test_id: testId });

  if (error) {
    console.error("Could not load exam:", error.message);
    const notSetUp =
      error.code === "PGRST202" ||
      /could not find the function|does not exist/i.test(error.message);

    setNotice(
      stateEl,
      notSetUp
        ? "Built-in tests are not set up yet. Run supabase/migrations/0007_builtin_exams.sql."
        : "Could not load this test. Please go back and try again.",
      "error"
    );
    return;
  }

  if (!data?.test) {
    setNotice(stateEl, "That test no longer exists.", "error");
    return;
  }

  titleEl.textContent = data.test.title;
  subjectEl.textContent = data.test.subject;
  document.title = `${data.test.title} · Exam Portal`;

  if (data.already_attempted) {
    setNotice(stateEl, "You have already submitted this test. Your result is on your dashboard.");
    return;
  }

  questions = data.questions ?? [];

  if (!questions.length) {
    setNotice(stateEl, "Your teacher has not added any questions to this test yet.");
    return;
  }

  const marks = questions.reduce((sum, question) => sum + (Number(question.points) || 1), 0);
  metaEl.textContent = `${questions.length} question${questions.length === 1 ? "" : "s"} · ${marks} marks`;

  stateEl.replaceChildren();
  listEl.replaceChildren(...questions.map(questionCard));
  formEl.hidden = false;
  updateAnsweredCount();
}

submitBtn.addEventListener("click", submit);
await loadExam();
