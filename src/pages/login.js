import { supabase } from "../lib/supabase.js";
import { getRole } from "../lib/session.js";
import { errorMessage, onSubmit, setBusy } from "../lib/ui.js";
import "../lib/snow.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loader = document.getElementById("loader");
const errorEl = document.getElementById("loginError");

let inFlight = false;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

async function login() {
  if (inFlight) return;

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    showError("Enter your email and password.");
    return;
  }

  inFlight = true;
  showError("");
  const reset = setBusy(loginBtn, "Logging in...");

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const role = await getRole(email);

    loader?.classList.remove("hidden");
    location.replace(role === "admin" ? "admin.html" : "dashboard.html");
  } catch (err) {
    console.error("Login failed:", err);
    showError(errorMessage(err, "Could not sign you in. Check your details and try again."));
    reset();
    inFlight = false;
  }
}

loginBtn?.addEventListener("click", login);
onSubmit([emailEl, passwordEl], login);
