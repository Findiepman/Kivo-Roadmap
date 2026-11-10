// List / Board switch on a roadmap (also on the public view). The choice is
// remembered per browser.
const STORAGE_KEY = "kivo_view";

export function initViewToggle() {
    const seg = document.getElementById("view-seg");
    const view = document.getElementById("task-view");
    if (!seg || !view) return;
    const page = view.closest(".page");

    let mode = "list";
    try {
        if (localStorage.getItem(STORAGE_KEY) === "board") mode = "board";
    } catch (err) { /* storage blocked: default to the list */ }

    function apply() {
        view.className = mode === "board" ? "board" : "list-view";
        if (page) page.classList.toggle("wide", mode === "board");
        seg.querySelectorAll("button").forEach(btn => {
            const on = btn.dataset.view === mode;
            btn.classList.toggle("active", on);
            btn.setAttribute("aria-pressed", String(on));
        });
    }

    seg.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            mode = btn.dataset.view;
            try { localStorage.setItem(STORAGE_KEY, mode); } catch (err) { /* blocked */ }
            apply();
        });
    });

    apply();
}
