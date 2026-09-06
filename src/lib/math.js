/**
 * LaTeX in questions, options and answers.
 *
 * Teachers write formulas the way they already know — between dollar signs,
 * `$x^2 + 1$` — and every place that shows the text renders it as ordinary
 * mathematical notation instead. The LaTeX source is what gets stored, so a
 * question is always editable and nothing depends on how it was typeset.
 *
 * Rendering is KaTeX rather than MathJax: it is synchronous, so a list of
 * fifty questions lays out in one pass with no reflow, and it is a fraction
 * of the size — which matters, because this loads inside a locked-down browser
 * on whatever hardware an exam hall has.
 */
import katex from "katex";
import "katex/dist/katex.min.css";
import { el } from "./ui.js";

/**
 * Recognised delimiters, longest first so `$$` is never mistaken for two `$`.
 * `\(..\)` and `\[..\]` are accepted too — they are what a teacher pasting
 * from a textbook or from Word's equation editor usually ends up with.
 */
const DELIMITERS = [
  { open: "$$", close: "$$", display: true },
  { open: "\\[", close: "\\]", display: true },
  { open: "\\(", close: "\\)", display: false },
  { open: "$", close: "$", display: false },
];

/**
 * Splits text into plain and mathematical runs.
 *
 * Anything that does not parse as a complete formula stays plain text. That
 * matters most while someone is still typing: a lone `$` must show as a
 * dollar sign, not swallow the rest of the sentence.
 *
 * @param {string} source
 * @returns {{type: "text"|"math", value: string, display?: boolean}[]}
 */
export function parseMath(source) {
  const text = String(source ?? "");
  const segments = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (plain) segments.push({ type: "text", value: plain });
    plain = "";
  };

  while (index < text.length) {
    // \$ is how you write a literal dollar sign in a price.
    if (text[index] === "\\" && text[index + 1] === "$") {
      plain += "$";
      index += 2;
      continue;
    }

    const delimiter = DELIMITERS.find(candidate => text.startsWith(candidate.open, index));
    if (!delimiter) {
      plain += text[index];
      index += 1;
      continue;
    }

    const from = index + delimiter.open.length;
    const closesAt = text.indexOf(delimiter.close, from);

    // Unclosed, or empty like `$$`: not a formula yet.
    if (closesAt === -1 || closesAt === from) {
      plain += text[index];
      index += 1;
      continue;
    }

    flush();
    segments.push({
      type: "math",
      value: text.slice(from, closesAt),
      display: delimiter.display,
    });
    index = closesAt + delimiter.close.length;
  }

  flush();
  return segments;
}

/** True when the text contains at least one complete formula. */
export function hasMath(source) {
  return parseMath(source).some(segment => segment.type === "math");
}

/**
 * The text as DOM nodes, with formulas typeset.
 *
 * Only KaTeX's own output is ever assigned as HTML. The prose around it stays
 * text nodes, so a question containing `<script>` is shown, not run.
 */
export function mathNodes(source) {
  return parseMath(source).map(segment => {
    if (segment.type === "text") return document.createTextNode(segment.value);

    const holder = el("span", {
      className: segment.display ? "math math-display" : "math math-inline",
    });

    try {
      holder.innerHTML = katex.renderToString(segment.value, {
        displayMode: segment.display,
        // A half-written formula must not blank the question it sits in, so
        // KaTeX marks the bad part in red and renders the rest.
        throwOnError: false,
        errorColor: "#f87171",
        strict: false,
        trust: false,
        output: "html",
      });
    } catch (error) {
      // Only reached if KaTeX itself fails; show the source so the teacher can
      // see what they typed rather than an empty space.
      console.error("Could not typeset formula:", error);
      holder.className = "math math-error";
      holder.textContent = segment.value;
    }

    return holder;
  });
}

/** Replaces a node's contents with `source`, typeset. Returns the node. */
export function setMathText(node, source) {
  node?.replaceChildren(...mathNodes(source));
  return node;
}

/** el(), but the text is typeset: mathText("p", { className: "q" }, prompt). */
export function mathText(tag, props = {}, source = "") {
  return setMathText(el(tag, props), source);
}
