import { supabase } from "./supabaseClient.js";

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const profileIcon = document.getElementById("profileIcon");
const testsList = document.getElementById("testsList");
const resultsList = document.getElementById("resultsList");

const DEFAULT_ICON =
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// ================= AUTH =================
const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
}

const userEmail = data.user.email;
const name =
  data.user.user_metadata?.name || userEmail.split("@")[0];

welcomeText.innerText = `Welcome ${name}!`;
profileIcon.src = data.user.user_metadata?.photo || DEFAULT_ICON;

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};

// ================= LOAD DASHBOARD DATA =================
async function loadDashboard() {
  // 1️⃣ Get all tests
  const { data: tests, error: testError } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (testError) {
    console.error("Error loading tests:", testError.message);
    return;
  }

  // 2️⃣ Get user results
  const { data: results, error: resultError } = await supabase
    .from("results")
    .select("*")
    .eq("email", userEmail);

  if (resultError) {
    console.error("Error loading results:", resultError.message);
    return;
  }

  testsList.innerHTML = "";
  resultsList.innerHTML = "";

  // Convert results into map for quick lookup
  const resultsMap = {};
  results.forEach(r => {
    resultsMap[r.test_id] = r;
  });

  // ================= AVAILABLE TESTS =================
  tests.forEach(test => {
    // If user has NOT attempted this test
    if (!resultsMap[test.id]) {
      const div = document.createElement("div");
      div.className = "test-card";

      div.innerHTML = `
        <div class="test-info">
          <h4>${test.title}</h4>
          <p>${test.subject}</p>
        </div>

        <a class="start-btn" href="${test.form_url}" target="_blank">
          Start Test
        </a>
      `;

      testsList.appendChild(div);
    }
  });

  if (!testsList.children.length) {
    testsList.innerHTML = `<p style="opacity:0.6;">No tests available.</p>`;
  }

  // ================= PREVIOUS RESULTS =================
  if (!results.length) {
    resultsList.innerHTML = `<p style="opacity:0.6;">No attempts yet.</p>`;
  } else {
    results
      .sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at))
      .forEach(r => {
        const testInfo = tests.find(t => t.id === r.test_id);

        const div = document.createElement("div");
        div.className = "result-card";

        const date = new Date(r.attempted_at).toLocaleDateString();

        div.innerHTML = `
          <div>
            <h4>${testInfo?.title || "Test"}</h4>
            <p>${testInfo?.subject || ""}</p>
            <small>${date}</small>
          </div>

          <div class="score-badge">
            ${r.score}/${r.total} (${r.percentage}%)
          </div>
        `;

        resultsList.appendChild(div);
      });
  }
}

// Load everything
loadDashboard();
