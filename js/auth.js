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

    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value,
      password: passwordEl.value,
    });

    if (error) throw error;

    // ✅ Silent redirect (no alert)
    window.location.href = "dashboard.html";

  } catch (err) {
    showError(err.message);
    console.error("Login error:", err);
  }
});

/* ===== Small inline error message instead of alert ===== */
function showError(message) {
  let msg = document.getElementById("loginError");

  if (!msg) {
    msg = document.createElement("p");
    msg.id = "loginError";
    msg.style.color = "#f87171";
    msg.style.marginTop = "10px";
    msg.style.fontSize = "14px";
    loginBtn.after(msg);
  }

  msg.textContent = message;
}
