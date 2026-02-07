const canvas = document.getElementById("snow");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const flakes = [];

/* Create snowflakes */
for (let i = 0; i < 120; i++) {
  flakes.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 3 + 1,
    speed: Math.random() * 1 + 0.5,
    drift: Math.random() * 0.5 - 0.25,
  });
}

function drawSnow() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  flakes.forEach(flake => {
    flake.y += flake.speed;
    flake.x += flake.drift;

    if (flake.y > canvas.height) {
      flake.y = -5;
      flake.x = Math.random() * canvas.width;
    }

    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
  });

  requestAnimationFrame(drawSnow);
}

drawSnow();

/* Resize handling */
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
