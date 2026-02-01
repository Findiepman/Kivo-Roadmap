import { state } from "./state.js";
import { saveRoadmaps, loadRoadmaps } from "./storage.js";

// ===== DOM ELEMENTEN =====
const roadMapTitle = document.getElementById("roadmap-title"); // titel van de roadmap
const taskModal = document.getElementById("create-task-modal"); // taak modal
const cancelTaskBtn = document.getElementById("cancel-task-btn"); // annuleren knop
const createTaskBtn = document.getElementById("create-task-btn"); // aanmaken knop
const closeTaskModal = document.getElementById("close-task-modal"); // sluit knop modal
const taskName = document.getElementById("task-name"); // input taak naam
const taskDesc = document.getElementById("task-desc"); // input taak beschrijving
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
const renameBtn = document.getElementById("rename-btn");
const cancelRenameBtn = document.getElementById("cancel-rename-btn");
const closeRenameBtn = document.getElementById("close-rename-modal");

// ===== STATE VARIABELEN =====
let taskToDeleteId = null; // taak id voor delete
let taskToDeleteColumn = null; // kolom van taak voor delete
let roadmap = null; // huidige roadmap
let selectedValue = "todo"; // default column
let taskToRenameId = null;
let taskToRenameColumn = null;
const options = customSelect.querySelectorAll(".options li"); // dropdown opties

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

const allowedPages = ["dashboard.html", "index.html"]; // pagina whitelist

// ===== INIT ROADMAP PAGINA =====
function initRoadmapPage() {
    loadRoadmaps(); // laad alle roadmaps

    const currentPage = window.location.pathname.split("/").pop();
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const roadmapId = idParam ? Number(idParam) : null;

    // whitelist check
    if (allowedPages.includes(currentPage)) return;

    // check id
    if (!roadmapId) {
        window.location.href = "404.html";
        return;
    }

    // zoek roadmap in state
    const found = state.roadmaps.find(r => r.id === roadmapId);

    if (!found) {
        window.location.href = "404.html";
        return;
    }

    roadmap = found; // zet globale roadmap
    renderTasks(); // render tasks
}

// pagina load
initRoadmapPage();

// ===== CREATE TASK =====
function createTask(column, text, title) {
    if (!roadmap) return;

    if (!["todo", "doing", "done"].includes(column)) return; // check column

    roadmap.columns[column].push({
        id: Date.now(),
        title,
        text
    });

    saveRoadmaps();
    renderTasks();
}

// ===== DELETE TASK =====
function deleteTask(taskId, columnName) {
    if (!roadmap) return;
    if (!roadmap.columns[columnName]) return;

    roadmap.columns[columnName] = roadmap.columns[columnName].filter(
        task => task.id !== taskId
    );

    saveRoadmaps();
    renderTasks();
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
    if (taskToDeleteId && taskToDeleteColumn) {
        deleteTask(taskToDeleteId, taskToDeleteColumn); // verwijder taak
    }
    closeDeleteTaskModal();
});

// ===== RENDER TASKS =====
function renderTasks() {
    if (!roadmap) return;

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
            taskCard.setAttribute("draggable", "true");
            taskCard.dataset.id = task.id;
            if (columnName === "done") taskCard.classList.add("done");

            const title = document.createElement("div");
            title.className = "task-title";
            title.textContent = task.title;

            const desc = document.createElement("div");
            desc.className = "task-description";
            desc.textContent = task.text;

            // 3-puntjes menu knop
            const menuBtn = document.createElement("button");
            menuBtn.className = "roadmap-menu-btn";
            menuBtn.textContent = "⋯";

            // dropdown menu
            const menu = document.createElement("div");
            menu.className = "roadmap-menu";

            const renameBtn = document.createElement("button");
            const deleteBtn = document.createElement("button");

            renameBtn.className = "menu-item";
            deleteBtn.className = "menu-item";

            renameBtn.textContent = "Rename";
            deleteBtn.textContent = "Delete";
            deleteBtn.style.color = "red";

            menu.appendChild(renameBtn);
            menu.appendChild(deleteBtn);

            // delete via menu
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openDeleteTaskModal(task.id, columnName);
                menu.classList.remove("open");
            });

            // rename via menu
            renameBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openRenameTaskModal(task.id, columnName);
                menu.classList.remove("open");
            });
            renameModal.addEventListener("click", (e) => {
                if (e.target === renameModal) renameModal.style.display = "none";
            });
            deleteTaskModal.addEventListener("click", (e) => {
                if (e.target === deleteTaskModal) deleteTaskModal.style.display = "none";
            });
            // ctrl click = delete modal
            taskCard.addEventListener("click", (e) => {
                if (e.ctrlKey) {
                    openDeleteTaskModal(task.id, columnName);
                    return;
                }
                if (e.shiftKey) {
                    openRenameTaskModal(task.id, columnName); // columnName uit loop gebruiken
                    return;
                }
            });
            menuBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".roadmap-menu").forEach(m => {
                    if (m !== menu) m.classList.remove("open");
                });
                menu.classList.toggle("open");
            });
            // menu sluiten bij klik buiten
            document.addEventListener("click", () => {
                document.querySelectorAll(".roadmap-menu")
                    .forEach(m => m.classList.remove("open"));
            });

            // drag events
            taskCard.addEventListener("dragstart", dragStart);
            taskCard.addEventListener("dragend", dragEnd);
            taskCard.appendChild(menu)
            taskCard.appendChild(title);
            taskCard.appendChild(menuBtn)
            taskCard.appendChild(desc);
            tasksList.appendChild(taskCard);
        });

        // update kolom count
        const count = columnDiv.querySelector(".column-count");
        count.textContent = roadmap.columns[columnName].length;

        // drag/drop events per kolom
        tasksList.addEventListener("dragover", e => e.preventDefault());
        tasksList.addEventListener("drop", e => {
            const cardId = e.dataTransfer.getData("text/plain");
            moveTask(cardId, columnName);
        });
    });

    // add task buttons
    document.querySelectorAll(".btn-add-task").forEach(btn => {
        btn.onclick = () => {
            selectedValue = btn.parentElement.dataset.column;
            taskModal.style.display = "flex"; // open create modal
        };
    });
}
function openRenameTaskModal(taskId, columnName) {
    // check of roadmap geladen is
    if (!roadmap) return;

    // check of kolom bestaat
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
}

// Rename task
function renameTask() {
    if (!taskToRenameId || !taskToRenameColumn) return;

    const task = roadmap.columns[taskToRenameColumn].find(t => t.id === taskToRenameId);
    if (!task) return;

    const newTitle = renameName.value.trim();
    const newText = renameDesc.value.trim();

    if (newTitle === "") return; // verplicht titel

    task.title = newTitle;
    task.text = newText;

    saveRoadmaps();
    renderTasks(); // update de taak lijst

    // reset modal state
    renameModal.style.display = "none";
    taskToRenameId = null;
    taskToRenameColumn = null;
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

function moveTask(taskId, newColumn) {
    if (!roadmap) return;

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

    // voeg toe aan nieuwe kolom
    roadmap.columns[newColumn].push(task);
    saveRoadmaps();
    renderTasks();
}

// ===== BUTTON EVENTS =====
createTaskBtn.addEventListener("click", () => {
    createTask(selectedValue, taskDesc.value, taskName.value);
    taskModal.style.display = "none"; // sluit modal
    taskDesc.value = "";
    taskName.value = "";
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

cancelRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});

closeRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});
