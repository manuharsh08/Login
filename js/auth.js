import { supabase } from "./supabaseClient.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

loginBtn?.addEventListener("click", async () => {
  try {
    if (!emailEl.value || !passwordEl.value) {
      showError("Enter email and password");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value,
      password: passwordEl.value,
    });

    if (error) throw error;

    // ✅ Silent redirect
    window.location.href = "dashboard.html";

  } catch (err) {
    showError(err.message);
    console.error("Login error:", err);
  } finally {
    setLoading(false);
  }
});

/* ===== Loading state ===== */
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

/* ===== Inline error ===== */
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
