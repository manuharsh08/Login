import { supabase } from "./supabaseClient.js";

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const profileIcon = document.getElementById("profileIcon");
const testsList = document.getElementById("testsList");
const resultsList = document.getElementById("resultsList");
const testsCount = document.getElementById("testsCount");
const resultsCount = document.getElementById("resultsCount");

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
}

const userEmail = data.user.email;
const name = data.user.user_metadata?.name || userEmail.split("@")[0];

welcomeText.innerText = `Welcome, ${name}`;
profileIcon.src = data.user.user_metadata?.photo || DEFAULT_ICON;

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

function createTestCard(test) {
  const card = document.createElement("article");
  card.className = "test-card";

  const info = document.createElement("div");
  info.className = "test-info";

  const title = document.createElement("h4");
  title.textContent = test.title;

  const subject = document.createElement("p");
  subject.textContent = test.subject;

  const link = document.createElement("a");
  link.className = "start-btn";
  link.href = test.form_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Start Test";

  info.append(title, subject);
  card.append(info, link);
  return card;
}

function createResultCard(result, testInfo) {
  const card = document.createElement("article");
  card.className = "result-card";

  const info = document.createElement("div");
  const title = document.createElement("h4");
  const subject = document.createElement("p");
  const date = document.createElement("small");
  const score = document.createElement("div");

  title.textContent = testInfo?.title || "Test";
  subject.textContent = testInfo?.subject || "Subject not available";
  date.textContent = new Date(result.attempted_at).toLocaleDateString();
  score.className = "score-badge";
  score.textContent = `${result.score}/${result.total} (${result.percentage}%)`;

  info.append(title, subject, date);
  card.append(info, score);
  return card;
}

async function loadDashboard() {
  setEmptyState(testsList, "Loading tests...");
  setEmptyState(resultsList, "Loading results...");

  const { data: tests, error: testError } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (testError) {
    console.error("Error loading tests:", testError.message);
    setEmptyState(testsList, "Could not load tests. Please refresh and try again.");
    return;
  }

  const { data: results, error: resultError } = await supabase
    .from("results")
    .select("*")
    .eq("email", userEmail);

  if (resultError) {
    console.error("Error loading results:", resultError.message);
    setEmptyState(resultsList, "Could not load results. Please refresh and try again.");
    return;
  }

  const loadedTests = tests || [];
  const loadedResults = results || [];
  const resultsMap = {};
  loadedResults.forEach(result => {
    resultsMap[result.test_id] = result;
  });

  const pendingTests = loadedTests.filter(test => !resultsMap[test.id]);
  testsCount.textContent = `${pendingTests.length} pending`;
  resultsCount.textContent = `${loadedResults.length} attempts`;

  if (!pendingTests.length) {
    setEmptyState(testsList, "No tests are available right now.");
  } else {
    testsList.replaceChildren(...pendingTests.map(createTestCard));
  }

  if (!loadedResults.length) {
    setEmptyState(resultsList, "No attempts yet.");
  } else {
    const cards = loadedResults
      .sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at))
      .map(result => createResultCard(result, loadedTests.find(test => test.id === result.test_id)));

    resultsList.replaceChildren(...cards);
  }
}

loadDashboard();
