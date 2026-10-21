import type { Board, Element, Page } from './model';
import { contentBounds } from './render';
export function download(data: Blob, name: string) { const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function svg(es: Element[], bg: string) { const b = contentBounds(es); let body = ''; for (const e of es) {
    const a = e.points[0], z = e.points.at(-1)!, x = Math.min(a.x, z.x), y = Math.min(a.y, z.y), w = Math.abs(a.x - z.x), h = Math.abs(a.y - z.y), style = `fill="none" stroke="${esc(e.color)}" stroke-width="${e.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${e.type === 'highlighter' ? .28 : 1}"`;
    if (e.type === 'text')
        body += `<text x="${a.x}" y="${a.y}" dominant-baseline="hanging" fill="${esc(e.color)}" text-anchor="${e.align === 'center' ? 'middle' : e.align === 'right' ? 'end' : 'start'}" font-family="sans-serif" font-size="${e.width}">${(e.text || '').split('\n').map((t, i) => `<tspan x="${a.x}" dy="${i ? e.width * 1.3 : 0}">${esc(t)}</tspan>`).join('')}</text>`;
    else if (e.type === 'image')
        body += `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${e.image}"/>`;
    else if (['rectangle', 'rounded'].includes(e.type))
        body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${e.type === 'rounded' ? 16 : 0}" ${style}/>`;
    else if (['ellipse', 'circle'].includes(e.type))
        body += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${style}/>`;
    else if (e.type === 'highlighter') {
        body += `<polyline points="${e.points.map(p => `${p.x},${p.y}`).join(' ')}" ${style}/>`;
    }
    else if (e.type === 'pen') {
        body += '<g>';
        if (e.points.length === 1)
            body += `<circle cx="${a.x}" cy="${a.y}" r="${e.width / 2}" fill="${esc(e.color)}"/>`;
        for (let i = 1; i < e.points.length; i++) {
            const p = e.points[i - 1], q = e.points[i];
            body += `<path d="M ${p.x} ${p.y} L ${q.x} ${q.y}" stroke="${esc(e.color)}" stroke-width="${e.width * (.5 + (p.p + q.p) / 2)}" stroke-linecap="round"/>`;
        }
        body += '</g>';
    }
    else {
        let ps = e.points.map(p => `${p.x},${p.y}`);
        if (e.type === 'triangle')
            ps = [`${x + w / 2},${y}`, `${x + w},${y + h}`, `${x},${y + h}`, `${x + w / 2},${y}`];
        if (e.type === 'arrow') {
            const t = Math.atan2(z.y - a.y, z.x - a.x), l = Math.max(12, e.width * 4);
            ps.push(`${z.x - l * Math.cos(t - .45)},${z.y - l * Math.sin(t - .45)}`, `${z.x},${z.y}`, `${z.x - l * Math.cos(t + .45)},${z.y - l * Math.sin(t + .45)}`);
        }
        body += `<polyline points="${ps.join(' ')}" ${style}/>`;
    }
} return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${b.w}" height="${b.h}">${bg ? `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${esc(bg)}"/>` : ''}${body}</svg>`; }
export function svgAsync(elements:Element[],background:string):Promise<string>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./export.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{svg?:string;error?:string}>)=>{worker.terminate();if(event.data.error)reject(Error(event.data.error));else resolve(event.data.svg!)};
  worker.onerror=()=>{worker.terminate();reject(Error('Export worker failed. Try a smaller page.'))};
  worker.postMessage({elements,background});
 });
}
export async function exportPage(p: Page, format: string, bg: string, scale: number, name: string) {
    const source = await svgAsync(p.elements, bg);
    if (format === 'svg') {
        download(new Blob([source], { type: 'image/svg+xml' }), name + '.svg');
        return;
    }
    const b = contentBounds(p.elements), c = document.createElement('canvas'), s = Math.min(scale, 8192 / Math.max(b.w, b.h), Math.sqrt(32000000 / (b.w * b.h)));
    c.width = Math.ceil(b.w * s);
    c.height = Math.ceil(b.h * s);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    try {
        const im = new Image();
        await new Promise<void>((resolve, reject) => { im.onload = () => resolve(); im.onerror = () => reject(Error('Unable to render export')); im.src = url; });
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        await new Promise<void>((resolve, reject) => c.toBlob(blob => { if (!blob) {
            reject(Error('Unable to create PNG'));
            return;
        } download(blob, name + '.png'); resolve(); }));
    }
    finally {
        URL.revokeObjectURL(url);
        c.width = c.height = 0;
    }
}
export async function pdf(b: Board, all: boolean, bg: string, size: 'a4' | 'letter' = 'a4') { const { jsPDF } = await import('jspdf'); const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: size }); const pages = all ? b.pages : b.pages.filter(p => p.id === b.active); for (const [index,p] of pages.entries()) { if (index)
    doc.addPage(); const box = contentBounds(p.elements), s = Math.min((doc.internal.pageSize.getWidth() - 60) / box.w, (doc.internal.pageSize.getHeight() - 60) / box.h), tx = (x: number) => 30 + (x - box.x) * s, ty = (y: number) => 30 + (y - box.y) * s; if (bg) {
    doc.setFillColor(bg);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
} for (const [elementIndex,e] of p.elements.entries()) {
 if(elementIndex%250===0)await new Promise(resolve=>setTimeout(resolve,0));
    doc.setDrawColor(e.color);
    doc.setTextColor(e.color);
    doc.setLineWidth(e.width * s);
    doc.setLineCap('round');
    doc.setLineJoin('round');
    const a = e.points[0], z = e.points.at(-1)!, x = tx(Math.min(a.x, z.x)), y = ty(Math.min(a.y, z.y)), w = Math.abs(a.x - z.x) * s, h = Math.abs(a.y - z.y) * s;
    if (e.type === 'text') {
        doc.setFontSize(e.width * s);
        doc.text(e.text || '', tx(a.x), ty(a.y) + e.width * s, { align: e.align === 'center' ? 'center' : e.align === 'right' ? 'right' : 'left' });
    }
    else if (e.type === 'image')
        doc.addImage(e.image!, 'PNG', x, y, w, h);
    else if (['ellipse', 'circle'].includes(e.type))
        doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
    else if (e.type === 'rectangle')
        doc.rect(x, y, w, h);
    else if (e.type === 'rounded')
        doc.roundedRect(x, y, w, h, 8 * s, 8 * s);
    else if (e.type === 'triangle')
        doc.triangle(x + w / 2, y, x + w, y + h, x, y + h);
    else {
        doc.setGState(doc.GState({ opacity: e.type === 'highlighter' ? .28 : 1 }));
        if (e.points.length === 1) {
            doc.setFillColor(e.color);
            doc.circle(tx(a.x), ty(a.y), e.width * s / 2, 'F');
        }
        if(e.type==='highlighter'&&e.points.length>1){doc.lines(e.points.slice(1).map((pt,i)=>[(pt.x-e.points[i].x)*s,(pt.y-e.points[i].y)*s]),tx(a.x),ty(a.y),[1,1],'S',false)}
        for (let i = 1; e.type!=='highlighter' && i < e.points.length; i++) {
            doc.setLineWidth(e.width * s * (e.type === 'pen' ? (.5 + (e.points[i - 1].p + e.points[i].p) / 2) : 1));
            doc.line(tx(e.points[i - 1].x), ty(e.points[i - 1].y), tx(e.points[i].x), ty(e.points[i].y));
        }
        if (e.type === 'arrow') {
            const t = Math.atan2(z.y - a.y, z.x - a.x), l = Math.max(12, e.width * 4);
            for (const d of [-.45, .45])
                doc.line(tx(z.x), ty(z.y), tx(z.x - l * Math.cos(t + d)), ty(z.y - l * Math.sin(t + d)));
        }
        doc.setGState(doc.GState({ opacity: 1 }));
    }
} } doc.save(b.name + '.pdf'); }
