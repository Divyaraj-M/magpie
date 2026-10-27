// Unit tests for the activity text helpers: node test/text.js
const esbuild=require('esbuild');const assert=require('assert');
const code=esbuild.buildSync({entryPoints:[__dirname+'/../src/text.ts'],bundle:true,format:'cjs',write:false}).outputFiles[0].text;
const m={exports:{}};new Function('module','exports',code)(m,m.exports);const T=m.exports;
let n=0;const ok=(c,msg)=>{assert.ok(c,msg);n++};
// excerpt skips frontmatter and markdown syntax
ok(T.excerpt('---\na: 1\n---\n# Title\nSee [[Note|the note]] and [link](http://x).')==='Title\nSee the note and link.','excerpt');
// diff finds changed block
let d=T.lineDiff('a\nb\nc','a\nB\nc');ok(d.changed===1&&d.preview==='B','diff change');
d=T.lineDiff('a\nb\nc','a\nc');ok(d.preview==='Removed: b','diff removal');
d=T.lineDiff('a','a\n- new item');ok(d.preview==='new item'&&d.changed===1,'diff add');
// checkbox changes
let c=T.checkboxChanges('- [ ] one\n- [ ] two\n- [x] three','- [x] one ✅ 2026-10-08\n- [-] two\n- [x] three');
ok(c.length===2&&c[0].text==='one'&&c[0].done&&c[1].text==='two'&&!c[1].done,'checkboxes');
ok(T.checkboxChanges('- [ ] a','- [ ] a\n- [x] b').length===0,'new checked line is not a completion');
// tracker-only frontmatter writes
ok(T.onlyKeysChanged('---\nstatus: A\nowner: x\n---\nbody','---\nstatus: B\nowner: x\nstatus_log:\n  - 2026-10-08 | A → B\n---\nbody',['status','status_log']),'tracker keys ignored');
ok(!T.onlyKeysChanged('---\nstatus: A\nowner: x\n---\nbody','---\nstatus: A\nowner: y\n---\nbody',['status']),'other key counts');
ok(!T.onlyKeysChanged('---\nstatus: A\n---\nbody','---\nstatus: B\n---\nbody 2',['status']),'body counts');
// diffs
let df=T.diffLines('a\nb\nc\nd\ne\nf\ng\nh','a\nb\nc\nD\ne\nf\ng\nh',1);
ok(JSON.stringify(df)===JSON.stringify([' c','-d','+D',' e']),'diff hunk with context '+JSON.stringify(df));
df=T.diffLines('1\n2\n3\n4\n5\n6\n7\n8\n9','0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10',1);
ok(df.includes('@')&&df[0]==='+0'&&df[df.length-1]==='+10','two hunks with gap '+JSON.stringify(df));
ok(T.diffLines('same','same').length===0,'no change, no diff');
const big=Array.from({length:500},(_,i)=>'line '+i).join('\n');
df=T.diffLines('',big,2,50);ok(df.length===51&&df[50].startsWith('@ … 451'),'diff capped');
const st=T.diffStats(['+a','-b','-c',' d','@']);ok(st.added===1&&st.removed===2,'stats');
console.log(`text helpers: ${n} checks passed`);
