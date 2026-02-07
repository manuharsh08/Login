import { supabase } from "./supabaseClient.js";

const email = document.getElementById("email");
const password = document.getElementById("password");
const msg = document.getElementById("msg");

signupBtn.onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  });

  msg.innerText = error ? error.message : "Signup success. Now login.";
};

loginBtn.onclick = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  if (error) return (msg.innerText = error.message);

  location.href = "dashboard.html";
};