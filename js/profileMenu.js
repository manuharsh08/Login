const profileMenu = document.getElementById("profileMenu");

profileMenu?.addEventListener("click", event => {
  event.preventDefault();
  location.href = "profile.html";
});
