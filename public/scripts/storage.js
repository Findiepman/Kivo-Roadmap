// Mapping helpers that bridge the server's data shape and the frontend's
// rendering shape.

// The three task statuses, in display order.
export const STATUS_KEYS = ["planned", "in_progress", "finished"];

export const STATUS_LABELS = {
    planned: "Planned",
    in_progress: "In progress",
    finished: "Finished"
};

// API roadmap -> dashboard list item.
export function roadmapFromApi(r) {
    return {
        id: r.id,
        name: r.title,
        desc: r.description || "",
        role: r.role,
        memberCount: r.memberCount || 1,
        counts: r.counts || { planned: 0, in_progress: 0, finished: 0, total: 0 }
    };
}

// API task -> frontend task object.
export function taskFromApi(t) {
    return {
        id: t.id,
        title: t.title,
        text: t.description || "",
        status: t.status,
        tags: Array.isArray(t.tags) ? t.tags : [],
        assignees: Array.isArray(t.assignees) ? t.assignees : [],
        position: t.position
    };
}

// Flat list of API tasks -> { planned: [], in_progress: [], finished: [] }
// ordered by position.
export function tasksToGroups(tasks) {
    const groups = { planned: [], in_progress: [], finished: [] };
    [...tasks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(t => {
            const key = groups[t.status] ? t.status : "planned";
            groups[key].push(taskFromApi(t));
        });
    return groups;
}

// Deterministically map a tag name to one of the pill colour classes (tag-c0..7)
// so the same tag always gets the same colour.
export function tagColorClass(tag) {
    let hash = 0;
    const s = String(tag).toLowerCase();
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return "tag-c" + (hash % 8);
}
