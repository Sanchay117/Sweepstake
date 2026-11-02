// A numbering machine: brass wheels that ratchet one digit at a time.
const DIGITS = "01234567890";

export function numbering(root, length = 8) {
  root.textContent = "";
  const wheels = Array.from({ length }, () => {
    const wheel = document.createElement("span");
    wheel.className = "wheel";
    const strip = document.createElement("span");
    strip.className = "wheel__strip";
    strip.setAttribute("aria-hidden", "true");
    for (const digit of DIGITS) {
      const face = document.createElement("span");
      face.textContent = digit;
      strip.append(face);
    }
    wheel.append(strip);
    root.append(wheel);
    return { strip, digit: 0 };
  });

  const settle = (wheel, position) => {
    wheel.strip.style.transition = "none";
    wheel.strip.style.transform = `translateY(${-position * (100 / DIGITS.length)}%)`;
  };

  return {
    /** Turns forward like the real wheel, so 9 rolls on to 0 instead of spinning back. */
    set(value, { instant = false } = {}) {
      const text = String(value).padStart(length, "0").slice(-length);
      root.setAttribute("aria-label", `Number ${text}`);
      [...text].forEach((char, i) => {
        const wheel = wheels[i];
        const next = Number(char);
        if (next === wheel.digit) return;
        if (instant) {
          settle(wheel, next);
          wheel.digit = next;
          return;
        }
        const target = next < wheel.digit ? 10 : next;
        wheel.strip.style.transition = "";
        requestAnimationFrame(() => {
          wheel.strip.style.transform = `translateY(${-target * (100 / DIGITS.length)}%)`;
        });
        if (target === 10) {
          wheel.strip.addEventListener("transitionend", () => settle(wheel, 0), { once: true });
        }
        wheel.digit = next;
      });
    },
  };
}
