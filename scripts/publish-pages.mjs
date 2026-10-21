import {execFileSync} from 'node:child_process';
import {mkdtempSync,cpSync,readdirSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// pnpm deploy runs tests and builds before invoking this script.
const dist=resolve('dist');
if(!existsSync(join(dist,'index.html')))throw new Error('Run pnpm build first.');
const remote=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'slate-publish-'));
const run=(...args)=>execFileSync('git',args,{cwd:temp,stdio:'inherit'});
try{
 execFileSync('git',['clone','--branch','gh-pages','--single-branch',remote,temp],{stdio:'inherit'});
 // Only replace the generated website in our new temporary clone.
 for(const name of readdirSync(temp))if(name!=='.git')rmSync(join(temp,name),{recursive:true,force:true});
 cpSync(dist,temp,{recursive:true});writeFileSync(join(temp,'.nojekyll'),'');
 run('add','--all');
 const changes=execFileSync('git',['status','--porcelain'],{cwd:temp,encoding:'utf8'});
 if(changes.trim()){run('commit','-m','Publish Slate website');run('push','origin','gh-pages')}
 else console.log('The published build is already up to date.');
 console.log('Uploaded. Watch the repository Actions tab for Pages deployment.');
}finally{rmSync(temp,{recursive:true,force:true})}
