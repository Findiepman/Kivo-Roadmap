// Inline SVG icons. An SVG centres exactly inside a round button; a text glyph
// (an arrow, a cross) never quite does.
const SVGNS = "http://www.w3.org/2000/svg";

export const ICON = {
    back: "M19 12H5M11 6l-6 6 6 6",
    close: "M6 6l12 12M18 6L6 18",
    chevron: "M9 6l6 6-6 6",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"
};

export function svgIcon(d, size = 18) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2.2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    s.appendChild(p);
    return s;
}
