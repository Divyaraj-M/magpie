(function(){
const {TFile}=window.OBS;
const files={},CONTENT={},FMS={},ADAPTER={},listeners={};
window.FILES=files;window.CONTENT=CONTENT;window.FMS=FMS;window.ADAPTER=ADAPTER;window.LISTENERS=listeners;
const app={
 loadLocalStorage:()=>'dev1',saveLocalStorage(){},
 vault:{configDir:'.obsidian',adapter:{exists:async p=>p in ADAPTER||Object.keys(ADAPTER).some(k=>k.startsWith(p+'/')),list:async d=>({files:Object.keys(ADAPTER).filter(k=>k.startsWith(d+'/')),folders:[]}),read:async p=>ADAPTER[p],write:async(p,c)=>{ADAPTER[p]=c},append:async(p,c)=>{ADAPTER[p]=(ADAPTER[p]||'')+c},mkdir:async()=>{}},
  getRoot:()=>({children:[...new Set(Object.keys(files).filter(p=>p.includes('/')).map(p=>p.split('/')[0]))].map(n=>new window.OBS.TFolder(n))}),
  getAbstractFileByPath:p=>files[p]||null,getMarkdownFiles:()=>Object.values(files),getFiles:()=>Object.values(files),cachedRead:async f=>CONTENT[f.path]||'',on:(e,cb)=>{(listeners[e]=listeners[e]||[]).push(cb)}},
 metadataCache:{getFileCache:f=>FMS[f.path]?{frontmatter:FMS[f.path]}:null,on:(e,cb)=>{(listeners['mc-'+e]=listeners['mc-'+e]||[]).push(cb)}},
 workspace:{getActiveFile:()=>null,getLeavesOfType:()=>[],onLayoutReady:cb=>cb(),getLeaf:()=>({openFile:f=>{window.OPENED=f.path},setViewState:async()=>{}}),revealLeaf:async()=>{},on:(e,cb)=>{(listeners['ws-'+e]=listeners['ws-'+e]||[]).push(cb);return {}}},
};
window.APP=app;
const plugin=new window.PluginClass();plugin.app=app;window.PLUGIN=plugin;
window.ready=plugin.onload();
})();
