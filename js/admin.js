import { supabase } from "./supabaseClient.js";

/* ===== Auth check ===== */
const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
}

const userEmail = data.user.email;

/* ===== Check admin role ===== */
const { data: roleData } = await supabase
  .from("users")
  .select("role")
  .eq("email", userEmail)
  .single();

if (roleData?.role !== "admin") {
  location.href = "dashboard.html";
}

/* ===== Elements ===== */
const addTestBtn = document.getElementById("addTestBtn");
const logoutBtn = document.getElementById("logoutBtn");

const testTitle = document.getElementById("testTitle");
const testSubject = document.getElementById("testSubject");
const testLink = document.getElementById("testLink");

const adminTestsList = document.getElementById("adminTestsList");
const adminResultsList = document.getElementById("adminResultsList");

/* ===== Logout ===== */
logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};

/* ===== Add Test ===== */
addTestBtn.onclick = async () => {
  if (!testTitle.value || !testSubject.value || !testLink.value) {
    alert("Fill all fields");
    return;
  }

  const { error } = await supabase.from("tests").insert([
    {
      title: testTitle.value,
      subject: testSubject.value,
      form_url: testLink.value,
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Test added ✅");

  testTitle.value = "";
  testSubject.value = "";
  testLink.value = "";

  loadTests();
};

/* ===== Load Tests ===== */
async function loadTests() {
  const { data: tests } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  adminTestsList.innerHTML = "";

  tests.forEach(test => {
    const div = document.createElement("div");
    div.className = "test-card";

    div.innerHTML = `
      <div>
        <h4>${test.title}</h4>
        <p>${test.subject}</p>
      </div>
    `;

    adminTestsList.appendChild(div);
  });
}

/* ===== Load Results ===== */
async function loadResults() {
  const { data: results } = await supabase
    .from("results")
    .select(`
      email,
      score,
      total,
      percentage,
      tests (title)
    `)
    .order("created_at", { ascending: false });

  adminResultsList.innerHTML = "";

  results.forEach(r => {
    const div = document.createElement("div");
    div.className = "result-card";

    div.innerHTML = `
      <div>
        <h4>${r.tests?.title || "Test"}</h4>
        <p>${r.email}</p>
      </div>

      <div class="score-badge">
        ${r.score}/${r.total} (${r.percentage}%)
      </div>
    `;

    adminResultsList.appendChild(div);
  });
}

/* ===== Init ===== */
loadTests();
loadResults();
console.log("Logged in user:", userEmail);
console.log("Role data:", roleData);