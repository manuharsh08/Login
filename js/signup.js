import { supabase } from "./supabaseClient.js";

/* ===== Elements ===== */
const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const mobileEl = document.getElementById("mobile");
const passwordEl = document.getElementById("password");
const avatarEl = document.getElementById("avatar");
const signupBtn = document.getElementById("signupBtn");
const fileName = document.getElementById("fileName");

/* ===== Show selected file name ===== */
avatarEl?.addEventListener("change", () => {
  if (fileName) fileName.textContent = avatarEl.files[0]?.name || "";
});

/* ===== Upload avatar ===== */
async function uploadAvatar(file, userId) {
  const path = `${userId}/${Date.now()}_${file.name}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/* ===== Signup click ===== */
signupBtn?.addEventListener("click", async () => {
  try {
    if (!nameEl.value || !emailEl.value || !passwordEl.value) {
      alert("Please fill required fields");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailEl.value,
      password: passwordEl.value,
      options: {
        data: {
          name: nameEl.value,
          mobile: mobileEl.value || null,
        },
      },
    });

    if (error) throw error;

    /* optional avatar upload */
    if (avatarEl.files[0] && data.user) {
      const url = await uploadAvatar(avatarEl.files[0], data.user.id);

      await supabase.auth.updateUser({
        data: { photo: url },
      });
    }

    alert("Account created successfully 🎉");
    window.location.href = "dashboard.html";

  } catch (err) {
    alert(err.message);
    console.error(err);
  }
});
