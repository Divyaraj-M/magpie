const run=require('./harness');const path=require('path');const out=(n)=>path.join(__dirname,n);
run(async(pg)=>{
 await pg.evaluate(()=>window.ready);
 const res=await pg.evaluate(async()=>{
  const {TFile}=window.OBS; const L=window.LISTENERS; const log=PLUGIN.log;
  PLUGIN.settings.captureFolders=[{folder:'Clippings',label:'Web clipper'},{folder:'Transcripts',label:'Voice memo'}];
  const fire=async(e,...a)=>{for(const cb of L[e]||[])await cb(...a)};
  const mk=(p,c,fm)=>{const f=new TFile(p);f.stat.ctime=Date.now()-40*864e5;FILES[p]=f;CONTENT[p]=c;if(fm)FMS[p]=fm;return f};
  const last=()=>{const a=log.events(0,Infinity);return a[a.length-1]};
  const at=(ev,days,h,m)=>{const d=new Date();d.setDate(d.getDate()-days);d.setHours(h,m,0,0);ev.t=d.getTime();if(ev.e)ev.e=ev.t+25*60000;};
  // seed statuses
  const task=mk('Projects/Launch checklist.md','---\nstatus: In progress\nowner: sam\n---\n# Launch checklist\n- [ ] Write release notes\n- [ ] Record demo video\n- [ ] Draft social posts\n',{status:'In progress',owner:'sam'});
  log.seedStatuses();
  // capture
  const c=mk('Clippings/Designing calm software.md','> Calm software asks for attention only when it matters.\nIt stays in the background the rest of the time.');
  await fire('create',c); at(last(),0,9,12);
  // checkbox + diff edit on task
  await log.onOpen(task);
  CONTENT[task.path]='---\nstatus: In progress\nowner: sam\n---\n# Launch checklist\n- [x] Write release notes ✅ 2026-10-27\n- [ ] Record demo video\n- [-] Draft social posts\n- [ ] Book the launch call\n';
  await fire('modify',task);
  log.events(0,Infinity).slice(-3).forEach((e,i)=>at(e,0,8,40-i*5));
  // status change -> killed with reason on a second task
  const t2=mk('Projects/Partner webinar.md','---\nstatus: Planned\n---\nCo-host a webinar.',{status:'Planned'}); log.seedStatuses();
  FMS[t2.path]={status:"Won't do",reason:'Partner pulled out of the quarter'}; for(const cb of L['mc-changed'])cb(t2); at(last(),1,17,5);
  // voice capture
  const v=mk('Transcripts/Standup 26 Oct.md','Sam: the demo build is ready. Jo: pricing page copy lands Thursday.'); await fire('create',v); at(last(),1,14,20);
  // note edit with diff
  const w=mk('Wiki/Pricing.md','# Pricing\nStarter is free.\nPro costs $12.\nTeam costs $30.\n\n## FAQ\nCan I cancel? Yes.');
  await log.onOpen(w); CONTENT[w.path]='# Pricing\nStarter is free for 3 users.\nPro costs $15 per seat.\nTeam costs $30.\n\n## FAQ\nCan I cancel? Yes, any time.'; await fire('modify',w); at(last(),1,11,2);
  // status move on task
  FMS[task.path]={status:'Review',owner:'sam'}; for(const cb of L['mc-changed'])cb(task); at(last(),2,16,30);
  // rename
  const nf=mk('Wiki/Pricing plans.md',CONTENT[w.path]); delete FILES[w.path]; await fire('rename',nf,w.path); at(last(),2,10,0);
  // heatmap noise
  for(let d=3;d<68;d++){const n=Math.floor(Math.abs(Math.sin(d*1.7))*6);for(let i=0;i<n;i++){const f=mk(`Notes/n${d}-${i}.md`,'Some text '+d);await fire('create',f);at(last(),d,9+i,0);}}
  await log.flush();
  return {events:log.events(0,Infinity).length, files:Object.keys(ADAPTER), kinds:log.events(0,Infinity).slice(-12).map(e=>e.k).join(','), diff:log.events(0,Infinity).find(e=>e.p==='Wiki/Pricing.md'&&e.k==='edit')?.df};
 });
 console.log(JSON.stringify(res,null,1));
 // timeline pane
 await pg.setViewportSize({width:1300,height:1500});
 await pg.evaluate(async()=>{const host=document.getElementById('host');host.innerHTML='';host.style.height='1500px';const v=PLUGIN.paneTypes['magpie-timeline']({});v.app=APP;await v.onOpen();host.appendChild(v.contentEl);v.contentEl.style.height='100%';window.PANE=v;await new Promise(r=>setTimeout(r,300));
   PANE.contentEl.querySelectorAll('details.mgp-diff').forEach((d,i)=>{if(i===0)d.open=true;});});
 await pg.screenshot({path:out('timeline.png')});
 console.log('kinds',(await pg.$$eval('.mgp-kind',e=>e.map(x=>x.textContent))).join(' | '));
 // note history modal via header button
 await pg.setViewportSize({width:820,height:900});
 const nb=await pg.evaluate(async()=>{const host=document.getElementById('host');host.innerHTML='';const v=new window.OBS.MarkdownView(FILES['Projects/Launch checklist.md']);APP.workspace.getLeavesOfType=t=>t==='markdown'?[{view:v}]:[];PLUGIN.addNoteButtons();PLUGIN.addNoteButtons();const b=v.actionsEl.querySelectorAll('.view-action');b[0].click();await new Promise(r=>setTimeout(r,200));const m=LAST_MODAL;host.appendChild(m.modalEl);m.modalEl.style.padding='20px';return {buttons:b.length,title:m.titleEl.textContent,rows:m.contentEl.querySelectorAll('.mgp-row').length,openDiffs:m.contentEl.querySelectorAll('details[open]').length}});
 console.log('note history',JSON.stringify(nb));
 await pg.screenshot({path:out('note-history.png'),clip:{x:0,y:0,width:820,height:720}});
 console.log('settings rows',await pg.evaluate(()=>{PLUGIN.tab.display();return PLUGIN.tab.containerEl.querySelectorAll('.setting-item').length}));
 console.log('reparsed',await pg.evaluate(async()=>{const L2=new PLUGIN.log.constructor(PLUGIN);await L2.loadMonths(Object.keys(Object.fromEntries(PLUGIN.log.own)));return L2.events(0,Infinity).length}));
});
