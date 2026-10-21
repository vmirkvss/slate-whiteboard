import {test,expect} from '@playwright/test';
test('shape move and resize, theme and mobile layout',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.keyboard.press('r');await page.mouse.move(450,300);await page.mouse.down();await page.mouse.move(650,400);await page.mouse.up();
 await page.keyboard.press('v');await page.mouse.click(500,350);await expect(page.getByText('1 selected')).toBeVisible();
 await page.mouse.move(500,350);await page.mouse.down();await page.mouse.move(550,400);await page.mouse.up();
 await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(800,550);await page.mouse.up();
 await page.getByRole('button',{name:'Toggle theme'}).click();await expect(page.locator('main')).toHaveClass(/light/);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Canvas pattern').selectOption('squares');await page.getByRole('button',{name:'Close panel'}).click();
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Pen',exact:true})).toBeVisible();await page.screenshot({path:'slate-mobile.png'});
 expect(errors).toEqual([]);
});
test('pressure input commits without browser errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',clickCount:1,pointerType:'pen',force:.2});
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:650,y:450,button:'left',buttons:1,pointerType:'pen',force:.9});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:650,y:450,button:'left',clickCount:1,pointerType:'pen'});
 await expect(page.getByText('1 marks')).toBeVisible();expect(errors).toEqual([]);
});

test('precision eraser splits a stroke and image import survives PNG export',async({page})=>{
 await page.goto('/');await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.mouse.move(450,350);await page.mouse.down();await page.mouse.move(750,350,{steps:60});await page.mouse.up();
 await page.getByRole('button',{name:'More tool options'}).click();await page.getByLabel('Eraser mode').selectOption('precision');await page.getByRole('button',{name:'Close panel'}).click();await page.keyboard.press('e');await page.mouse.click(600,350);await expect(page.getByText('2 marks')).toBeVisible();
 await page.locator('input[accept="image/png,image/jpeg,image/webp"]').setInputFiles('slate-preview.png');await expect(page.getByText('3 marks')).toBeVisible();
 await page.getByRole('button',{name:'Export',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:/^PNG/}).click();expect((await downloaded).suggestedFilename()).toMatch(/\.png$/);
});
