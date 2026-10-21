import {describe,it,expect} from 'vitest';
import {board,page,validate,world,zoom,History,hit,move,bounds,type Element} from '../src/model';
import {svg} from '../src/export';
const stroke:Element={id:'stroke',type:'pen',width:3,color:'#ffffff',points:[{x:10,y:20,p:.5},{x:100,y:100,p:.8}]};
describe('document and geometry',()=>{
 it('creates independent pages and validates a JSON round trip',()=>{const b=board();b.pages.push(page());b.pages[0].elements.push(stroke);expect(b.pages[1].elements).toEqual([]);expect(validate(JSON.parse(JSON.stringify(b)))).toEqual(b)});
 it('rejects unsupported versions, invalid coordinates and embedded content',()=>{const b=board();expect(()=>validate({...b,version:2})).toThrow();b.pages[0].elements=[{...stroke,points:[{x:Infinity,y:0,p:.5}]}];expect(()=>validate(b)).toThrow();b.pages[0].elements=[{...stroke,type:'image',image:'https://example.com/a.svg'}];expect(()=>validate(b)).toThrow()});
 it('transforms coordinates and holds the zoom anchor',()=>{const c={x:40,y:50,z:2};expect(world(100,150,c)).toEqual({x:30,y:50,p:.5});const next=zoom(c,100,150,2);expect(world(100,150,next)).toEqual(world(100,150,c));expect(zoom(c,0,0,100).z).toBe(8)});
 it('hit tests segments rather than only recorded points',()=>{expect(hit(stroke,{x:55,y:60,p:.5})).toBe(true);expect(hit(stroke,{x:12,y:95,p:.5},2)).toBe(false)});
 it('moves without changing originals and invalidates cached bounds',()=>{bounds(stroke);const moved=move(stroke,30,-10);expect(bounds(moved).x).toBe(40);expect(stroke.points[0].x).toBe(10)});
 it('undoes and redoes a whole stroke with bounded history',()=>{const h=new History();h.push([]);expect(h.undo([stroke])).toEqual([]);expect(h.redo([])).toEqual([stroke]);for(let i=0;i<100;i++)h.push([]);expect(h.past.length).toBe(80);h.push([stroke]);expect(h.future).toEqual([])});
 it('exports escaped vector text, pressure and single point strokes',()=>{const s=svg([stroke,{...stroke,id:'text',type:'text',text:'<script>&',width:20},{...stroke,id:'dot',points:[stroke.points[0]]}],'#17191d');expect(s).toContain('&lt;script&gt;&amp;');expect(s).toContain('stroke-width="3.4499999999999997"');expect(s).toContain('<circle');expect(s).toContain('viewBox=')});
});
