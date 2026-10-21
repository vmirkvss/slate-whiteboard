export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'pan' | 'line' | 'arrow' | 'rectangle' | 'rounded' | 'ellipse' | 'circle' | 'triangle' | 'text' | 'image';
export type Point = {
    x: number;
    y: number;
    p: number;
};
export type Element = {
    id: string;
    type: Tool;
    points: Point[];
    color: string;
    width: number;
    text?: string;
    image?: string;
    align?: CanvasTextAlign;
};
export type Camera = {
    x: number;
    y: number;
    z: number;
};
export type Page = {
    id: string;
    name: string;
    elements: Element[];
    camera: Camera;
};
export type Board = {
    version: 1;
    id: string;
    name: string;
    pages: Page[];
    active: string;
    updated: number;
};
export const uid = () => crypto.randomUUID();
export const page = (name = 'Untitled page'): Page => ({ id: uid(), name, elements: [], camera: { x: 0, y: 0, z: 1 } });
export function board(): Board { const p = page('01 · The big picture'); return { version: 1, id: uid(), name: 'A little room to think', pages: [p], active: p.id, updated: Date.now() }; }
export const world = (x: number, y: number, c: Camera): Point => ({ x: (x - c.x) / c.z, y: (y - c.y) / c.z, p: .5 });
export function zoom(c: Camera, x: number, y: number, f: number): Camera { const p = world(x, y, c), z = Math.max(.1, Math.min(8, c.z * f)); return { x: x - p.x * z, y: y - p.y * z, z }; }
type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
const boundCache = new WeakMap<Element, Box>();
export function bounds(e: Element): Box {
    const cached = boundCache.get(e);
    if (cached)
        return cached;
    let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
    for (const p of e.points) {
        x = Math.min(x, p.x);
        y = Math.min(y, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
    }
    let w = right - x, h = bottom - y;
    if (e.type === 'text') {
        w = Math.max(...(e.text || 'Text').split('\n').map(s => s.length)) * e.width * .65;
        h = (e.text || 'Text').split('\n').length * e.width * 1.3;
        if (e.align === 'center')
            x -= w / 2;
        if (e.align === 'right')
            x -= w;
    }
    const box = { x, y, w: Math.max(w, 1), h: Math.max(h, 1) };
    boundCache.set(e, box);
    return box;
}
export const move = (e: Element, dx: number, dy: number): Element => ({ ...e, points: e.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) });
export function hit(e: Element, p: Point, r = 7) { const b = bounds(e); if (p.x < b.x - r || p.x > b.x + b.w + r || p.y < b.y - r || p.y > b.y + b.h + r)
    return false; if (['text', 'image', 'rectangle', 'rounded', 'ellipse', 'circle', 'triangle'].includes(e.type))
    return true; return e.points.some((a, i) => { const b = e.points[i + 1] || a, dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < r + e.width / 2; }); }
export class History {
    past: Element[][] = [];
    future: Element[][] = [];
    push(es: Element[]) { this.past.push(es); if (this.past.length > 80)
        this.past.shift(); this.future = []; }
    undo(es: Element[]) { const p = this.past.pop(); if (!p)
        return es; this.future.push(es); return p; }
    redo(es: Element[]) { const p = this.future.pop(); if (!p)
        return es; this.past.push(es); return p; }
}
export function validate(value: unknown): Board { const b = value as Board; if (!b || typeof b !== 'object' || b.version !== 1 || typeof b.id !== 'string' || typeof b.name !== 'string' || !Array.isArray(b.pages) || !b.pages.length || b.pages.length > 200)
    throw Error('This is not a supported Slate document.'); let total = 0; const ids = new Set<string>(); for (const p of b.pages) {
    if (!p || ids.has(p.id))
        throw Error('Invalid or duplicate page.');
    ids.add(p.id);
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || !p.camera || ![p.camera.x, p.camera.y, p.camera.z].every(Number.isFinite) || p.camera.z < .1 || p.camera.z > 8 || !Array.isArray(p.elements))
        throw Error('Invalid page.');
    const elementIds = new Set<string>();
    for (const e of p.elements) {
        if (!e || elementIds.has(e.id))
            throw Error('Invalid or duplicate element.');
        elementIds.add(e.id);
        total += e.points?.length || 0;
        if (!['pen', 'highlighter', 'line', 'arrow', 'rectangle', 'rounded', 'ellipse', 'circle', 'triangle', 'text', 'image'].includes(e.type) || typeof e.id !== 'string' || typeof e.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(e.color) || !Number.isFinite(e.width) || e.width <= 0 || e.width > 1000 || !Array.isArray(e.points) || !e.points.length || !e.points.every(p => p && [p.x, p.y, p.p].every(Number.isFinite) && Math.abs(p.x) < 1e8 && Math.abs(p.y) < 1e8 && p.p >= 0 && p.p <= 1) || (e.type === 'text' && (typeof e.text !== 'string' || e.text.length > 100000)) || (e.align && !['left', 'center', 'right'].includes(e.align)) || (e.type === 'image' && typeof e.image !== 'string') || (e.image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(e.image)))
            throw Error('Invalid drawing element.');
    }
} if (total > 2000000 || !b.pages.some(p => p.id === b.active))
    throw Error('Document is too large or invalid.'); return b; }
