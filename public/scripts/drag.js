// Drag a task to another status section (pointer events: mouse, pen and
// touch). The section under the pointer lights up; dropping it there moves the
// task. Works in both the list and the board layout.

let drag = null;
let suppressClick = false;

// A drag ends with a click on the card; the roadmap page ignores that click.
export const clickSuppressed = () => suppressClick;

function clearDropMarks() {
    document.querySelectorAll(".status-section.drop").forEach(n => n.classList.remove("drop"));
}

function endDrag(commit) {
    const d = drag;
    drag = null;
    if (!d) return;
    clearTimeout(d.timer);
    if (d.started) {
        d.ghost.remove();
        d.row.classList.remove("drag-src");
        document.body.classList.remove("dragging");
        clearDropMarks();
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 150);
        if (commit && d.to) d.onDrop(d.to);
    }
}

function startDrag(d, x, y) {
    if (drag !== d || d.started) return;
    d.started = true;
    const rect = d.row.getBoundingClientRect();
    d.offX = x - rect.left;
    d.offY = y - rect.top;
    d.ghost = d.row.cloneNode(true);
    d.ghost.classList.add("drag-ghost");
    d.ghost.removeAttribute("tabindex");
    d.ghost.style.width = rect.width + "px";
    // stays in its section so the list / board card styles still apply
    d.row.parentNode.appendChild(d.ghost);
    d.row.classList.add("drag-src");
    document.body.classList.add("dragging");
    moveGhost(d, x, y);
}

function moveGhost(d, x, y) {
    d.ghost.style.transform = `translate(${x - d.offX}px, ${y - d.offY}px)`;
    const target = document.elementFromPoint(x, y);
    const section = target && target.closest ? target.closest(".status-section") : null;
    clearDropMarks();
    d.to = null;
    if (section && section.dataset.status !== d.status) {
        section.classList.add("drop");
        d.to = section.dataset.status;
    }
    // scroll the page when dragging near the top or bottom edge
    if (y < 70) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 70) window.scrollBy(0, 14);
}

document.addEventListener("pointermove", (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pid) return;
    // button released outside the window
    if (e.pointerType === "mouse" && e.buttons === 0) { endDrag(false); return; }
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!d.started) {
        if (d.type === "touch") {
            // finger moved before the hold finished: it's a scroll, not a drag
            if (dist > 10) { clearTimeout(d.timer); drag = null; }
            return;
        }
        if (dist > 5) startDrag(d, e.clientX, e.clientY);
        return;
    }
    e.preventDefault();
    moveGhost(d, e.clientX, e.clientY);
});
document.addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.pid) endDrag(true); });
document.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.pid) endDrag(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drag) endDrag(false); });
window.addEventListener("blur", () => endDrag(false));

// opts: { status, onDrop(toStatus) }
export function attachDrag(row, opts) {
    row.addEventListener("touchmove", (e) => { if (drag && drag.started) e.preventDefault(); }, { passive: false });
    row.addEventListener("contextmenu", (e) => { if (drag && drag.started) e.preventDefault(); });
    row.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (e.target.closest("button, a, input, .menu")) return;
        endDrag(false);
        const d = {
            row, status: opts.status, onDrop: opts.onDrop,
            sx: e.clientX, sy: e.clientY, pid: e.pointerId, type: e.pointerType,
            started: false, timer: null, to: null
        };
        drag = d;
        // touch: hold the card a moment to pick it up, so scrolling still works
        if (e.pointerType !== "mouse") {
            d.timer = setTimeout(() => {
                if (d.row.isConnected) startDrag(d, d.sx, d.sy);
                else if (drag === d) drag = null;
            }, 280);
        }
    });
}
