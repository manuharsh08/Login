import { supabase } from "./supabaseClient.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loader = document.getElementById("loader");

loginBtn?.addEventListener("click", login);

[emailEl, passwordEl].forEach(input => {
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      login();
    }
  });
});

async function login() {
  try {
    if (!emailEl.value.trim() || !passwordEl.value) {
      showError("Enter email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value,
    });

    if (error) throw error;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user.email;

    const { data: roleData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("email", userEmail)
      .single();

    if (roleError) {
      console.error("Role fetch error:", roleError.message);
    }

    loader?.classList.remove("hidden");

    setTimeout(() => {
      window.location.href = roleData?.role === "admin" ? "admin.html" : "dashboard.html";
    }, 700);
  } catch (err) {
    showError(err.message);
    console.error("Login error:", err);
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (!loginBtn) return;

  if (isLoading) {
    loginBtn.disabled = true;
    loginBtn.dataset.originalText = loginBtn.textContent;
    loginBtn.innerHTML = `<span class="spinner"></span> Logging in...`;
  } else {
    loginBtn.disabled = false;
    loginBtn.textContent = loginBtn.dataset.originalText || "Login";
  }
}

function showError(message) {
  let msg = document.getElementById("loginError");

  if (!msg) {
    msg = document.createElement("p");
    msg.id = "loginError";
    msg.className = "login-error";
    loginBtn.after(msg);
  }

  msg.textContent = message;
}
