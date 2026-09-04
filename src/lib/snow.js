/**
 * Decorative snowfall on the #snow canvas. No-ops when the canvas is absent,
 * when the user prefers reduced motion, or while the tab is hidden.
 */
const FLAKE_COUNT = 110;

export function startSnow() {
  const canvas = document.getElementById("snow");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return () => {};

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let width = 0;
  let height = 0;
  let flakes = [];
  let frame = null;

  function reset() {
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    flakes = Array.from({ length: FLAKE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.4 + 0.8,
      speed: Math.random() * 0.55 + 0.25,
      drift: Math.random() * 0.45 - 0.225,
    }));
  }

  function step(flake) {
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
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();

    flakes.forEach(flake => {
      step(flake);
      ctx.moveTo(flake.x, flake.y);
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
    });

    ctx.fill();
    frame = requestAnimationFrame(draw);
  }

  function play() {
    if (frame === null && !reduceMotion.matches && !document.hidden) {
      frame = requestAnimationFrame(draw);
    }
  }

  function pause() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function onVisibility() {
    document.hidden ? pause() : play();
  }

  function onMotionChange() {
    if (reduceMotion.matches) {
      pause();
      ctx.clearRect(0, 0, width, height);
    } else {
      play();
    }
  }

  function onResize() {
    reset();
  }

  reset();
  play();

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  reduceMotion.addEventListener("change", onMotionChange);

  return function stopSnow() {
    pause();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    reduceMotion.removeEventListener("change", onMotionChange);
  };
}

startSnow();
