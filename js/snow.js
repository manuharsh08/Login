const canvas = document.getElementById("snow") || document.createElement("canvas");

if (!canvas.id) {
  canvas.id = "snow";
}

if (!canvas.isConnected) {
  document.body.prepend(canvas);
}

const ctx = canvas.getContext("2d");
let width;
let height;
let flakes = [];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

function createFlakes() {
  flakes = Array.from({ length: 110 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2.4 + 0.8,
    speed: Math.random() * 0.55 + 0.25,
    drift: Math.random() * 0.45 - 0.225,
  }));
}

function moveFlakes() {
  flakes.forEach(flake => {
    flake.y += flake.speed;
    flake.x += flake.drift;
    flake.drift += (Math.random() - 0.5) * 0.015;
    flake.drift = Math.max(-0.45, Math.min(0.45, flake.drift));

    if (flake.y > height) {
      flake.y = -5;
      flake.x = Math.random() * width;
    }

    if (flake.x > width) flake.x = 0;
    if (flake.x < 0) flake.x = width;
  });
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.beginPath();

  flakes.forEach(flake => {
    ctx.moveTo(flake.x, flake.y);
    ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
  });

  ctx.fill();
  moveFlakes();
  requestAnimationFrame(draw);
}

window.addEventListener("resize", () => {
  resize();
  createFlakes();
});

resize();
createFlakes();
draw();
