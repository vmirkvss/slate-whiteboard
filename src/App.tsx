import { useEffect, useRef, useState } from 'react';
import { MousePointer2, PenLine, Highlighter, Eraser, Hand, Minus, ArrowUpRight, Square, Circle, Triangle, Type, ImagePlus, Undo2, Redo2, ChevronDown, Plus, Sun, Moon, Download, Settings2, Maximize2, Minimize2, Scan, MoreHorizontal, Check, Trash2, Copy, ArrowLeft, ArrowRight, X, FolderOpen, Command, BookOpen, PanelLeftClose, PanelLeftOpen, HelpCircle, Layers, ArrowDownToLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Canvas, type CanvasApi } from './Canvas';
import { board, page, uid, History, move, bounds, zoom, validate, type Board, type Element, type Point, type Tool } from './model';
import * as storage from './storage';
import { contentBounds } from './render';
import './style.css';
const tools: [
    Tool,
    LucideIcon,
    string,
    string
][] = [['select', MousePointer2, 'Select', 'V'], ['pan', Hand, 'Hand', 'Space'], ['pen', PenLine, 'Pen', 'P'], ['highlighter', Highlighter, 'Highlighter', 'H'], ['eraser', Eraser, 'Eraser', 'E'], ['line', Minus, 'Line', 'L'], ['arrow', ArrowUpRight, 'Arrow', 'A'], ['rectangle', Square, 'Rectangle', 'R'], ['ellipse', Circle, 'Ellipse', 'O'], ['text', Type, 'Text', 'T']];
const colors = ['#eeeef2', '#1c2028', '#a4b0ff', '#ff8f95', '#91cbb2', '#efd58a', '#c4a0ed'];
function IconButton({ icon: Icon, label, onClick, active = false, disabled = false }: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}) { return <button className={'icon-button ' + (active ? 'active' : '')} title={label} aria-label={label} onClick={onClick} disabled={disabled}><Icon size={18} strokeWidth={1.65}/></button>; }
export default function App() {
    const [doc, setDoc] = useState<Board>(board), [ready, setReady] = useState(false), [revision, refresh] = useState(0), [tool, setTool] = useState<Tool>('pen'), [color, setColor] = useState('#a4b0ff'), [width, setWidth] = useState(()=>Number(localStorage.getItem('slate-width')||3)), [selected, setSelected] = useState(new Set<string>()), [panel, setPanel] = useState(''), [library, setLibrary] = useState<Board[]>([]), [status, setStatus] = useState('Saved locally'), [light, setLight] = useState(() => localStorage.getItem('slate-theme') === 'light'), [grid, setGrid] = useState(() => localStorage.getItem('slate-grid') || 'dots'), [background, setBackground] = useState(() => localStorage.getItem('slate-background') || ''), [smoothing, setSmoothing] = useState(() => Number(localStorage.getItem('slate-smoothing') || .35)), [precision, setPrecision] = useState(false), [present, setPresent] = useState(false), [pagesOpen, setPagesOpen] = useState(true), [scale, setScale] = useState(() => Number(localStorage.getItem('slate-scale') || 2)), [transparent, setTransparent] = useState(false), [allPages, setAllPages] = useState(true), [paper, setPaper] = useState<'a4' | 'letter'>('a4'), [busy, setBusy] = useState(false), [textEdit, setTextEdit] = useState<{
        point: Point;
        element?: Element;
        value: string;
    } | null>(null), [notice, setNotice] = useState('');
    const api = useRef<CanvasApi | null>(null), histories = useRef(new Map<string, History>()), docRef = useRef(doc), file = useRef<HTMLInputElement>(null), native = useRef<HTMLInputElement>(null), clipboard = useRef<Element[]>([]);
    docRef.current = doc;
    const current = doc.pages.find(p => p.id === doc.active)!, bg = background || (light ? '#f7f7f4' : '#17191d');
    const history = () => { let h = histories.current.get(current.id); if (!h) {
        h = new History();
        histories.current.set(current.id, h);
    } return h; };
    const changed = (before?: Element[]) => { if (before)
        history().push(before); doc.updated = Date.now(); refresh(n => n + 1); api.current?.redraw(); };
    const edit = (es: Element[]) => { const before = current.elements; current.elements = es; changed(before); };
    const undo = (redo = false) => { current.elements = redo ? history().redo(current.elements) : history().undo(current.elements); setSelected(new Set()); changed(); };
    const message = (s: string) => { setNotice(s); setTimeout(() => setNotice(''), 4000); };
    useEffect(() => { storage.list().then(bs => { if (bs.length)
        setDoc(bs[0]); setReady(true); }).catch(() => { setReady(true); setStatus('Storage unavailable — export a backup'); }); }, []);
    useEffect(() => { if (!ready)
        return; let active=true; setStatus('Saving…'); const timer = setTimeout(() => { storage.save(docRef.current).then(() => {if(active)setStatus('Saved locally')}).catch(() => {if(active)setStatus('Save failed — export a backup')}); }, 500); return () => {active=false;clearTimeout(timer)}; }, [doc, revision, ready]);
    useEffect(() => { const visibility = () => { if (document.hidden && ready)
        void storage.save(docRef.current).catch(() => setStatus('Save failed — export a backup')); }; document.addEventListener('visibilitychange', visibility); return () => document.removeEventListener('visibilitychange', visibility); }, [ready]);
    useEffect(() => { localStorage.setItem('slate-theme', light ? 'light' : 'dark'); localStorage.setItem('slate-grid', grid); localStorage.setItem('slate-background', background); localStorage.setItem('slate-smoothing', String(smoothing)); localStorage.setItem('slate-scale', String(scale)); localStorage.setItem('slate-width',String(width)); }, [light, grid, background, smoothing, scale, width]);
    useEffect(() => { const sync = () => { if (!document.fullscreenElement)
        setPresent(false); }; document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
    useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(status!=='Saved locally'){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[status]);
    const presets = useRef<Partial<Record<Tool, {
        color: string;
        width: number;
    }>>>({});
    const choose = (t: Tool) => { presets.current[tool] = { color, width }; setTool(t); const saved = presets.current[t]; setColor(saved?.color || color); setWidth(saved?.width || (t === 'highlighter' ? 18 : t === 'text' ? 28 : 3)); };
    const duplicate = () => { const es = current.elements.filter(e => selected.has(e.id)).map(e => ({ ...move(e, 20, 20), id: uid() })); edit([...current.elements, ...es]); setSelected(new Set(es.map(e => e.id))); };
    const deleteSelection = () => { edit(current.elements.filter(e => !selected.has(e.id))); setSelected(new Set()); };
    const fit = () => { const b = contentBounds(current.elements), z = Math.max(.1, Math.min(2, (innerWidth - 200) / b.w, (innerHeight - 220) / b.h)); current.camera = { z, x: (innerWidth - b.w * z) / 2 - b.x * z, y: (innerHeight - b.h * z) / 2 - b.y * z }; changed(); };
    const addPage = () => { const p = page(`Page ${doc.pages.length + 1}`); doc.pages.push(p); doc.active = p.id; setSelected(new Set()); changed(); };
    const presentation = () => { setPresent(p => !p); if (!present)
        document.documentElement.requestFullscreen?.().catch(() => { });
    else if (document.fullscreenElement)
        void document.exitFullscreen(); };
    useEffect(() => { const key = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
        return; const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(); if (cmd && ['z', 's', 'd', 'c', 'v', 'a'].includes(k)) {
        if (k !== 'v' || clipboard.current.length)
            e.preventDefault();
        if (k === 'z')
            undo(e.shiftKey);
        if (k === 's')
            storage.save(doc).then(() => message('All changes saved')).catch(() => message('Save failed. Export a backup.'));
        if (k === 'd')
            duplicate();
        if (k === 'a')
            setSelected(new Set(current.elements.map(e => e.id)));
        if (k === 'c')
            clipboard.current = structuredClone(current.elements.filter(e => selected.has(e.id)));
        if (k === 'v' && clipboard.current.length) {
            const es = clipboard.current.map(e => ({ ...move(e, 24, 24), id: uid() }));
            edit([...current.elements, ...es]);
            setSelected(new Set(es.map(e => e.id)));
        }
    }
    else if (!cmd) {
        const t = tools.find(t => t[3].toLowerCase() === k);
        if (t)
            choose(t[0]);
        if (k === 'delete' || k === 'backspace') {
            e.preventDefault();
            deleteSelection();
        }
        if (k === 'escape') {
            setTextEdit(null);
            setSelected(new Set());
            setPanel('');
            setPresent(false);
            if (document.fullscreenElement)
                void document.exitFullscreen();
        }
        if (k === 'f')
            presentation();
        if (k === '?')
            setPanel('help');
    } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
    const importImage = async (f: File) => { if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
        message('Choose a PNG, JPEG, or WebP image.');
        return;
    } if (f.size > 20 * 1024 * 1024) {
        message('Please choose an image smaller than 20 MB.');
        return;
    } try {
        const bitmap = await createImageBitmap(f), s = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height)), c = document.createElement('canvas');
        c.width = bitmap.width * s;
        c.height = bitmap.height * s;
        c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
        bitmap.close();
        const x = (innerWidth / 2 - current.camera.x) / current.camera.z, y = (innerHeight / 2 - current.camera.y) / current.camera.z, w = Math.min(600, c.width), h = w * c.height / c.width;
        const el: Element = { id: uid(), type: 'image', color: '#fff', width: 1, image: c.toDataURL('image/png'), points: [{ x: x - w / 2, y: y - h / 2, p: .5 }, { x: x + w / 2, y: y + h / 2, p: .5 }] };
        edit([...current.elements, el]);
        setSelected(new Set([el.id]));
        setTool('select');
    }
    catch {
        message('This image could not be opened.');
    } };
    useEffect(() => { const paste = (e: ClipboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return; const f = [...(e.clipboardData?.files || [])][0]; if (f) {
        e.preventDefault();
        void importImage(f);
    } }; window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste); });
    const exportFile = async (format: string) => { setBusy(true); try {
        const ex = await import('./export');
        if (format === 'slate')
            ex.download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), doc.name + '.slate');
        else if (format === 'pdf')
            await ex.pdf(doc, allPages, bg, paper);
        else
            await ex.exportPage(current, format, transparent ? '' : bg, scale, doc.name);
        message('Your export is ready');
    }
    catch (e) {
        message(e instanceof Error ? e.message : 'Export failed');
    }
    finally {
        setBusy(false);
    } };
    const openLibrary = async () => { try {
        await storage.save(doc);
        setLibrary(await storage.list());
        setPanel('library');
    }
    catch {
        message('Unable to open local library');
    } };
    if (!ready)
        return <div className="loading">Opening your whiteboard…</div>;
    return <main className={(light ? 'light ' : '') + (present ? 'present' : '')} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0])
        void importImage(e.dataTransfer.files[0]); }}>
    <Canvas key={current.id} api={api} page={current} tool={tool} color={color} width={width} smoothing={smoothing} precision={precision} grid={grid} background={bg} selected={selected} onSelect={setSelected} onChange={changed} onCamera={() => changed()} onText={(point, element) => setTextEdit({ point, element, value: element?.text || '' })}/>
    <header className="topbar"><div className="brand" onClick={() => void openLibrary()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && void openLibrary()}><div className="brand-mark"><span /><span /><span /></div><span>slate<span className="brand-dot">.</span></span></div><div className="header-divider"/><div className="document-title"><input aria-label="Whiteboard title" value={doc.name} onChange={e => { doc.name = e.target.value; changed(); }}/><button aria-label="Open board library" onClick={() => void openLibrary()}><ChevronDown size={14}/></button></div><span className="save-status"><span />{status}</span><div className="top-actions"><IconButton icon={light ? Moon : Sun} label="Toggle theme" onClick={() => setLight(!light)}/><IconButton icon={Maximize2} label="Presentation mode (F)" onClick={presentation}/><span className="header-divider"/><button className="export-button" onClick={() => setPanel(panel === 'export' ? '' : 'export')}><Download size={15}/> Export <ChevronDown size={12}/></button><IconButton icon={Settings2} label="Settings" onClick={() => setPanel(panel === 'settings' ? '' : 'settings')}/></div></header>
    <div className="toolbar-wrap"><div className="toolbar">{tools.map(([t, Icon, label, key], i) => <span className={'tool-slot ' + (i === 2 || i === 5 || i === 9 ? 'separated' : '')} key={t}><button aria-label={label} className={'tool ' + (tool === t ? 'chosen' : '')} onClick={() => choose(t)} title={`${label} (${key})`}><Icon size={20} strokeWidth={1.65}/><small>{key === 'Space' ? '' : key}</small></button></span>)}<span className="tool-slot separated"><IconButton icon={ImagePlus} label="Import image" onClick={() => file.current?.click()}/></span></div><div className="tool-options"><div className="swatches">{colors.map(c => <button key={c} title={c} aria-label={`Color ${c}`} className={color === c ? 'selected' : ''} style={{ '--swatch': c } as React.CSSProperties} onClick={() => { setColor(c); if (selected.size)
        edit(current.elements.map(e => selected.has(e.id) ? { ...e, color: c } : e)); }}/>)}<label className="custom-color" title="Custom color"><Plus size={12}/><input aria-label="Custom color" type="color" value={color} onChange={e => { setColor(e.target.value); if (selected.size)
        edit(current.elements.map(el => selected.has(el.id) ? { ...el, color: e.target.value } : el)); }}/></label></div><span className="options-divider"/>{[1.5, 3, 6].map((n, i) => <button className={'weight ' + (width === n ? 'active' : '')} key={n} aria-label={['Fine pen', 'Normal pen', 'Thick pen'][i]} onClick={() => { setWidth(n); if (selected.size)
        edit(current.elements.map(e => selected.has(e.id) ? { ...e, width: n } : e)); }}><span style={{ height: n + 1, width: n + 1 }}/></button>)}<button className="options-more" aria-label="More tool options" onClick={() => setPanel(panel === 'tool' ? '' : 'tool')}><MoreHorizontal size={18}/></button></div></div>
    {current.elements.length === 0 && <div className="empty-state"><div className="empty-symbol">a<span>²</span> + b<span>²</span></div><h1>Good ideas start here.</h1><p>A blank canvas. A little curiosity.<br />Make room for your next lightbulb moment.</p><div><PenLine size={13}/> Pick up your pen and make your mark</div></div>}
    <aside className={'pages-panel ' + (!pagesOpen ? 'collapsed' : '')}><div className="pages-heading"><span><Layers size={14}/> LESSON PAGES <b>{doc.pages.length.toString().padStart(2, '0')}</b></span><IconButton icon={PanelLeftClose} label="Collapse pages" onClick={() => setPagesOpen(false)}/></div><div className="page-list">{doc.pages.map((p, i) => <div key={p.id} className={'page-item ' + (p.id === current.id ? 'current' : '')}><button className="page-select" onClick={() => { doc.active = p.id; setSelected(new Set()); changed(); }}><div className="page-preview"><span>{p.elements.length ? `${p.elements.length} marks` : 'Aa'}</span><i>{String(i + 1).padStart(2, '0')}</i></div><div><span className="page-number">{String(i + 1).padStart(2, '0')}</span><span>{p.name.replace(/^\d+ · /, '')}</span></div></button><button className="page-menu" aria-label={`Options for ${p.name}`} onClick={() => { if (p.id !== current.id) {
        doc.active = p.id;
        changed();
    } setPanel('page'); }}><MoreHorizontal size={14}/></button></div>)}</div><button className="add-page" onClick={addPage}><Plus size={15}/> New page <span>↵</span></button><div className="local-note"><span className="local-dot"/> Yours. Saved on this device.</div></aside>
    {!pagesOpen && <button className="open-pages floating" onClick={() => setPagesOpen(true)}><PanelLeftOpen size={17}/> Pages <span>{doc.pages.length}</span></button>}
    <div className="bottom-left"><div className="history-controls floating"><IconButton icon={Undo2} label="Undo (⌘Z)" disabled={!history().past.length} onClick={() => undo()}/><IconButton icon={Redo2} label="Redo (⌘⇧Z)" disabled={!history().future.length} onClick={() => undo(true)}/></div><span className="canvas-hint">{tool === 'pen' ? 'Pen down. Ideas out.' : tools.find(t => t[0] === tool)?.[2] || tool} <span>·</span> Space to pan</span></div>
    <div className="bottom-right"><button className="help-button" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={() => setPanel('help')}><HelpCircle size={18}/></button><div className="zoom-controls floating"><IconButton icon={Minus} label="Zoom out" onClick={() => { current.camera = zoom(current.camera, innerWidth / 2, innerHeight / 2, .8); changed(); }}/><button className="zoom-percent" onClick={() => { current.camera = { x: 0, y: 0, z: 1 }; changed(); }} title="Reset view">{Math.round(current.camera.z * 100)}<span>%</span></button><IconButton icon={Plus} label="Zoom in" onClick={() => { current.camera = zoom(current.camera, innerWidth / 2, innerHeight / 2, 1.25); changed(); }}/><span className="options-divider"/><IconButton icon={Scan} label="Fit to content" onClick={fit}/></div></div>
    {present && <button className="exit-present floating" onClick={presentation}><Minimize2 size={16}/> Exit teaching mode <kbd>Esc</kbd></button>}
    {selected.size > 0 && <div className="selection-bar floating"><span>{selected.size} selected</span><IconButton icon={Copy} label="Duplicate selection" onClick={duplicate}/><IconButton icon={Trash2} label="Delete selection" onClick={deleteSelection}/></div>}
    <input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={file} onChange={e => { if (e.target.files?.[0])
        void importImage(e.target.files[0]); e.target.value = ''; }}/><input type="file" accept=".slate,.json" hidden ref={native} onChange={async (e) => { try {
        const f = e.target.files?.[0];
        if (!f)
            return;
        if (f.size > 40 * 1024 * 1024)
            throw Error('File exceeds 40 MB.');
        const b = validate(JSON.parse(await f.text()));
        b.id = uid();
        await storage.save(doc);
        setDoc(b);
        histories.current.clear();
        setSelected(new Set());
        setPanel('');
        message('Lesson imported');
    }
    catch (err) {
        message(err instanceof Error ? err.message : 'Import failed');
    } if (native.current)
        native.current.value = ''; }}/>
        {panel && <><div className="dismiss-panel" onClick={() => setPanel('')}/><section className={'popover ' + (['library', 'help'].includes(panel) ? 'modal-panel' : '')} aria-label={panel + ' panel'}><div className="popover-title"><span>{({ export: 'Export your lesson', settings: 'Make it yours', tool: 'Tool options', page: 'Page options', library: 'Your whiteboards', help: 'A few useful shortcuts' } as Record<string, string>)[panel]}</span><IconButton icon={X} label="Close panel" onClick={() => setPanel('')}/></div>
        {panel === 'export' && <><p className="muted">Thoughts worth keeping. Notes worth sharing.</p><label>Resolution<select value={scale} onChange={e => setScale(+e.target.value)}><option value={1}>1× · Standard</option><option value={2}>2× · High resolution</option><option value={3}>3× · Print quality</option></select></label><label className="check-label"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)}/> Transparent background (PNG / SVG)</label><label>PDF paper<select value={paper} onChange={e => setPaper(e.target.value as 'a4' | 'letter')}><option value="a4">A4 landscape</option><option value="letter">Letter landscape</option></select></label><label className="check-label"><input type="checkbox" checked={allPages} onChange={e => setAllPages(e.target.checked)}/> Include all pages in PDF</label><div className="export-grid">{['png', 'svg', 'pdf', 'slate'].map(f => <button key={f} disabled={busy} onClick={() => void exportFile(f)}><ArrowDownToLine size={18}/><strong>{f === 'slate' ? 'Slate file' : f.toUpperCase()}</strong><small>{f === 'slate' ? 'Editable backup' : f === 'pdf' ? 'Lesson handout' : f === 'svg' ? 'Scalable vector' : 'High-quality image'}</small></button>)}</div>{busy && <p className="muted">Preparing export…</p>}</>}
        {panel === 'settings' && <><label>Appearance<select value={light ? 'light' : 'dark'} onChange={e => setLight(e.target.value === 'light')}><option value="dark">Dark · After hours</option><option value="light">Light · Daylight</option></select></label><label>Canvas pattern<select value={grid} onChange={e => setGrid(e.target.value)}><option value="dots">Subtle dots</option><option value="squares">Square grid</option><option value="none">Blank canvas</option></select></label><label>Canvas color<input type="color" value={bg} onChange={e => setBackground(e.target.value)}/></label><div className="inline-actions"><button onClick={() => setBackground('#ffffff')}>Blank white</button><button onClick={() => setBackground('#17191d')}>Blank dark</button></div><label>Pen smoothing <span>{Math.round(smoothing * 100)}%</span><input type="range" min="0" max="1" step=".05" value={smoothing} onChange={e => setSmoothing(+e.target.value)}/></label><label className="check-label"><input type="checkbox" checked={pagesOpen} onChange={e => setPagesOpen(e.target.checked)}/> Show lesson pages</label><button className="menu-row" onClick={() => { setLight(false); setGrid('dots'); setBackground(''); setSmoothing(.35); setWidth(3); }}>Restore defaults</button><button className="menu-row danger" onClick={() => { if (confirm('Clear every object on this page? You can undo this action.'))
            edit([]); setPanel(''); }}><Trash2 size={15}/> Clear current page</button></>}
        {panel === 'tool' && <><label>Stroke / font size <input type="number" min="1" max="200" value={width} onChange={e => { const n = Math.max(1, Math.min(200, +e.target.value)); setWidth(n); if (selected.size)
            edit(current.elements.map(el => selected.has(el.id) ? { ...el, width: n } : el)); }}/></label><label>Eraser mode<select value={precision ? 'precision' : 'stroke'} onChange={e => setPrecision(e.target.value === 'precision')}><option value="stroke">Whole stroke</option><option value="precision">Precision · freehand portions</option></select></label><label>More shapes<select value={['rounded', 'circle', 'triangle'].includes(tool) ? tool : ''} onChange={e => { choose(e.target.value as Tool); setPanel(''); }}><option value="" disabled>Choose a shape</option><option value="rounded">Rounded rectangle</option><option value="circle">Circle</option><option value="triangle">Triangle</option></select></label></>}
        {panel === 'page' && <><label>Page name<input value={current.name} onChange={e => { current.name = e.target.value; changed(); }}/></label><button className="menu-row" onClick={() => { const p = { ...structuredClone(current), id: uid(), name: current.name + ' copy' }; doc.pages.splice(doc.pages.indexOf(current) + 1, 0, p); doc.active = p.id; changed(); setPanel(''); }}><Copy size={16}/> Duplicate page</button><div className="inline-actions"><button disabled={doc.pages.indexOf(current) === 0} onClick={() => { const i = doc.pages.indexOf(current); [doc.pages[i - 1], doc.pages[i]] = [doc.pages[i], doc.pages[i - 1]]; changed(); }}><ArrowLeft size={14}/> Move earlier</button><button disabled={doc.pages.indexOf(current) === doc.pages.length - 1} onClick={() => { const i = doc.pages.indexOf(current); [doc.pages[i + 1], doc.pages[i]] = [doc.pages[i], doc.pages[i + 1]]; changed(); }}>Move later <ArrowRight size={14}/></button></div><button className="menu-row danger" disabled={doc.pages.length === 1} onClick={() => { if (confirm('Delete this lesson page? Export a backup first if you need it.')) {
            doc.pages = doc.pages.filter(p => p.id !== current.id);
            doc.active = doc.pages[0].id;
            changed();
            setPanel('');
        } }}><Trash2 size={16}/> Delete page</button></>}
        {panel === 'library' && <><p className="muted">Your next great explanation is one page away.</p><div className="inline-actions"><button className="primary" onClick={() => { setDoc(board()); histories.current.clear(); setSelected(new Set()); setPanel(''); }}><Plus size={16}/> New whiteboard</button><button onClick={() => native.current?.click()}><FolderOpen size={16}/> Import lesson</button></div><div className="board-list">{library.map(b => <div key={b.id}><button onClick={() => { setDoc(b); histories.current.clear(); setSelected(new Set()); setPanel(''); }}><BookOpen size={20}/><span><strong>{b.name}</strong><small>{b.pages.length} {b.pages.length === 1 ? 'page' : 'pages'} · {new Date(b.updated).toLocaleDateString()}</small></span>{b.id === doc.id && <Check size={15}/>}</button><IconButton icon={Copy} label={'Duplicate ' + b.name} onClick={async () => { const copy = { ...structuredClone(b), id: uid(), name: b.name + ' copy', updated: Date.now() }; await storage.save(copy); setLibrary(await storage.list()); }}/><IconButton icon={Trash2} label={'Delete ' + b.name} onClick={async () => { if (confirm('Permanently delete this whiteboard?')) {
            await storage.remove(b.id);
            if (b.id === doc.id)
                setDoc(board());
            setLibrary(await storage.list());
        } }}/></div>)}</div><p className="muted">Stored in this browser. Export a Slate file for a portable backup.</p></>}
        {panel === 'help' && <><p className="muted">Less reaching. More teaching.</p><div className="shortcut-list">{tools.filter(t => t[0] !== 'pan').map(t => <div key={t[0]}><span>{t[2]}</span><kbd>{t[3]}</kbd></div>)}{[['Pan', 'Space + drag'], ['Zoom', 'Ctrl / ⌘ + scroll'], ['Undo', '⌘ / Ctrl + Z'], ['Redo', '⌘ / Ctrl + Shift + Z'], ['Duplicate', '⌘ / Ctrl + D'], ['Copy / paste', '⌘ / Ctrl + C / V'], ['Select all', '⌘ / Ctrl + A'], ['Teaching mode', 'F'], ['Exit / deselect', 'Esc']].map(([a, b]) => <div key={a}><span>{a}</span><kbd>{b}</kbd></div>)}</div></>}
        </section></>}
    {textEdit && <div className="modal-backdrop"><section className="text-modal"><h2>{textEdit.element ? 'Edit text' : 'A thought, in words.'}</h2><textarea autoFocus aria-label="Text content" placeholder="Write something…" value={textEdit.value} onChange={e => setTextEdit({ ...textEdit, value: e.target.value })}/><label className="text-alignment">Alignment <select aria-label="Text alignment" value={textEdit.element?.align || 'left'} onChange={e => setTextEdit({ ...textEdit, element: { id: uid(), type: 'text', color, width: Math.max(20, width), points: [textEdit.point], ...textEdit.element, align: e.target.value as CanvasTextAlign } })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><div className="inline-actions"><button onClick={() => setTextEdit(null)}>Cancel</button><button className="primary" onClick={() => { if (textEdit.value.trim()) {
        const el: Element = { id: textEdit.element?.id || uid(), type: 'text', color: textEdit.element?.color || color, width: textEdit.element?.width || Math.max(20, width), points: [textEdit.element?.points[0] || textEdit.point], text: textEdit.value, align: textEdit.element?.align };
        edit(textEdit.element && current.elements.some(e => e.id === textEdit.element?.id) ? current.elements.map(e => e.id === el.id ? el : e) : [...current.elements, el]);
    } setTextEdit(null); }}>Place text <Check size={15}/></button></div></section></div>}
    {notice && <div className="toast"><Check size={15}/>{notice}</div>}
    </main>;
}
