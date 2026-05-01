import { supabase } from "./supabaseClient.js";

const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const mobileEl = document.getElementById("mobile");
const passwordEl = document.getElementById("password");
const avatarEl = document.getElementById("avatar");
const signupBtn = document.getElementById("signupBtn");
const fileName = document.getElementById("fileName");

avatarEl?.addEventListener("change", () => {
  fileName.textContent = avatarEl.files[0]?.name || "";
});

async function uploadAvatar(file, userId) {
  const path = `${userId}/${Date.now()}_${file.name}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

signupBtn?.addEventListener("click", async () => {
  try {
    if (!nameEl.value.trim() || !emailEl.value.trim() || !passwordEl.value) {
      alert("Please fill required fields.");
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating account...";

    const { data, error } = await supabase.auth.signUp({
      email: emailEl.value.trim(),
      password: passwordEl.value,
      options: {
        data: {
          name: nameEl.value.trim(),
          mobile: mobileEl.value.trim() || null,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      const { error: userInsertError } = await supabase.from("users").insert([
        {
          email: data.user.email,
          role: "student",
        },
      ]);

      if (userInsertError) {
        console.error("User table insert error:", userInsertError.message);
      }
    }

    if (avatarEl.files[0] && data.user) {
      const url = await uploadAvatar(avatarEl.files[0], data.user.id);
      await supabase.auth.updateUser({ data: { photo: url } });
    }

    alert("Account created successfully. Please login.");
    window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
    console.error("Signup error:", err);
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = "Sign Up";
  }
});
