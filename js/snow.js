const canvas = document.createElement("canvas");
canvas.id = "snow";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

let width, height;
let flakes = [];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// create flakes
function createFlakes() {
  flakes = [];
  for (let i = 0; i < 140; i++) {
    flakes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 3 + 1,          // size
      speed: Math.random() * 0.7 + 0.3,  // slower fall
      drift: Math.random() * 0.5 - 0.25, // gentle sideways drift
    });
  }
}
createFlakes();

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();

  for (let f of flakes) {
    ctx.moveTo(f.x, f.y);
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  }

  ctx.fill();
  move();
}

function move() {
  for (let f of flakes) {
    // slow downward fall
    f.y += f.speed;

    // gentle natural drift
    f.x += f.drift;

    // slight random air movement
    f.drift += (Math.random() - 0.5) * 0.02;
    f.drift = Math.max(-0.5, Math.min(0.5, f.drift));

    // reset when off screen
    if (f.y > height) {
      f.y = -5;
      f.x = Math.random() * width;
    }

    if (f.x > width) f.x = 0;
    if (f.x < 0) f.x = width;
  }
}

function animate() {
  draw();
  requestAnimationFrame(animate);
}

animate();
