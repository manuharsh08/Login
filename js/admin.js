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

/* ===== UPDATE TEST ===== */
async function updateTest(id, title, subject, link) {
  const { error } = await supabase
    .from("tests")
    .update({
      title: title,
      subject: subject,
      form_url: link,
    })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  loadTests();
}

/* ===== Load Tests ===== */
async function loadTests() {
  const { data: tests, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return;
  }

  adminTestsList.innerHTML = "";

  tests.forEach(test => {
    const div = document.createElement("div");
    div.className = "test-card";

    div.innerHTML = `
      <div>
        <h4>${test.title}</h4>
        <p>${test.subject}</p>
      </div>

      <div style="display:flex; gap:8px;">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    /* ===== DELETE ===== */
    const deleteBtn = div.querySelector(".delete-btn");

    deleteBtn.onclick = async () => {
      if (!confirm("Delete this test?")) return;

      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", test.id);

      if (error) {
        alert(error.message);
        return;
      }

      loadTests();
    };

    /* ===== EDIT ===== */
    const editBtn = div.querySelector(".edit-btn");

    editBtn.onclick = () => {
      const newTitle = prompt("Edit title:", test.title);
      const newSubject = prompt("Edit subject:", test.subject);
      const newLink = prompt("Edit form link:", test.form_url);

      if (!newTitle || !newSubject || !newLink) return;

      updateTest(test.id, newTitle, newSubject, newLink);
    };

    adminTestsList.appendChild(div);
  });
}

/* ===== Load Results ===== */
async function loadResults() {
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
    adminResultsList.innerHTML = `<p>Error loading results</p>`;
    return;
  }

  if (!results || results.length === 0) {
    adminResultsList.innerHTML = `<p>No results yet</p>`;
    return;
  }

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