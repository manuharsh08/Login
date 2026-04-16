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

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ===== Signup click ===== */
signupBtn?.addEventListener("click", async () => {
  try {
    if (!nameEl.value || !emailEl.value || !passwordEl.value) {
      alert("Please fill required fields");
      return;
    }

    /* ===== Create Auth User ===== */
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

    /* ===== Insert into users table ===== */
    if (data.user) {
      const { error: userInsertError } = await supabase
        .from("users")
        .insert([
          {
            email: data.user.email,
            role: "student",
          },
        ]);

      if (userInsertError) {
        console.error("User table insert error:", userInsertError.message);
      }
    }

    /* ===== Upload avatar (optional) ===== */
    if (avatarEl.files[0] && data.user) {
      const url = await uploadAvatar(avatarEl.files[0], data.user.id);

      await supabase.auth.updateUser({
        data: { photo: url },
      });
    }

    /* ===== Success ===== */
    alert("Account created successfully 🎉 Please login.");

    /* ===== Redirect to login ===== */
    window.location.href = "index.html";

  } catch (err) {
    alert(err.message);
    console.error("Signup error:", err);
  }
});