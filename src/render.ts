import { bounds, type Element, type Camera } from './model';
const images = new WeakMap<Element, HTMLImageElement>();
export function draw(ctx: CanvasRenderingContext2D, e: Element, invalidate?: () => void) { const a = e.points[0], b = e.points.at(-1)!; ctx.save(); ctx.strokeStyle = e.color; ctx.fillStyle = e.color; ctx.lineWidth = e.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (e.type === 'highlighter')
    ctx.globalAlpha = .28; ctx.beginPath(); const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y); switch (e.type) {
    case 'text':
        ctx.font = `${e.width}px "Inter", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = e.align || 'left';
        (e.text || '').split('\n').forEach((s, i) => ctx.fillText(s, a.x, a.y + i * e.width * 1.3));
        break;
    case 'image': {
        let im = images.get(e);
        if (!im) {
            im = new Image();
            im.src = e.image!;
            im.onload = () => invalidate?.();
            images.set(e, im);
        }
        if (im.complete)
            ctx.drawImage(im, x, y, w, h);
        break;
    }
    case 'rectangle':
        ctx.rect(x, y, w, h);
        ctx.stroke();
        break;
    case 'rounded':
        ctx.roundRect(x, y, w, h, Math.min(16, w / 4, h / 4));
        ctx.stroke();
        break;
    case 'ellipse':
    case 'circle':
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
    case 'triangle':
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.stroke();
        break;
    case 'highlighter':
        ctx.moveTo(a.x, a.y);
        for (const p of e.points.slice(1))
            ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
    case 'line':
    case 'arrow':
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (e.type === 'arrow') {
            const t = Math.atan2(b.y - a.y, b.x - a.x), l = Math.max(12, e.width * 4);
            ctx.moveTo(b.x - l * Math.cos(t - .45), b.y - l * Math.sin(t - .45));
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x - l * Math.cos(t + .45), b.y - l * Math.sin(t + .45));
        }
        ctx.stroke();
        break;
    default: if (e.points.length === 1) {
        ctx.arc(a.x, a.y, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        for (let i = 1; i < e.points.length; i++) {
            const p = e.points[i - 1], q = e.points[i];
            ctx.beginPath();
            ctx.lineWidth = e.width * (.5 + (p.p + q.p) / 2);
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
        }
    }
} ctx.restore(); }
export function visible(e: Element, c: Camera, w: number, h: number) { const b = bounds(e); return (b.x + b.w) * c.z + c.x > -20 && (b.y + b.h) * c.z + c.y > -20 && b.x * c.z + c.x < w + 20 && b.y * c.z + c.y < h + 20; }
export function contentBounds(es: Element[]) { if (!es.length)
    return { x: 0, y: 0, w: 1000, h: 700 }; const bs = es.map(e => { const b = bounds(e), pad = e.width + (e.type === 'arrow' ? 12 : 0); return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }; }), x = Math.min(...bs.map(b => b.x)) - 30, y = Math.min(...bs.map(b => b.y)) - 30; return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x + 30, h: Math.max(...bs.map(b => b.y + b.h)) - y + 30 }; }
