import {test} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
test('profile large lessons',async({page})=>{
 await page.goto('/');await page.getByText('Saved locally',{exact:true}).waitFor();
 const results=await page.evaluate(async()=>{
  // Vite serves these source modules only in development; the benchmark is not shipped.
  const model=await import(/* @vite-ignore */ '/src/model.ts');
  const renderer=await import(/* @vite-ignore */ '/src/render.ts');
  const storage=await import(/* @vite-ignore */ '/src/storage.ts');
  const exporter=await import(/* @vite-ignore */ '/src/export.ts');
  const c=document.createElement('canvas');c.width=1440;c.height=1000;const ctx=c.getContext('2d')!;
  const rows=[];
  for(const count of [100,1000,5000,10000]){
   const b=model.board();b.name='Benchmark';b.pages[0].elements=Array.from({length:count},(_,i)=>({id:String(i),type:'pen',color:'#a4b0ff',width:3,points:Array.from({length:24},(_,j)=>({x:(i%100)*50+j*2,y:Math.floor(i/100)*30+Math.sin(j/3)*10,p:.5}))}));
   const es=b.pages[0].elements,measure=(fn:()=>void)=>{const t=performance.now();fn();return +(performance.now()-t).toFixed(2)};
   const initial=measure(()=>es.forEach((e:Parameters<typeof renderer.draw>[1])=>renderer.visible(e,{x:0,y:0,z:1},1440,1000)&&renderer.draw(ctx,e)));
   const frames=[];for(let i=0;i<15;i++)frames.push(measure(()=>{ctx.clearRect(0,0,1440,1000);for(const e of es)if(renderer.visible(e,{x:-i*5,y:-i*3,z:1+i*.01},1440,1000))renderer.draw(ctx,e)}));
   const hit=measure(()=>es.filter((e:Parameters<typeof model.hit>[0])=>model.hit(e,{x:300,y:200,p:.5})));
   const t=performance.now();await storage.save(b);const save=+(performance.now()-t).toFixed(2);
   const svg=measure(()=>exporter.svg(es,''));await storage.remove(b.id);
   rows.push({strokes:count,initialRenderMs:initial,cameraRenderMeanMs:+(frames.reduce((a,b)=>a+b)/frames.length).toFixed(2),hitTestMs:hit,saveMs:save,svgMs:svg});
  }return {userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],devicePixelRatio,rows};
 });
 writeFileSync('benchmark-results.json',JSON.stringify({cpu:os.cpus()[0].model,ramGB:Math.round(os.totalmem()/1024**3),platform:os.platform(),...results},null,2));
 await page.screenshot({path:'slate-preview.png'});
});
