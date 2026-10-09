// npm install --no-save playwright (in the project root), then npx playwright install chromium
// Run: node tests/browser_smoke.cjs (requires free ports 3000 and 8000)
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const path=require('path');
const fs=require('fs');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'test-screenshots'); fs.mkdirSync(output,{recursive:true});
(async()=>{
 const py=spawn('python',['-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000'],{cwd:root});
 const vite=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:root+'/frontend'});
 let b;
 try{
 for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:3000/api/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer'],headless:true});
 const page=await b.newPage({viewport:{width:1440,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000');await page.getByText('Engine connected').waitFor();
 await page.getByLabel('Your name').fill('Browser Rider');
 await page.getByRole('button',{name:'Find a shared ride'}).click();
 await page.getByRole('heading',{name:'You’re in the queue.'}).waitFor();
 await page.getByRole('button',{name:'Match current batch'}).click();
 await page.getByRole('heading',{name:'Your route is ready.'}).waitFor();
 console.log('PASS custom booking, queue, matching, single-rider result');
 await page.getByRole('button',{name:'Dispatch',exact:true}).click();
 await page.getByRole('button',{name:'Golden Corridor',exact:true}).click();
 await page.getByText('3 waiting',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Dispatch batch',exact:true}).click();
 await page.getByText('Route ready for 3 passenger requests.',{exact:false}).waitFor();
 console.log('PASS Golden queue and dispatch');
 await page.getByRole('button',{name:'Fairness Lab',exact:true}).click();
 await page.getByRole('heading',{name:'Follow the fare'}).waitFor();
 await page.screenshot({path:output+'/admin-fairness.png',fullPage:true});
 await page.getByRole('button',{name:'Convenience Shield',exact:true}).click();
 await page.getByRole('button',{name:'Test Vikram insertion',exact:true}).click();
 await page.getByText('Pool match rejected',{exact:true}).waitFor();
 await page.getByRole('button',{name:'What-If Sandbox',exact:true}).click();
 await page.getByRole('button',{name:'Evaluate scenario',exact:true}).click();
 await page.getByText('Route accepted',{exact:true}).waitFor();
 await page.getByLabel('Add one candidate request').check();
 await page.getByLabel('Candidate name').fill('Additional Rider');
 await page.getByRole('button',{name:'Evaluate scenario',exact:true}).click();
 await page.getByRole('cell',{name:'Additional Rider',exact:true}).waitFor();
 await page.getByRole('button',{name:'Benchmark scorecard',exact:true}).click();
 await page.getByRole('button',{name:'Load benchmark',exact:true}).click();
 await page.getByText('Backend fixture · not a measured live run',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Live corridor map',exact:true}).click();
 await page.getByRole('button',{name:'Show Vikram detour',exact:true}).click();
 await page.getByRole('button',{name:'Fit full route',exact:true}).click();
 console.log('PASS all six admin sections, rejection, sandbox candidate, benchmark and map controls');
 await page.getByRole('button',{name:'Drive',exact:true}).click();
 await page.getByRole('button',{name:'Play simulation',exact:true}).click();
 await page.waitForTimeout(2600);
 await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
 await page.screenshot({path:output+'/driver-desktop.png',fullPage:true});
 console.log('PASS driver simulation');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
 console.log('driver mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:output+'/driver-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Dispatch',exact:true}).click();
 await page.getByRole('button',{name:'Fairness Lab',exact:true}).click();
 console.log('admin mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.getByRole('button',{name:'Ride',exact:true}).click();
 await page.getByRole('button',{name:'Book a ride',exact:true}).click();
 await page.waitForTimeout(400);await page.screenshot({path:output+'/passenger-mobile.png',fullPage:true});
 console.log('passenger mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.setViewportSize({width:1440,height:1080});await page.waitForTimeout(400);
 await page.screenshot({path:output+'/passenger-desktop.png',fullPage:true});
 // Check failed dispatch leaves two disjoint requests in the server queue.
 await page.request.post('http://127.0.0.1:3000/api/rides/book',{data:{request_id:'a',passenger_name:'No overlap A',origin_name:'Pune',destination_name:'Talegaon'}});
 await page.request.post('http://127.0.0.1:3000/api/rides/book',{data:{request_id:'b',passenger_name:'No overlap B',origin_name:'Panvel',destination_name:'Mumbai'}});
 await page.getByRole('button',{name:'Dispatch',exact:true}).click();
 await page.getByRole('button',{name:'Dispatch & booking',exact:true}).click();
 await page.getByText('2 waiting',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Dispatch batch',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'No overlapping route found'}).waitFor();
 const q=await (await page.request.get('http://127.0.0.1:3000/api/rides/queue')).json();
 if(q.queue_size!==2)throw Error('Failed dispatch lost queued riders');
 console.log('PASS no-match message and queue preservation');
 console.log('PAGE ERRORS',JSON.stringify(errors));if(errors.length)throw Error(errors.join(' | '));

 }finally{await b?.close();py.kill();vite.kill();}
})().catch(e=>{console.error(e);process.exit(1)});
