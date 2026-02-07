import { supabase } from "./supabaseClient.js";

const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const mobileEl = document.getElementById("mobile");
const passwordEl = document.getElementById("password");
const avatarEl = document.getElementById("avatar");
const signupBtn = document.getElementById("signupBtn");

async function uploadAvatar(file, userId) {
  const path = `${userId}/${Date.now()}_${file.name}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  return data.publicUrl;
}

signupBtn.onclick = async () => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailEl.value,
      password: passwordEl.value,
      options: {
        data: {
          name: nameEl.value,
          mobile: mobileEl.value,
        },
      },
    });

    if (error) throw error;

    let photoUrl = null;

    if (avatarEl.files[0]) {
      photoUrl = await uploadAvatar(avatarEl.files[0], data.user.id);

      await supabase.auth.updateUser({
        data: { photo: photoUrl },
      });
    }

    alert("Account created successfully 🎉");
    location.href = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
};
const fileName = document.getElementById("fileName");

avatarEl.addEventListener("change", () => {
  fileName.textContent = avatarEl.files[0]
    ? avatarEl.files[0].name
    : "";
});
