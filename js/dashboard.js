import { supabase } from "./supabaseClient.js";

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const profileIcon = document.getElementById("profileIcon");

const DEFAULT_ICON =
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
} else {
  const name =
    data.user.user_metadata?.name || data.user.email.split("@")[0];

  welcomeText.innerText = `Welcome ${name}!`;

  // ⭐ SHOW AVATAR
  profileIcon.src = data.user.user_metadata?.photo || DEFAULT_ICON;
}

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};

// ===== Fetch and show available tests with attempt status =====
const testsList = document.getElementById("testsList");

async function loadTests() {
  const userEmail = data.user.email;

  // 1️⃣ Get all tests
  const { data: tests, error: testError } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (testError) {
    console.error("Error loading tests:", testError.message);
    return;
  }

  testsList.innerHTML = "";

  // 2️⃣ Loop through tests
  for (const test of tests) {
    // Check if this user already attempted this test
    const { data: result } = await supabase
      .from("results")
      .select("*")
      .eq("email", userEmail)
      .eq("test_id", test.id)
      .single();

    const div = document.createElement("div");
    div.className = "test-card";

    // 3️⃣ If attempted → show score
    if (result) {
      div.innerHTML = `
        <div class="test-info">
          <h4>${test.title}</h4>
          <p>${test.subject}</p>
          <small>Score: ${result.score}/${result.total} (${result.percentage}%)</small>
        </div>

        <span class="attempted-badge">Attempted ✓</span>
      `;
    }

    // 4️⃣ If not attempted → show start button
    else {
      div.innerHTML = `
        <div class="test-info">
          <h4>${test.title}</h4>
          <p>${test.subject}</p>
        </div>

        <a class="start-btn" href="${test.form_url}" target="_blank">
          Start Test
        </a>
      `;
    }

    testsList.appendChild(div);
  }
}

// Load tests
loadTests();
