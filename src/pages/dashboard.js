import { supabase, DEFAULT_AVATAR } from "../lib/supabase.js";
import { requireUser, displayName, wireLogout } from "../lib/session.js";
import { countLabel, el, renderList, setNotice } from "../lib/ui.js";
import "../lib/snow.js";

const welcomeText = document.getElementById("welcomeText");
const profileIcon = document.getElementById("profileIcon");
const testsList = document.getElementById("testsList");
const resultsList = document.getElementById("resultsList");
const testsCount = document.getElementById("testsCount");
const resultsCount = document.getElementById("resultsCount");

const user = await requireUser();

welcomeText.textContent = `Welcome, ${displayName(user)}`;
profileIcon.src = user.user_metadata?.photo || DEFAULT_AVATAR;
profileIcon.alt = `${displayName(user)} profile picture`;
wireLogout();

function testCard(test) {
  return el("article", { className: "test-card" }, [
    el("div", { className: "test-info" }, [
      el("h4", { text: test.title }),
      el("p", { text: test.subject }),
    ]),
    el("a", {
      className: "start-btn",
      href: test.form_url,
      target: "_blank",
      rel: "noreferrer",
      text: "Start Test",
    }),
  ]);
}

function resultCard(result, test) {
  const attemptedAt = result.attempted_at ? new Date(result.attempted_at) : null;
  const dateText =
    attemptedAt && !Number.isNaN(attemptedAt.valueOf()) ? attemptedAt.toLocaleDateString() : "";

  return el("article", { className: "result-card" }, [
    el("div", {}, [
      el("h4", { text: test?.title || "Test" }),
      el("p", { text: test?.subject || "Subject not available" }),
      el("small", { text: dateText }),
    ]),
    el("div", {
      className: "score-badge",
      text: `${result.score}/${result.total} (${result.percentage}%)`,
    }),
  ]);
}

async function loadDashboard() {
  setNotice(testsList, "Loading tests...");
  setNotice(resultsList, "Loading results...");

  const [tests, results] = await Promise.all([
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
    supabase.from("results").select("*").eq("email", user.email),
  ]);

  if (tests.error) {
    console.error("Error loading tests:", tests.error.message);
    setNotice(testsList, "Could not load tests. Please refresh and try again.", "error");
  }
  if (results.error) {
    console.error("Error loading results:", results.error.message);
    setNotice(resultsList, "Could not load results. Please refresh and try again.", "error");
  }

  const allTests = tests.data ?? [];
  const allResults = results.data ?? [];
  const testsById = new Map(allTests.map(test => [test.id, test]));
  const attemptedIds = new Set(allResults.map(result => result.test_id));

  if (!tests.error) {
    const pending = allTests.filter(test => !attemptedIds.has(test.id));
    testsCount.textContent = `${pending.length} pending`;
    renderList(testsList, pending, testCard, "No tests are available right now.");
  }

  if (!results.error) {
    const sorted = [...allResults].sort(
      (a, b) => new Date(b.attempted_at) - new Date(a.attempted_at)
    );
    resultsCount.textContent = countLabel(sorted.length, "attempt");
    renderList(
      resultsList,
      sorted,
      result => resultCard(result, testsById.get(result.test_id)),
      "No attempts yet."
    );
  }
}

await loadDashboard();
