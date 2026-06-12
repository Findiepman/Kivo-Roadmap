// Standalone read-only viewer for a public roadmap. No login, no api.js (so the
// auth-redirect behaviour never applies here) — just a plain fetch by token.

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const titleEl = document.getElementById("roadmap-title");
const metaEl = document.querySelector(".roadmap-meta");
const boardEl = document.getElementById("board-container");
const unavailableEl = document.getElementById("unavailable");

function showUnavailable() {
    if (boardEl) boardEl.style.display = "none";
    if (unavailableEl) unavailableEl.style.display = "block";
    titleEl.textContent = "Kivo";
    document.title = "Not available - Kivo";
}

function renderTask(task) {
    const card = document.createElement("div");
    card.className = "task-card";
    if (task.column === "done") card.classList.add("done");

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const desc = document.createElement("div");
    desc.className = "task-description";
    desc.textContent = task.description || "";

    card.appendChild(title);
    card.appendChild(desc);

    if (Array.isArray(task.tags) && task.tags.length) {
        const tagsWrap = document.createElement("div");
        tagsWrap.className = "task-tags";
        task.tags.forEach(tag => {
            const pill = document.createElement("span");
            pill.className = "task-tag";
            pill.textContent = tag;
            tagsWrap.appendChild(pill);
        });
        card.appendChild(tagsWrap);
    }

    return card;
}

function render(data) {
    titleEl.textContent = data.roadmap.title;
    document.title = `${data.roadmap.title} - Kivo`;
    metaEl.textContent = data.roadmap.description || "";

    const columns = { todo: [], doing: [], done: [] };
    [...data.tasks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(t => {
            const col = columns[t.column] ? t.column : "todo";
            columns[col].push(t);
        });

    document.querySelectorAll(".board-column").forEach(columnDiv => {
        const name = columnDiv.dataset.column;
        const list = columnDiv.querySelector(".tasks-list");
        list.innerHTML = "";
        columns[name].forEach(task => list.appendChild(renderTask(task)));
        columnDiv.querySelector(".column-count").textContent = columns[name].length;
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
