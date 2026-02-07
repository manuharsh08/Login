import { supabase } from "./supabaseClient.js";

const profileIcon = document.getElementById("profileIcon");

console.log("profile icon element:", profileIcon);

profileIcon.addEventListener("click", () => {
  location.href = "profile.html";
});
