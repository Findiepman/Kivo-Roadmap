import { state } from './state.js';

export function saveRoadmaps() {
    localStorage.setItem("roadmaps", JSON.stringify(state.roadmaps));
}

export function loadRoadmaps() {
    const stored = localStorage.getItem("roadmaps");
    state.roadmaps = stored ? JSON.parse(stored) : [];
}