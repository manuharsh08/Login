import { supabase } from "./supabaseClient.js";

const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
}

const userEmail = data.user.email;

const { data: roleData } = await supabase
  .from("users")
  .select("role")
  .eq("email", userEmail)
  .single();

if (roleData?.role !== "admin") {
  location.href = "dashboard.html";
}

const addTestBtn = document.getElementById("addTestBtn");
const logoutBtn = document.getElementById("logoutBtn");
const testTitle = document.getElementById("testTitle");
const testSubject = document.getElementById("testSubject");
const testLink = document.getElementById("testLink");
const adminTestsList = document.getElementById("adminTestsList");
const adminResultsList = document.getElementById("adminResultsList");
const adminTestsCount = document.getElementById("adminTestsCount");
const adminResultsCount = document.getElementById("adminResultsCount");

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};

function setEmptyState(container, message) {
  const empty = document.createElement("p");
  empty.className = "notice";
  empty.textContent = message;
  container.replaceChildren(empty);
}

function validateTestForm() {
  if (!testTitle.value.trim() || !testSubject.value.trim() || !testLink.value.trim()) {
    alert("Please fill all fields.");
    return false;
  }

  try {
    new URL(testLink.value);
    return true;
  } catch {
    alert("Please enter a valid test link.");
    return false;
  }
}

addTestBtn.onclick = async () => {
  if (!validateTestForm()) return;

  addTestBtn.disabled = true;
  addTestBtn.textContent = "Adding...";

  const { error } = await supabase.from("tests").insert([
    {
      title: testTitle.value.trim(),
      subject: testSubject.value.trim(),
      form_url: testLink.value.trim(),
    },
  ]);

  addTestBtn.disabled = false;
  addTestBtn.textContent = "Add Test";

  if (error) {
    alert(error.message);
    return;
  }

  testTitle.value = "";
  testSubject.value = "";
  testLink.value = "";

  await Promise.all([loadTests(), loadStats()]);
};

async function updateTest(id, title, subject, link) {
  const { error } = await supabase
    .from("tests")
    .update({ title, subject, form_url: link })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadTests();
}

function createAdminTestCard(test) {
  const card = document.createElement("article");
  card.className = "test-card";

  const info = document.createElement("div");
  const title = document.createElement("h4");
  const subject = document.createElement("p");
  const actions = document.createElement("div");
  const editBtn = document.createElement("button");
  const deleteBtn = document.createElement("button");

  title.textContent = test.title;
  subject.textContent = test.subject;
  actions.className = "admin-actions";
  editBtn.className = "edit-btn";
  editBtn.type = "button";
  editBtn.textContent = "Edit";
  deleteBtn.className = "delete-btn";
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";

  deleteBtn.onclick = async () => {
    if (!confirm(`Delete "${test.title}"?`)) return;

    const { error } = await supabase.from("tests").delete().eq("id", test.id);

    if (error) {
      alert(error.message);
      return;
    }

    await Promise.all([loadTests(), loadStats()]);
  };

  editBtn.onclick = () => {
    const newTitle = prompt("Edit title:", test.title);
    if (!newTitle) return;

    const newSubject = prompt("Edit subject:", test.subject);
    if (!newSubject) return;

    const newLink = prompt("Edit form link:", test.form_url);
    if (!newLink) return;

    updateTest(test.id, newTitle.trim(), newSubject.trim(), newLink.trim());
  };

  info.append(title, subject);
  actions.append(editBtn, deleteBtn);
  card.append(info, actions);
  return card;
}

async function loadTests() {
  setEmptyState(adminTestsList, "Loading tests...");

  const { data: tests, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    setEmptyState(adminTestsList, "Could not load tests.");
    return;
  }

  const loadedTests = tests || [];
  adminTestsCount.textContent = `${loadedTests.length} tests`;

  if (!loadedTests.length) {
    setEmptyState(adminTestsList, "No tests have been created yet.");
    return;
  }

  adminTestsList.replaceChildren(...loadedTests.map(createAdminTestCard));
}

function createResultCard(result) {
  const card = document.createElement("article");
  card.className = "result-card";

  const info = document.createElement("div");
  const title = document.createElement("h4");
  const email = document.createElement("p");
  const score = document.createElement("div");

  title.textContent = result.tests?.title || "Test";
  email.textContent = result.email;
  score.className = "score-badge";
  score.textContent = `${result.score}/${result.total} (${result.percentage}%)`;

  info.append(title, email);
  card.append(info, score);
  return card;
}

async function loadResults() {
  setEmptyState(adminResultsList, "Loading results...");

  const { data: results, error } = await supabase
    .from("results")
    .select(`
      email,
      score,
      total,
      percentage,
      tests (title)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Results error:", error.message);
    setEmptyState(adminResultsList, "Could not load results.");
    return;
  }

  const loadedResults = results || [];
  adminResultsCount.textContent = `${loadedResults.length} results`;

  if (!loadedResults.length) {
    setEmptyState(adminResultsList, "No results yet.");
    return;
  }

  adminResultsList.replaceChildren(...loadedResults.map(createResultCard));
}

async function loadStats() {
  const { count: testCount } = await supabase
    .from("tests")
    .select("*", { count: "exact", head: true });

  const { count: attemptCount } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true });

  const { data: scores } = await supabase.from("results").select("percentage");

  const avg = scores?.length
    ? scores.reduce((sum, score) => sum + score.percentage, 0) / scores.length
    : 0;

  document.getElementById("totalTests").innerText = testCount || 0;
  document.getElementById("totalAttempts").innerText = attemptCount || 0;
  document.getElementById("avgScore").innerText = `${Math.round(avg)}%`;
}

loadTests();
loadResults();
loadStats();
