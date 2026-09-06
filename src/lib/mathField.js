/**
 * The authoring half of maths support: a symbol palette and a live preview.
 *
 * A teacher types LaTeX into an ordinary text box. Underneath it, the same
 * text appears typeset the moment it becomes a valid formula — that preview
 * *is* the "convert to normal maths" step, so there is no button to forget to
 * press and no way to save a question you have not seen rendered.
 *
 * One palette serves every box on the page. It inserts into whichever field
 * was last focused, the way a word processor's toolbar does, because a
 * separate palette above each of six options would be unusable.
 */
import { el } from "./ui.js";
import { hasMath, setMathText } from "./math.js";

/** The box a palette button will type into. */
let activeInput = null;

/**
 * Symbols worth a button. Chosen for a school maths paper rather than
 * completeness: anything else can be typed as LaTeX between dollar signs.
 * `caret` is where the cursor lands after insertion, counted back from the
 * end, so the teacher is already inside the bracket they need to fill.
 */
const SYMBOLS = [
  { label: "x²", latex: "$x^{2}$", caret: 2, title: "Power" },
  { label: "x₁", latex: "$x_{1}$", caret: 2, title: "Subscript" },
  { label: "a⁄b", latex: "$\\frac{a}{b}$", caret: 5, title: "Fraction" },
  { label: "√", latex: "$\\sqrt{x}$", caret: 2, title: "Square root" },
  { label: "ⁿ√", latex: "$\\sqrt[n]{x}$", caret: 2, title: "nth root" },
  { label: "∑", latex: "$\\sum_{i=1}^{n}$", caret: 1, title: "Sum" },
  { label: "∫", latex: "$\\int_{a}^{b}$", caret: 1, title: "Integral" },
  { label: "π", latex: "$\\pi$", caret: 1, title: "Pi" },
  { label: "θ", latex: "$\\theta$", caret: 1, title: "Theta" },
  { label: "±", latex: "$\\pm$", caret: 1, title: "Plus or minus" },
  { label: "×", latex: "$\\times$", caret: 1, title: "Multiply" },
  { label: "÷", latex: "$\\div$", caret: 1, title: "Divide" },
  { label: "≤", latex: "$\\le$", caret: 1, title: "Less than or equal" },
  { label: "≥", latex: "$\\ge$", caret: 1, title: "Greater than or equal" },
  { label: "≠", latex: "$\\ne$", caret: 1, title: "Not equal" },
  { label: "°", latex: "$^{\\circ}$", caret: 1, title: "Degrees" },
  { label: "→", latex: "$\\to$", caret: 1, title: "Gives" },
  {
    label: "( )",
    latex: "$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$",
    caret: 1,
    title: "Matrix",
  },
];

/** Inserts text at the cursor and puts the caret somewhere useful inside it. */
function insertAtCursor(input, { latex, caret = 0 }) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;

  input.value = input.value.slice(0, start) + latex + input.value.slice(end);

  const position = start + latex.length - caret;
  input.focus();
  input.setSelectionRange(position, position);

  // The preview listens for `input`, which assigning to .value does not fire.
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * The shared symbol palette. Insert it once, above the fields it serves.
 * @param {HTMLElement} [fallback] Field to type into before anything is focused.
 */
export function mathPalette(fallback = null) {
  const buttons = SYMBOLS.map(symbol => {
    const button = el("button", {
      type: "button",
      className: "math-key",
      text: symbol.label,
      title: `${symbol.title} — ${symbol.latex}`,
    });

    // mousedown, not click: by click time the text box has already lost focus
    // and with it the cursor position we need to insert at.
    button.addEventListener("mousedown", event => {
      event.preventDefault();
      const target = activeInput ?? fallback;
      if (target) insertAtCursor(target, symbol);
    });

    return button;
  });

  return el("div", { className: "math-palette" }, [
    el("div", { className: "math-keys" }, buttons),
    el("small", {
      className: "hint",
      text:
        "Write maths between dollar signs — $x^2 + 1$ — and it appears typeset below the box. " +
        "Click a symbol to insert it into whichever box you were last typing in.",
    }),
  ]);
}

/**
 * Makes one text box maths-aware: a palette target, with a preview beneath it.
 *
 * The preview stays hidden until the text actually contains a formula, so a
 * history teacher writing ordinary questions never sees it.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 * @param {string} [label]
 * @returns {HTMLElement} The preview node, to place under the input.
 */
export function mathField(input, label = "Looks like") {
  const output = el("span", { className: "math-preview-body" });
  const preview = el("div", { className: "math-preview", hidden: true }, [
    el("span", { className: "math-preview-label", text: label }),
    output,
  ]);

  const update = () => {
    const value = input.value;
    preview.hidden = !hasMath(value);
    if (!preview.hidden) setMathText(output, value);
  };

  input.addEventListener("focus", () => (activeInput = input));
  input.addEventListener("input", update);
  update();

  return preview;
}
