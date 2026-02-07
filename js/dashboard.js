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
