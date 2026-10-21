import { useEffect, useRef } from 'react';
import { bounds, hit, move, uid, world, zoom, type Element, type Page, type Point, type Tool } from './model';
import { draw, visible } from './render';
export type CanvasApi = {
    redraw: () => void;
};
type Props = {
    page: Page;
    tool: Tool;
    color: string;
    width: number;
    smoothing: number;
    grid: string;
    background: string;
    selected: Set<string>;
    precision: boolean;
    onChange: (before: Element[]) => void;
    onSelect: (ids: Set<string>) => void;
    onCamera: () => void;
    onText: (p: Point, e?: Element) => void;
    api: React.RefObject<CanvasApi | null>;
};
export function Canvas(props: Props) {
    const base = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null), latest = useRef(props);
    latest.current = props;
    useEffect(() => {
        const canvas = base.current!, top = overlay.current!;
        let frame = 0, dpr = 1, W = 0, H = 0, space = false, baseDirty = true, drawn = 0;
        let action = '', start: Point = { x: 0, y: 0, p: .5 }, last = start, draft: Element | undefined, before: Element[] = [], original: Element[] = [], startCamera = { ...latest.current.page.camera }, activePointer = -1;
        const touches = new Map<number, Point>();
        let pinch: {
            distance: number;
            center: Point;
        } | null = null;
        function schedule(full = true) { baseDirty ||= full; if (!frame)
            frame = requestAnimationFrame(render); }
        const invalidate = () => schedule();
        function render() {
            frame = 0;
            const p = latest.current, c = p.page.camera, ctx = canvas.getContext('2d')!, over = top.getContext('2d')!;
            if (baseDirty) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, W, H);
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.scale(c.z, c.z);
                for (const e of p.page.elements)
                    if (visible(e, c, W, H))
                        draw(ctx, e, invalidate);
                ctx.restore();
                baseDirty = false;
            }
            const incremental = draft?.type === 'pen' && drawn > 0;
            over.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (!incremental)
                over.clearRect(0, 0, W, H);
            over.save();
            over.translate(c.x, c.y);
            over.scale(c.z, c.z);
            if (draft) {
                draw(over, incremental ? { ...draft, points: draft.points.slice(drawn - 1) } : draft);
                drawn = draft.points.length;
            }
            over.strokeStyle = '#a5b4fc';
            over.lineWidth = 1 / c.z;
            if (!draft)
                for (const e of p.page.elements)
                    if (p.selected.has(e.id)) {
                        const b = bounds(e);
                        over.strokeRect(b.x - 5 / c.z, b.y - 5 / c.z, b.w + 10 / c.z, b.h + 10 / c.z);
                        over.fillStyle = '#a5b4fc';
                        over.fillRect(b.x + b.w - 3 / c.z, b.y + b.h - 3 / c.z, 7 / c.z, 7 / c.z);
                    }
            if (action === 'marquee') {
                over.fillStyle = '#8b9cf81a';
                over.fillRect(start.x, start.y, last.x - start.x, last.y - start.y);
                over.strokeRect(start.x, start.y, last.x - start.x, last.y - start.y);
            }
            over.restore();
        }
        function resize() { W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2.5); for (const el of [canvas, top]) {
            el.width = W * dpr;
            el.height = H * dpr;
        } drawn = 0; invalidate(); }
        const point = (e: PointerEvent) => ({ ...world(e.clientX, e.clientY, latest.current.page.camera), p: e.pointerType === 'pen' ? Math.max(.1, e.pressure) : .5 });
        function erase(q: Point) {
            const p = latest.current, r = 12 / p.page.camera.z, next: Element[] = [];
            for (const el of p.page.elements) {
                if (!hit(el, q, r)) {
                    next.push(el);
                    continue;
                }
                if (p.precision && ['pen', 'highlighter'].includes(el.type)) {
                    let segment: Point[] = [];
                    for (let i = 0; i < el.points.length; i++) {
                        const pt = el.points[i], prev = el.points[i - 1];
                        const cut = Math.hypot(pt.x - q.x, pt.y - q.y) <= r || (prev && hit({ ...el, points: [prev, pt] }, q, r));
                        if (cut) {
                            if (segment.length)
                                next.push({ ...el, id: uid(), points: segment });
                            segment = [];
                        }
                        else
                            segment.push(pt);
                    }
                    if (segment.length)
                        next.push({ ...el, id: uid(), points: segment });
                }
            }
            p.page.elements = next;
            invalidate();
        }
        function down(e: PointerEvent) {
            const p = latest.current;
            if (e.button > 1)
                return;
            if (e.pointerType === 'touch') {
                if (activePointer !== -1 && !touches.size)
                    return;
                touches.set(e.pointerId, { x: e.clientX, y: e.clientY, p: .5 });
                top.setPointerCapture(e.pointerId);
                if (touches.size === 2) {
                    if (action === 'move' || action === 'erase' || action === 'resize')
                        p.page.elements = before;
                    draft = undefined;
                    drawn = 0;
                    action = '';
                    activePointer = -1;
                    const [a, b] = [...touches.values()];
                    pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: .5 } };
                    invalidate();
                }
                if (touches.size > 1)
                    return;
            }
            if (activePointer !== -1)
                return;
            activePointer = e.pointerId;
            top.setPointerCapture(e.pointerId);
            start = last = point(e);
            before = p.page.elements;
            original = before;
            startCamera = { ...p.page.camera };
            drawn = 0;
            if (space || p.tool === 'pan' || e.button === 1) {
                action = 'pan';
                start = { x: e.clientX, y: e.clientY, p: .5 };
                return;
            }
            if (p.tool === 'text') {
                p.onText(start);
                activePointer = -1;
                return;
            }
            if (p.tool === 'eraser') {
                action = 'erase';
                erase(start);
                return;
            }
            if (p.tool === 'select') {
                const selected = before.filter(el => p.selected.has(el.id));
                if (selected.length === 1) {
                    const b = bounds(selected[0]);
                    if (Math.hypot(start.x - b.x - b.w, start.y - b.y - b.h) < 12 / p.page.camera.z) {
                        action = 'resize';
                        return;
                    }
                }
                const found = [...before].reverse().find(el => hit(el, start, 8 / p.page.camera.z));
                if (found) {
                    const ids = e.shiftKey || p.selected.has(found.id) ? new Set(p.selected) : new Set<string>();
                    ids.add(found.id);
                    p.onSelect(ids);
                    action = 'move';
                }
                else {
                    p.onSelect(new Set());
                    action = 'marquee';
                }
                invalidate();
                return;
            }
            action = 'draw';
            draft = { id: uid(), type: p.tool, color: p.color, width: p.width, points: [start] };
            schedule(false);
        }
        function motion(e: PointerEvent) {
            const p = latest.current;
            if (touches.has(e.pointerId))
                touches.set(e.pointerId, { x: e.clientX, y: e.clientY, p: .5 });
            if (touches.size === 2 && pinch) {
                const [a, b] = [...touches.values()], distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: .5 };
                p.page.camera = zoom(p.page.camera, pinch.center.x, pinch.center.y, distance / pinch.distance);
                p.page.camera.x += center.x - pinch.center.x;
                p.page.camera.y += center.y - pinch.center.y;
                pinch = { distance, center };
                p.onCamera();
                invalidate();
                return;
            }
            if (e.pointerId !== activePointer)
                return;
            const previous=last;last = point(e);
            if (action === 'pan') {
                p.page.camera = { ...startCamera, x: startCamera.x + e.clientX - start.x, y: startCamera.y + e.clientY - start.y };
                p.onCamera();
                invalidate();
            }
            else if (action === 'draw' && draft) {
                if (['pen', 'highlighter'].includes(draft.type)) {
                    const coalesced = e.getCoalescedEvents?.(), events = coalesced?.length ? coalesced : [e];
                    for (const ev of events) {
                        const q = point(ev), prev = draft.points.at(-1)!;
                        if (Math.hypot(q.x - prev.x, q.y - prev.y) > .25 / p.page.camera.z) {
                            const t = 1 - p.smoothing * .55;
                            draft.points.push({ ...q, x: prev.x + (q.x - prev.x) * t, y: prev.y + (q.y - prev.y) * t });
                        }
                    }
                }
                else {
                    let q = last;
                    if (e.shiftKey || draft.type === 'circle') {
                        const d = Math.max(Math.abs(q.x - start.x), Math.abs(q.y - start.y));
                        q = { ...q, x: start.x + (Math.sign(q.x - start.x) || 1) * d, y: start.y + (Math.sign(q.y - start.y) || 1) * d };
                    }
                    draft.points = [start, q];
                }
                schedule(false);
            }
            else if (action === 'erase') {const steps=Math.max(1,Math.ceil(Math.hypot(last.x-previous.x,last.y-previous.y)/(6/p.page.camera.z)));for(let i=1;i<=steps;i++)erase({x:previous.x+(last.x-previous.x)*i/steps,y:previous.y+(last.y-previous.y)*i/steps,p:.5})}
            else if (action === 'move') {
                p.page.elements = original.map(el => p.selected.has(el.id) ? move(el, last.x - start.x, last.y - start.y) : el);
                invalidate();
            }
            else if (action === 'resize') {
                p.page.elements = original.map(el => { if (!p.selected.has(el.id))
                    return el; const b = bounds(el); let sx = Math.max(.05, (last.x - b.x) / b.w), sy = Math.max(.05, (last.y - b.y) / b.h); if (e.shiftKey)
                    sx = sy = Math.max(sx, sy); return { ...el, width: el.type === 'text' ? el.width * sy : el.width, points: el.points.map(pt => ({ ...pt, x: b.x + (pt.x - b.x) * sx, y: b.y + (pt.y - b.y) * sy })) }; });
                invalidate();
            }
            else if (action === 'marquee')
                schedule(false);
        }
        function up(e: PointerEvent) {
            touches.delete(e.pointerId);
            if (touches.size < 2)
                pinch = null;
            if (e.pointerId !== activePointer)
                return;
            const p = latest.current;
            if (e.type === 'pointercancel') {
                p.page.elements = before;
                draft = undefined;
            }
            else {
                if (draft) {
                    p.page.elements = [...p.page.elements, draft];
                    draft = undefined;
                }
                if (action === 'marquee') {
                    const x = Math.min(start.x, last.x), y = Math.min(start.y, last.y), w = Math.abs(start.x - last.x), h = Math.abs(start.y - last.y);
                    p.onSelect(new Set(p.page.elements.filter(el => { const b = bounds(el); return b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h; }).map(el => el.id)));
                }
                if (['draw', 'erase', 'move', 'resize'].includes(action))
                    p.onChange(before);
            }
            activePointer = -1;
            action = '';
            drawn = 0;
            invalidate();
        }
        function wheel(e: WheelEvent) { e.preventDefault(); if (activePointer !== -1)
            return; const p = latest.current; if (e.ctrlKey || e.metaKey)
            p.page.camera = zoom(p.page.camera, e.clientX, e.clientY, Math.exp(-e.deltaY * .008));
        else {
            p.page.camera.x -= e.deltaX;
            p.page.camera.y -= e.deltaY;
        } p.onCamera(); invalidate(); }
        function key(e: KeyboardEvent) { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
            space = e.type === 'keydown';
            e.preventDefault();
        } }
        function blur() { space = false; }
        function dbl(e: MouseEvent) { const p = latest.current, q = world(e.clientX, e.clientY, p.page.camera), el = [...p.page.elements].reverse().find(el => el.type === 'text' && hit(el, q)); if (el)
            p.onText(q, el); }
        top.addEventListener('pointerdown', down);
        top.addEventListener('pointermove', motion);
        top.addEventListener('pointerup', up);
        top.addEventListener('pointercancel', up);
        top.addEventListener('wheel', wheel, { passive: false });
        top.addEventListener('dblclick', dbl);
        window.addEventListener('resize', resize);
        window.addEventListener('keydown', key);
        window.addEventListener('keyup', key);
        window.addEventListener('blur', blur);
        latest.current.api.current = { redraw: invalidate };
        resize();
        return () => { cancelAnimationFrame(frame); top.removeEventListener('pointerdown', down); top.removeEventListener('pointermove', motion); top.removeEventListener('pointerup', up); top.removeEventListener('pointercancel', up); top.removeEventListener('wheel', wheel); top.removeEventListener('dblclick', dbl); window.removeEventListener('resize', resize); window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur); canvas.width = top.width = 0; };
    }, []);
    useEffect(() => { props.api.current?.redraw(); });
    return <div className="drawing-surface" style={{ background: props.background }}><div className={'grid ' + props.grid} style={{ backgroundSize: `${24 * props.page.camera.z}px ${24 * props.page.camera.z}px`, backgroundPosition: `${props.page.camera.x}px ${props.page.camera.y}px` }}/><canvas ref={base}/><canvas ref={overlay} aria-label="Whiteboard drawing canvas" className={'input-canvas tool-' + props.tool}/></div>;
}
