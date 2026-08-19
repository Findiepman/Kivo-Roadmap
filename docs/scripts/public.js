// Standalone read-only viewer for a public roadmap. No login, no api.js (so the
// auth-redirect behaviour never applies here) — just a plain fetch by token.

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const titleEl = document.getElementById("roadmap-title");
const metaEl = document.getElementById("roadmap-meta");
const boardEl = document.getElementById("board-container");
const unavailableEl = document.getElementById("unavailable");

const taskModal = document.getElementById("task-modal");
const modalTitle = document.getElementById("modal-task-title");
const modalDesc = document.getElementById("modal-task-desc");
const modalTags = document.getElementById("modal-task-tags");

const STATUS_KEYS = ["planned", "in_progress", "finished"];
const STATUS_LABELS = { planned: "Planned", in_progress: "In progress", finished: "Finished" };

// Same deterministic tag-colour mapping as storage.js (kept local so this page
// stays dependency-free).
function tagColorClass(tag) {
    let hash = 0;
    const s = String(tag).toLowerCase();
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return "tag-c" + (hash % 8);
}

function showUnavailable() {
    if (boardEl) boardEl.style.display = "none";
    if (unavailableEl) unavailableEl.style.display = "block";
    titleEl.textContent = "Kivo";
    document.title = "Not available - Kivo";
}

function openTaskModal(task) {
    modalTitle.textContent = task.title;
    modalDesc.textContent = task.description || "No description.";
    modalTags.innerHTML = "";
    (task.tags || []).forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "task-tag " + tagColorClass(tag);
        pill.textContent = tag;
        modalTags.appendChild(pill);
    });
    taskModal.classList.add("open");
}

document.getElementById("close-task-modal").addEventListener("click", () => taskModal.classList.remove("open"));
document.getElementById("close-task-btn").addEventListener("click", () => taskModal.classList.remove("open"));
taskModal.addEventListener("click", (e) => {
    if (e.target === taskModal) taskModal.classList.remove("open");
});

function renderTaskRow(task) {
    const row = document.createElement("div");
    row.className = `task-row ${task.status}`;
    row.tabIndex = 0;

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.title;
    row.appendChild(name);

    if (Array.isArray(task.tags) && task.tags.length) {
        const tagsWrap = document.createElement("span");
        tagsWrap.className = "task-tags";
        task.tags.forEach(tag => {
            const pill = document.createElement("span");
            pill.className = "task-tag " + tagColorClass(tag);
            pill.textContent = tag;
            tagsWrap.appendChild(pill);
        });
        row.appendChild(tagsWrap);
    }

    const right = document.createElement("span");
    right.className = "row-right";
    const pill = document.createElement("span");
    pill.className = `status-pill status-${task.status}`;
    const dot = document.createElement("span");
    dot.className = "dot";
    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(STATUS_LABELS[task.status] || task.status));
    right.appendChild(pill);
    row.appendChild(right);

    row.addEventListener("click", () => openTaskModal(task));
    row.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openTaskModal(task);
    });

    return row;
}

function render(data) {
    titleEl.textContent = data.roadmap.title;
    document.title = `${data.roadmap.title} - Kivo`;
    metaEl.textContent = data.roadmap.description || "";

    const groups = { planned: [], in_progress: [], finished: [] };
    [...data.tasks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(t => {
            const key = groups[t.status] ? t.status : "planned";
            groups[key].push(t);
        });

    STATUS_KEYS.forEach(status => {
        const rows = document.getElementById(`rows-${status}`);
        const empty = document.getElementById(`empty-${status}`);
        const count = document.getElementById(`count-${status}`);
        rows.innerHTML = "";
        count.textContent = groups[status].length;
        empty.style.display = groups[status].length === 0 ? "block" : "none";
        groups[status].forEach(task => rows.appendChild(renderTaskRow(task)));
    });
}

async function load() {
    if (!token) {
        showUnavailable();
        return;
    }
    try {
        const res = await fetch(`/api/public/${encodeURIComponent(token)}`);
        if (!res.ok) {
            showUnavailable();
            return;
        }
        const data = await res.json();
        render(data);
    } catch (err) {
        showUnavailable();
    }
}

load();
