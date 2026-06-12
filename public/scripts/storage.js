// Mapping helpers that bridge the server's data shape (title/description/column/
// position) and the frontend's existing shape (name/desc/text + a columns object).
// Keeping the frontend shape intact means the rendering/drag-drop logic is unchanged.

// API roadmap -> dashboard list item.
export function roadmapFromApi(r) {
    return {
        id: r.id,
        name: r.title,
        desc: r.description || "",
        role: r.role,
        counts: r.counts || { planned: 0, in_progress: 0, testing: 0, released: 0, total: 0 }
    };
}

// API task -> frontend task card object.
export function taskFromApi(t) {
    return {
        id: t.id,
        title: t.title,
        text: t.description || "",
        tags: Array.isArray(t.tags) ? t.tags : [],
        position: t.position
    };
}

// The four board columns, in order. Keys match the DB / data-column attributes.
export const COLUMN_KEYS = ["planned", "in_progress", "testing", "released"];

// Flat list of API tasks -> { planned: [], in_progress: [], testing: [], released: [] }
// ordered by position.
export function tasksToColumns(tasks) {
    const columns = { planned: [], in_progress: [], testing: [], released: [] };
    [...tasks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(t => {
            const col = columns[t.column] ? t.column : "planned";
            columns[col].push(taskFromApi(t));
        });
    return columns;
}

// Deterministically map a tag name to one of the pill colour classes (tag-c0..7)
// so the same tag always gets the same colour, like the reference design.
export function tagColorClass(tag) {
    let hash = 0;
    const s = String(tag).toLowerCase();
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return "tag-c" + (hash % 8);
}
