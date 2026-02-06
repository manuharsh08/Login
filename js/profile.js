import { supabase } from "./supabaseClient.js";

const avatar = document.getElementById("avatar");
const nameInput = document.getElementById("name");
const photoInput = document.getElementById("photo");

const { data } = await supabase.auth.getUser();
if (!data.user) location.href = "index.html";

avatar.src =
  data.user.user_metadata?.photo ||
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";
nameInput.value = data.user.user_metadata?.name || "";
photoInput.value = data.user.user_metadata?.photo || "";

saveProfile.onclick = async () => {
  await supabase.auth.updateUser({
    data: {
      name: nameInput.value,
      photo: photoInput.value,
    },
  });

  alert("Profile saved!");
  location.reload();
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};