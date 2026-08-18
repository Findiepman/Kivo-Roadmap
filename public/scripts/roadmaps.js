import { tasksToGroups, tagColorClass, STATUS_KEYS, STATUS_LABELS } from "./storage.js";
import { api } from "./api.js";

// "Economy, Mining" -> ["Economy", "Mining"]
function parseTags(value) {
    return String(value || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
}

// ===== DOM =====
const roadmapTitle = document.getElementById("roadmap-title");
const roadmapMeta = document.getElementById("roadmap-meta");
const memberStack = document.getElementById("member-stack");
const addTaskBtn = document.getElementById("add-task-btn");

// task modal
const taskModal = document.getElementById("task-modal");
const taskModalTitle = document.getElementById("task-modal-title");
const closeTaskModalBtn = document.getElementById("close-task-modal");
const cancelTaskBtn = document.getElementById("cancel-task-btn");
const saveTaskBtn = document.getElementById("save-task-btn");
const deleteTaskBtn = document.getElementById("delete-task-btn");
const taskName = document.getElementById("task-name");
const taskDesc = document.getElementById("task-desc");
const taskTags = document.getElementById("task-tags");
const taskError = document.getElementById("task-error");
const statusSeg = document.getElementById("task-status-seg");
const assigneesGroup = document.getElementById("assignees-group");
const assigneePicker = document.getElementById("task-assignees");

// delete confirmation modal
const deleteTaskModal = document.getElementById("delete-task-modal");
const closeDeleteTaskBtn = document.getElementById("close-delete-task-modal");
const cancelDeleteTaskBtn = document.getElementById("cancel-delete-task-btn");
const confirmDeleteTaskBtn = document.getElementById("confirm-delete-task-btn");

// ===== STATE =====
let roadmap = null;      // { id, name, desc, role, groups }
let members = [];        // [{ id, username, role }]
let editingTaskId = null; // null = the modal is creating a new task
let modalStatus = "planned";
let taskToDeleteId = null;

function canEdit() {
    return roadmap && (roadmap.role === "owner" || roadmap.role === "editor");
}

function openModal(m) { m.classList.add("open"); }
function closeModal(m) { m.classList.remove("open"); }

// ===== INIT =====
async function initRoadmapPage() {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const roadmapId = idParam ? Number(idParam) : null;

    if (!roadmapId) {
        window.location.href = "404.html";
        return;
    }

    let meta;
    try {
        meta = await api.getRoadmap(roadmapId);
    } catch (err) {
        window.location.href = "404.html";
        return;
    }
    if (!meta) return; // 401 redirect already underway

    const [tasks, memberList] = await Promise.all([
        api.getTasks(roadmapId).catch(() => []),
        api.getMembers(roadmapId).catch(() => [])
    ]);

    roadmap = {
        id: meta.id,
        name: meta.title,
        desc: meta.description || "",
        role: meta.role,
        groups: tasksToGroups(tasks)
    };
    members = memberList || [];

    applyRoleUI();
    renderHeader();
    renderTasks();
}

function applyRoleUI() {
    if (canEdit()) return;
    addTaskBtn.style.display = "none";
    const right = document.querySelector(".topbar-right");
    if (right && !document.querySelector(".read-only-badge")) {
        const badge = document.createElement("span");
        badge.className = "read-only-badge";
        badge.textContent = "View only";
        right.appendChild(badge);
    }
}

function renderHeader() {
    roadmapTitle.textContent = roadmap.name;
    document.title = `${roadmap.name} - Kivo`;
    roadmapMeta.textContent = roadmap.desc;

    memberStack.innerHTML = "";
    members.slice(0, 6).forEach(m => {
        const a = document.createElement("span");
        a.className = "avatar";
        a.textContent = (m.username || "?").charAt(0);
        a.title = m.username;
        memberStack.appendChild(a);
    });
    if (members.length > 6) {
        const more = document.createElement("span");
        more.className = "avatar";
        more.textContent = `+${members.length - 6}`;
        memberStack.appendChild(more);
    }
}

// ===== RENDER TASKS =====
function renderTasks() {
    STATUS_KEYS.forEach(status => {
        const rows = document.getElementById(`rows-${status}`);
        const empty = document.getElementById(`empty-${status}`);
        const count = document.getElementById(`count-${status}`);
        const tasks = roadmap.groups[status] || [];

        rows.innerHTML = "";
        count.textContent = tasks.length;
        empty.style.display = tasks.length === 0 ? "block" : "none";

        tasks.forEach(task => rows.appendChild(buildTaskRow(task)));
    });
}

function buildTaskRow(task) {
    const row = document.createElement("div");
    row.className = `task-row ${task.status}`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Open task ${task.title}`);

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.title;
    row.appendChild(name);

    if (task.tags.length) {
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

    // assignee avatars
    if (task.assignees.length) {
        const stack = document.createElement("span");
        stack.className = "avatar-stack";
        task.assignees.slice(0, 4).forEach(a => {
            const av = document.createElement("span");
            av.className = "avatar";
            av.textContent = (a.username || "?").charAt(0);
            av.title = a.username;
            stack.appendChild(av);
        });
        right.appendChild(stack);
    }

    // status pill with a quick-change menu
    const pillWrap = document.createElement("span");
    pillWrap.className = "menu-wrap";

    const pill = document.createElement("button");
    pill.className = `status-pill status-${task.status}`;
    pill.setAttribute("aria-label", `Change status of ${task.title}`);
    const dot = document.createElement("span");
    dot.className = "dot";
    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(STATUS_LABELS[task.status]));
    pillWrap.appendChild(pill);

    if (canEdit()) {
        const menu = document.createElement("div");
        menu.className = "menu status-menu";
        STATUS_KEYS.forEach(status => {
            const item = document.createElement("button");
            item.className = "menu-item";
            item.textContent = STATUS_LABELS[status];
            if (status === task.status) item.style.fontWeight = "800";
            item.addEventListener("click", async (e) => {
                e.stopPropagation();
                menu.classList.remove("open");
                if (status === task.status) return;
                await api.updateTask(roadmap.id, task.id, { status });
                await reloadTasks();
            });
            menu.appendChild(item);
        });
        pillWrap.appendChild(menu);

        pill.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".menu").forEach(m => {
                if (m !== menu) m.classList.remove("open");
            });
            menu.classList.toggle("open");
        });
    } else {
        pill.disabled = true;
        pill.style.cursor = "default";
    }

    right.appendChild(pillWrap);
    row.appendChild(right);

    row.addEventListener("click", () => openTaskModal(task));
    row.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openTaskModal(task);
    });

    return row;
}

// close menus on outside click
document.addEventListener("click", () => {
    document.querySelectorAll(".menu").forEach(m => m.classList.remove("open"));
});

// ===== TASK MODAL =====
function setModalStatus(status) {
    modalStatus = status;
    statusSeg.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.status === status);
    });
}

statusSeg.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
        if (!canEdit()) return;
        setModalStatus(btn.dataset.status);
    });
});

function renderAssigneePicker(selectedIds) {
    assigneePicker.innerHTML = "";

    if (members.length <= 1) {
        // solo roadmap: nothing to assign, hide the picker entirely
        assigneesGroup.style.display = "none";
        return;
    }
    assigneesGroup.style.display = "flex";

    members.forEach(m => {
        const chip = document.createElement("label");
        chip.className = "assignee-chip";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = m.id;
        input.checked = selectedIds.includes(m.id);
        input.disabled = !canEdit();
        if (input.checked) chip.classList.add("selected");

        input.addEventListener("change", () => {
            chip.classList.toggle("selected", input.checked);
        });

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = (m.username || "?").charAt(0);

        chip.appendChild(input);
        chip.appendChild(avatar);
        chip.appendChild(document.createTextNode(m.username));
        assigneePicker.appendChild(chip);
    });
}

function selectedAssigneeIds() {
    return [...assigneePicker.querySelectorAll("input:checked")].map(i => Number(i.value));
}

function setModalEditable(editable) {
    taskName.disabled = !editable;
    taskDesc.disabled = !editable;
    taskTags.disabled = !editable;
    saveTaskBtn.style.display = editable ? "inline-flex" : "none";
    cancelTaskBtn.textContent = editable ? "Cancel" : "Close";
}

// open for creating
function openCreateModal() {
    if (!canEdit()) return;
    editingTaskId = null;
    taskModalTitle.textContent = "New task";
    taskName.value = "";
    taskDesc.value = "";
    taskTags.value = "";
    taskError.textContent = "";
    deleteTaskBtn.style.display = "none";
    saveTaskBtn.textContent = "Add task";
    setModalStatus("planned");
    renderAssigneePicker([]);
    setModalEditable(true);
    openModal(taskModal);
    taskName.focus();
}

// open for viewing/editing an existing task
function openTaskModal(task) {
    editingTaskId = task.id;
    taskModalTitle.textContent = canEdit() ? "Edit task" : "Task details";
    taskName.value = task.title;
    taskDesc.value = task.text;
    taskTags.value = task.tags.join(", ");
    taskError.textContent = "";
    deleteTaskBtn.style.display = canEdit() ? "inline-flex" : "none";
    saveTaskBtn.textContent = "Save changes";
    setModalStatus(task.status);
    renderAssigneePicker(task.assignees.map(a => a.id));
    setModalEditable(canEdit());
    openModal(taskModal);
}

addTaskBtn.addEventListener("click", openCreateModal);

saveTaskBtn.addEventListener("click", async () => {
    if (!canEdit()) return;
    taskError.textContent = "";

    const title = taskName.value.trim();
    if (!title) {
        taskError.textContent = "Give the task a name";
        return;
    }

    const payload = {
        title,
        description: taskDesc.value.trim(),
        status: modalStatus,
        tags: parseTags(taskTags.value),
        assignees: selectedAssigneeIds()
    };

    try {
        if (editingTaskId === null) {
            await api.createTask(roadmap.id, payload);
        } else {
            await api.updateTask(roadmap.id, editingTaskId, payload);
        }
        closeModal(taskModal);
        await reloadTasks();
    } catch (err) {
        taskError.textContent = err.error || "Could not save the task";
    }
});

closeTaskModalBtn.addEventListener("click", () => closeModal(taskModal));
cancelTaskBtn.addEventListener("click", () => closeModal(taskModal));
taskModal.addEventListener("click", (e) => {
    if (e.target === taskModal) closeModal(taskModal);
});

// ===== DELETE TASK =====
deleteTaskBtn.addEventListener("click", () => {
    if (editingTaskId === null) return;
    taskToDeleteId = editingTaskId;
    openModal(deleteTaskModal);
});

confirmDeleteTaskBtn.addEventListener("click", async () => {
    if (taskToDeleteId === null) return;
    const id = taskToDeleteId;
    taskToDeleteId = null;
    closeModal(deleteTaskModal);
    closeModal(taskModal);
    await api.deleteTask(roadmap.id, id);
    await reloadTasks();
});

closeDeleteTaskBtn.addEventListener("click", () => closeModal(deleteTaskModal));
cancelDeleteTaskBtn.addEventListener("click", () => closeModal(deleteTaskModal));
deleteTaskModal.addEventListener("click", (e) => {
    if (e.target === deleteTaskModal) closeModal(deleteTaskModal);
});

// ===== DATA =====
async function reloadTasks() {
    if (!roadmap) return;
    const tasks = await api.getTasks(roadmap.id);
    roadmap.groups = tasksToGroups(tasks);
    renderTasks();
}

initRoadmapPage();
