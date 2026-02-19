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

// ===== Fetch and show available tests =====
const testsList = document.getElementById("testsList");

async function loadTests() {
  const { data: tests, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading tests:", error.message);
    return;
  }

  // Clear container
  testsList.innerHTML = "";

  // Create simple list
  tests.forEach(test => {
    const div = document.createElement("div");

    div.style.margin = "10px 0";
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
  });
}

// Load tests when dashboard opens
loadTests();
