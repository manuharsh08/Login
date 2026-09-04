import { supabase } from "../lib/supabase.js";
import { requireAdmin, wireLogout } from "../lib/session.js";
import { countLabel, el, errorMessage, renderList, setBusy, setNotice, toast } from "../lib/ui.js";
import "../lib/snow.js";

const addTestBtn = document.getElementById("addTestBtn");
const testTitle = document.getElementById("testTitle");
const testSubject = document.getElementById("testSubject");
const testLink = document.getElementById("testLink");
const adminTestsList = document.getElementById("adminTestsList");
const adminResultsList = document.getElementById("adminResultsList");
const adminTestsCount = document.getElementById("adminTestsCount");
const adminResultsCount = document.getElementById("adminResultsCount");
const totalTests = document.getElementById("totalTests");
const totalAttempts = document.getElementById("totalAttempts");
const avgScore = document.getElementById("avgScore");

await requireAdmin();
wireLogout();

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readTestForm() {
  const title = testTitle.value.trim();
  const subject = testSubject.value.trim();
  const formUrl = testLink.value.trim();

  if (!title || !subject || !formUrl) {
    toast("Please fill in every field.", "error");
    return null;
  }
  if (!isValidUrl(formUrl)) {
    toast("Enter a valid http(s) test link.", "error");
    return null;
  }
  return { title, subject, form_url: formUrl };
}

addTestBtn.addEventListener("click", async () => {
  const payload = readTestForm();
  if (!payload) return;

  const reset = setBusy(addTestBtn, "Adding...");

  const { error } = await supabase.from("tests").insert([payload]);
  reset();

  if (error) {
    console.error("Create test failed:", error.message);
    toast(errorMessage(error, "Could not create the test."), "error");
    return;
  }

  testTitle.value = "";
  testSubject.value = "";
  testLink.value = "";
  toast("Test added.", "success");

  await Promise.all([loadTests(), loadStats()]);
});

/** Swaps a test card into an inline edit form (replaces chained prompt() calls). */
function editForm(test, onDone) {
  const titleInput = el("input", { value: test.title, placeholder: "Title" });
  const subjectInput = el("input", { value: test.subject, placeholder: "Subject" });
  const urlInput = el("input", { type: "url", value: test.form_url, placeholder: "Form link" });

  const saveBtn = el("button", { type: "button", className: "edit-btn", text: "Save" });
  const cancelBtn = el("button", { type: "button", className: "secondary", text: "Cancel" });

  saveBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim();
    const formUrl = urlInput.value.trim();

    if (!title || !subject || !formUrl) {
      toast("Please fill in every field.", "error");
      return;
    }
    if (!isValidUrl(formUrl)) {
      toast("Enter a valid http(s) test link.", "error");
      return;
    }

    const reset = setBusy(saveBtn, "Saving...");
    const { error } = await supabase
      .from("tests")
      .update({ title, subject, form_url: formUrl })
      .eq("id", test.id);
    reset();

    if (error) {
      console.error("Update test failed:", error.message);
      toast(errorMessage(error, "Could not update the test."), "error");
      return;
    }

    toast("Test updated.", "success");
    await onDone();
  });

  cancelBtn.addEventListener("click", onDone);

  return el("article", { className: "test-card test-card-editing" }, [
    el("div", { className: "form-stack" }, [titleInput, subjectInput, urlInput]),
    el("div", { className: "admin-actions" }, [saveBtn, cancelBtn]),
  ]);
}

function testCard(test) {
  const editBtn = el("button", { type: "button", className: "edit-btn", text: "Edit" });
  const deleteBtn = el("button", { type: "button", className: "delete-btn", text: "Delete" });

  const card = el("article", { className: "test-card" }, [
    el("div", { className: "test-info" }, [
      el("h4", { text: test.title }),
      el("p", { text: test.subject }),
    ]),
    el("div", { className: "admin-actions" }, [editBtn, deleteBtn]),
  ]);

  editBtn.addEventListener("click", () => {
    card.replaceWith(editForm(test, loadTests));
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${test.title}"? This cannot be undone.`)) return;

    const reset = setBusy(deleteBtn, "Deleting...");
    const { error } = await supabase.from("tests").delete().eq("id", test.id);
    reset();

    if (error) {
      console.error("Delete test failed:", error.message);
      toast(errorMessage(error, "Could not delete the test."), "error");
      return;
    }

    toast("Test deleted.", "success");
    await Promise.all([loadTests(), loadStats()]);
  });

  return card;
}

function resultCard(result, title) {
  return el("article", { className: "result-card" }, [
    el("div", {}, [el("h4", { text: title || "Test" }), el("p", { text: result.email })]),
    el("div", {
      className: "score-badge",
      text: `${result.score}/${result.total} (${result.percentage}%)`,
    }),
  ]);
}

async function loadTests() {
  setNotice(adminTestsList, "Loading tests...");

  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading tests:", error.message);
    setNotice(adminTestsList, "Could not load tests.", "error");
    return;
  }

  const tests = data ?? [];
  adminTestsCount.textContent = countLabel(tests.length, "test");
  renderList(adminTestsList, tests, testCard, "No tests have been created yet.");
}

async function loadResults() {
  setNotice(adminResultsList, "Loading results...");

  // Joined client-side rather than with a PostgREST embed (`tests (title)`).
  // The embed needs a foreign key from results.test_id to tests.id, which this
  // schema does not declare, so it fails with "Could not find a relationship".
  // The dashboard resolves titles the same way.
  const [results, tests] = await Promise.all([
    supabase
      .from("results")
      .select("test_id, email, score, total, percentage, attempted_at")
      .order("attempted_at", { ascending: false }),
    supabase.from("tests").select("id, title"),
  ]);

  if (results.error) {
    console.error("Error loading results:", results.error.message);
    setNotice(adminResultsList, "Could not load results.", "error");
    return;
  }

  if (tests.error) {
    console.error("Error loading test titles:", tests.error.message);
  }

  const titlesById = new Map((tests.data ?? []).map(test => [test.id, test.title]));
  const rows = results.data ?? [];

  adminResultsCount.textContent = countLabel(rows.length, "result");
  renderList(
    adminResultsList,
    rows,
    result => resultCard(result, titlesById.get(result.test_id)),
    "No results yet."
  );
}

async function loadStats() {
  const [tests, attempts, scores] = await Promise.all([
    supabase.from("tests").select("*", { count: "exact", head: true }),
    supabase.from("results").select("*", { count: "exact", head: true }),
    supabase.from("results").select("percentage"),
  ]);

  if (tests.error || attempts.error || scores.error) {
    console.error("Error loading stats:", (tests.error || attempts.error || scores.error).message);
    return;
  }

  const percentages = (scores.data ?? []).map(row => Number(row.percentage) || 0);
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : 0;

  totalTests.textContent = tests.count ?? 0;
  totalAttempts.textContent = attempts.count ?? 0;
  avgScore.textContent = `${Math.round(average)}%`;
}

await Promise.all([loadTests(), loadResults(), loadStats()]);
