import { state } from "./state.js";
import { tasksToColumns, tagColorClass, COLUMN_KEYS } from "./storage.js";
import { api } from "./api.js";

// "Economy, Mining" -> ["Economy", "Mining"]
function parseTags(value) {
    return String(value || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
}

// ===== DOM ELEMENTEN =====
const roadMapTitle = document.getElementById("roadmap-title"); // titel van de roadmap
const taskModal = document.getElementById("create-task-modal"); // taak modal
const cancelTaskBtn = document.getElementById("cancel-task-btn"); // annuleren knop
const createTaskBtn = document.getElementById("create-task-btn"); // aanmaken knop
const closeTaskModal = document.getElementById("close-task-modal"); // sluit knop modal
const taskName = document.getElementById("task-name"); // input taak naam
const taskDesc = document.getElementById("task-desc"); // input taak beschrijving
const taskTags = document.getElementById("task-tags"); // input taak tags (comma separated)
const customSelect = document.getElementById("task-column"); // select dropdown
const selected = customSelect.querySelector(".selected"); // geselecteerde value
const deleteTaskModal = document.getElementById("delete-task-modal"); // delete task modal
const closeDeleteTaskBtn = document.getElementById("close-delete-task-modal"); // sluit knop
const cancelDeleteTaskBtn = document.getElementById("cancel-delete-task-btn"); // annuleer knop
const confirmDeleteTaskBtn = document.getElementById("confirm-delete-task-btn"); // confirm delete knop

// rename modal
const renameModal = document.getElementById("rename-modal");
const renameName = document.getElementById("rename-roadmap-name");
const renameDesc = document.getElementById("rename-roadmap-description");
const renameTags = document.getElementById("rename-task-tags");
const renameBtn = document.getElementById("rename-btn");
const cancelRenameBtn = document.getElementById("cancel-rename-btn");
const closeRenameBtn = document.getElementById("close-rename-modal");

// ===== STATE VARIABELEN =====
let taskToDeleteId = null; // taak id voor delete
let taskToDeleteColumn = null; // kolom van taak voor delete
let roadmap = null; // huidige roadmap
let selectedValue = "planned"; // default column
let taskToRenameId = null;
let taskToRenameColumn = null;
const options = customSelect.querySelectorAll(".options li"); // dropdown opties

// alleen owners en editors mogen wijzigen; viewers zijn read-only
function canEdit() {
    return roadmap && (roadmap.role === "owner" || roadmap.role === "editor");
}

// ===== DROPDOWN LOGICA =====
selected.addEventListener("click", () => {
    customSelect.classList.add("open"); // open dropdown
});

// kies optie
options.forEach(option => {
    option.addEventListener("click", () => {
        selected.textContent = option.textContent; // update text
        selectedValue = option.getAttribute("data-value"); // update waarde
        customSelect.classList.remove("open"); // sluit dropdown
    });
});

// sluit dropdown bij klik buiten
document.addEventListener("click", (e) => {
    if (!customSelect.contains(e.target)) {
        customSelect.classList.remove("open");
    }
});

// ===== INIT ROADMAP PAGINA =====
async function initRoadmapPage() {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const roadmapId = idParam ? Number(idParam) : null;

    if (!roadmapId) {
        window.location.href = "404.html";
        return;
    }

    // sessie check; bij 401 stuurt api ons al naar de login
    let meta;
    try {
        meta = await api.getRoadmap(roadmapId);
    } catch (err) {
        // 404 of geen toegang
        window.location.href = "404.html";
        return;
    }
    if (!meta) return;

    let tasks = [];
    try {
        tasks = await api.getTasks(roadmapId);
    } catch (err) {
        tasks = [];
    }

    roadmap = {
        id: meta.id,
        name: meta.title,
        desc: meta.description || "",
        role: meta.role,
        columns: tasksToColumns(tasks)
    };
    state.roadmap = roadmap;

    applyRoleUI();
    renderTasks();
}

// pagina load
initRoadmapPage();

// ===== ROL-GEBASEERDE UI =====
function applyRoleUI() {
    if (canEdit()) return;

    // viewer: verberg alle "Add Task" knoppen
    document.querySelectorAll(".btn-add-task").forEach(btn => {
        btn.style.display = "none";
    });

    // read-only badge in de header tonen
    const headerRight = document.querySelector(".header-right");
    if (headerRight && !document.querySelector(".read-only-badge")) {
        const badge = document.createElement("span");
        badge.className = "read-only-badge";
        badge.textContent = "Viewing (read-only)";
        headerRight.appendChild(badge);
    }
}

// ===== TASKS HERLADEN VAN SERVER =====
async function reloadTasks() {
    if (!roadmap) return;
    const tasks = await api.getTasks(roadmap.id);
    roadmap.columns = tasksToColumns(tasks);
    renderTasks();
}

// ===== CREATE TASK =====
async function createTask(column, text, title, tags) {
    if (!roadmap || !canEdit()) return;
    if (!COLUMN_KEYS.includes(column)) return; // check column
    if (!title || !title.trim()) return;

    await api.createTask(roadmap.id, {
        title: title.trim(),
        description: text || "",
        column,
        tags: Array.isArray(tags) ? tags : []
    });

    await reloadTasks();
}

// ===== DELETE TASK =====
async function deleteTask(taskId, columnName) {
    if (!roadmap || !canEdit()) return;
    await api.deleteTask(roadmap.id, taskId);
    await reloadTasks();
}

// ===== DELETE TASK MODAL =====
function openDeleteTaskModal(taskId, columnName) {
    taskToDeleteId = taskId;
    taskToDeleteColumn = columnName;
    deleteTaskModal.style.display = "flex"; // open modal
}

function closeDeleteTaskModal() {
    deleteTaskModal.style.display = "none"; // sluit modal
    taskToDeleteId = null;
    taskToDeleteColumn = null;
}

closeDeleteTaskBtn.addEventListener("click", closeDeleteTaskModal);
cancelDeleteTaskBtn.addEventListener("click", closeDeleteTaskModal);

confirmDeleteTaskBtn.addEventListener("click", () => {
    if (taskToDeleteId !== null && taskToDeleteColumn) {
        deleteTask(taskToDeleteId, taskToDeleteColumn); // verwijder taak
    }
    closeDeleteTaskModal();
});

// ===== RENDER TASKS =====
function renderTasks() {
    if (!roadmap) return;

    const editable = canEdit();

    // update titel en description
    roadMapTitle.textContent = roadmap.name;
    document.querySelector(".roadmap-meta").textContent = roadmap.desc || "";

    // loop kolommen
    document.querySelectorAll(".board-column").forEach(columnDiv => {
        const columnName = columnDiv.dataset.column;
        const tasksList = columnDiv.querySelector(".tasks-list");

        tasksList.innerHTML = ""; // clear tasks

        // render elke task
        roadmap.columns[columnName].forEach(task => {
            const taskCard = document.createElement("div");
            taskCard.className = "task-card";
            if (editable) taskCard.setAttribute("draggable", "true");
            taskCard.dataset.id = task.id;

            const title = document.createElement("div");
            title.className = "task-title";
            title.textContent = task.title;

            const desc = document.createElement("div");
            desc.className = "task-description";
            desc.textContent = task.text;

            // tags (gekleurde pill badges) — alleen als de taak tags heeft
            let tagsWrap = null;
            if (Array.isArray(task.tags) && task.tags.length) {
                tagsWrap = document.createElement("div");
                tagsWrap.className = "task-tags";
                task.tags.forEach(tag => {
                    const pill = document.createElement("span");
                    pill.className = "task-tag " + tagColorClass(tag);
                    pill.textContent = tag;
                    tagsWrap.appendChild(pill);
                });
            }

            // 3-puntjes menu enkel voor editors/owners
            let menuBtn = null;
            let menu = null;
            if (editable) {
                menuBtn = document.createElement("button");
                menuBtn.className = "roadmap-menu-btn";
                menuBtn.textContent = "⋯";

                menu = document.createElement("div");
                menu.className = "roadmap-menu";

                const renameItem = document.createElement("button");
                const deleteItem = document.createElement("button");

                renameItem.className = "menu-item";
                deleteItem.className = "menu-item";

                renameItem.textContent = "Rename";
                deleteItem.textContent = "Delete";
                deleteItem.style.color = "red";

                menu.appendChild(renameItem);
                menu.appendChild(deleteItem);

                // delete via menu
                deleteItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openDeleteTaskModal(task.id, columnName);
                    menu.classList.remove("open");
                });

                // rename via menu
                renameItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openRenameTaskModal(task.id, columnName);
                    menu.classList.remove("open");
                });

                menuBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    document.querySelectorAll(".roadmap-menu").forEach(m => {
                        if (m !== menu) m.classList.remove("open");
                    });
                    menu.classList.toggle("open");
                });

                // ctrl click = delete, shift click = rename
                taskCard.addEventListener("click", (e) => {
                    if (e.ctrlKey) {
                        openDeleteTaskModal(task.id, columnName);
                        return;
                    }
                    if (e.shiftKey) {
                        openRenameTaskModal(task.id, columnName);
                        return;
                    }
                });

                // drag events
                taskCard.addEventListener("dragstart", dragStart);
                taskCard.addEventListener("dragend", dragEnd);
            }

            if (menu) taskCard.appendChild(menu);
            taskCard.appendChild(title);
            if (menuBtn) taskCard.appendChild(menuBtn);
            taskCard.appendChild(desc);
            if (tagsWrap) taskCard.appendChild(tagsWrap);
            tasksList.appendChild(taskCard);
        });

        // update kolom count
        const count = columnDiv.querySelector(".column-count");
        count.textContent = roadmap.columns[columnName].length;

        // drag/drop events per kolom (alleen voor editors)
        if (editable) {
            tasksList.addEventListener("dragover", e => e.preventDefault());
            tasksList.addEventListener("drop", e => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData("text/plain");
                moveTask(cardId, columnName);
            });
        }
    });

    // add task buttons (alleen editors zien deze; bij viewers zijn ze verborgen)
    document.querySelectorAll(".btn-add-task").forEach(btn => {
        btn.onclick = () => {
            if (!canEdit()) return;
            selectedValue = btn.parentElement.dataset.column;
            taskModal.style.display = "flex"; // open create modal
        };
    });
}

// menu sluiten bij klik buiten (één keer globaal)
document.addEventListener("click", () => {
    document.querySelectorAll(".roadmap-menu")
        .forEach(m => m.classList.remove("open"));
});

function openRenameTaskModal(taskId, columnName) {
    if (!roadmap || !canEdit()) return;

    if (!roadmap.columns[columnName]) {
        console.error("Invalid column:", columnName);
        return;
    }

    const task = roadmap.columns[columnName].find(t => t.id === taskId);
    if (!task) {
        console.error("Task not found:", taskId, "in column", columnName);
        return;
    }

    taskToRenameId = taskId;
    taskToRenameColumn = columnName;

    renameModal.style.display = "flex"; // modal openen
    renameName.value = task.title;       // zet huidige naam
    renameDesc.value = task.text;        // zet huidige beschrijving
    if (renameTags) renameTags.value = (task.tags || []).join(", "); // huidige tags
}

// Rename task
async function renameTask() {
    if (taskToRenameId === null || !taskToRenameColumn || !canEdit()) return;

    const task = roadmap.columns[taskToRenameColumn].find(t => t.id === taskToRenameId);
    if (!task) return;

    const newTitle = renameName.value.trim();
    const newText = renameDesc.value.trim();

    if (newTitle === "") return; // verplicht titel

    await api.updateTask(roadmap.id, taskToRenameId, {
        title: newTitle,
        description: newText,
        tags: parseTags(renameTags ? renameTags.value : "")
    });

    // reset modal state
    renameModal.style.display = "none";
    taskToRenameId = null;
    taskToRenameColumn = null;

    await reloadTasks();
}

// bevestigen rename
renameBtn.addEventListener("click", renameTask);

// ===== DRAG & DROP =====
let draggedTaskId = null;

function dragStart(e) {
    draggedTaskId = e.target.dataset.id;
    e.dataTransfer.setData("text/plain", draggedTaskId);
    e.target.classList.add("dragging");
}

function dragEnd(e) {
    e.target.classList.remove("dragging");
}

// Bouw de reorder-payload op uit de huidige kolom-volgorde.
function buildReorderPayload() {
    const payload = [];
    COLUMN_KEYS.forEach(col => {
        roadmap.columns[col].forEach((t, index) => {
            payload.push({ id: t.id, column: col, position: index });
        });
    });
    return payload;
}

async function moveTask(taskId, newColumn) {
    if (!roadmap || !canEdit()) return;

    let task = null;

    // zoek en verwijder uit oude kolom
    for (let col in roadmap.columns) {
        const index = roadmap.columns[col].findIndex(t => t.id == taskId);
        if (index !== -1) {
            task = roadmap.columns[col].splice(index, 1)[0];
            break;
        }
    }

    if (!task) return;

    // voeg toe aan nieuwe kolom (onderaan)
    roadmap.columns[newColumn].push(task);

    // direct lokaal renderen voor een snappy gevoel...
    renderTasks();

    // ...en de nieuwe volgorde naar de server sturen
    try {
        const updated = await api.reorderTasks(roadmap.id, buildReorderPayload());
        if (updated) {
            roadmap.columns = tasksToColumns(updated);
            renderTasks();
        }
    } catch (err) {
        // bij fout: herlaad de echte staat van de server
        await reloadTasks();
    }
}

// ===== BUTTON EVENTS =====
createTaskBtn.addEventListener("click", () => {
    createTask(selectedValue, taskDesc.value, taskName.value, parseTags(taskTags ? taskTags.value : ""));
    taskModal.style.display = "none"; // sluit modal
    taskDesc.value = "";
    taskName.value = "";
    if (taskTags) taskTags.value = "";
});

cancelTaskBtn.addEventListener("click", () => {
    taskModal.style.display = "none"; // sluit modal
});

closeTaskModal.addEventListener("click", () => {
    taskModal.style.display = "none"; // sluit modal
});

// ===== RENAME MODAL SLUITEN =====
renameModal.addEventListener("click", (e) => {
    if (e.target === renameModal) renameModal.style.display = "none";
});

deleteTaskModal.addEventListener("click", (e) => {
    if (e.target === deleteTaskModal) deleteTaskModal.style.display = "none";
});

cancelRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});

closeRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});
