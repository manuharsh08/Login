import { supabase } from "./supabaseClient.js";

const avatarPreview = document.getElementById("avatarPreview");
const nameInput = document.getElementById("nameInput");
const fileInput = document.getElementById("fileInput");
const saveBtn = document.getElementById("saveBtn");
const backBtn = document.getElementById("backBtn");

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// Get current user
const { data } = await supabase.auth.getUser();

if (!data.user) {
  location.href = "index.html";
}

// Load existing profile
avatarPreview.src = data.user.user_metadata?.photo || DEFAULT_ICON;
nameInput.value = data.user.user_metadata?.name || "";

// Upload image helper
async function uploadAvatar(file, userId) {
  const filePath = `${userId}/${Date.now()}_${file.name}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// Save changes
saveBtn.onclick = async () => {
  try {
    let photoUrl = data.user.user_metadata?.photo || null;

    if (fileInput.files[0]) {
      photoUrl = await uploadAvatar(fileInput.files[0], data.user.id);
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        name: nameInput.value,
        photo: photoUrl,
      },
    });

    if (error) throw error;

    alert("Profile updated successfully 🎉");
    location.href = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
};

backBtn.onclick = () => {
  location.href = "dashboard.html";
};