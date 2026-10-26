// Deterministic, extractive discourse relations. This is a bounded heuristic,
// NOT a claim of general semantic understanding or of a paid LLM analysis.
const n=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const stop=new Set(('a au aux avec ce ces cet cette ca cela car cest de des du dans deja donc elle elles en est et etre fait fais faire font il ils jai je la le les leur lui ma me mes mon ne nest nous on ou par parce pas personne plus moins pourquoi pour quand que quel quelle qui sa se ses si soit sont sur ta te tes toi ton tres tu un une va vont vous votre y ya yaetre rien voir pourtant beaucoup toujours maintenant simplement reellement suite').split(' '));
for(const t of ['ceux','peut','peux','peuvent','doit','dois','doivent','veut','veux','veulent','permet','permettent'])stop.add(t);
const clean=s=>s.replace(/^[,.;:!?\s]+|[,.;:!?\s]+$/g,'');
const nominal=t=>/(tion|ment|ite|ique|if|ive|eme|ence|ance|eur|euse|ees)$/.test(t);

export function discourseScenes(words,duration){
 const tokens=words.map(w=>n(w.text));
 const freq=new Map();for(const t of tokens)if(!stop.has(t))freq.set(t,(freq.get(t)||0)+1);
 const span=(a,b)=>a>=0&&b>=a&&b<words.length?{first:a,last:b,text:clean(words.slice(a,b+1).map(w=>w.text).join(' ')),start:words[a].startMs/1000,end:words[b].endMs/1000}:null;
 function key(a,b,maxChars=24){
  a=Math.max(0,a);b=Math.min(words.length-1,b);let best=null;
  for(let i=a;i<=b;i++)for(let j=i;j<=Math.min(b,i+3);j++){
   if(words.slice(i,j).some(w=>/[,;.!?]$/.test(w.text)))continue;
   if(stop.has(tokens[i])||stop.has(tokens[j])||tokens[i].length<3||tokens[j].length<3)continue;
   const s=span(i,j);if(s.text.length>maxChars||s.text.includes('?'))continue;
   const content=tokens.slice(i,j+1).filter(t=>!stop.has(t)&&t.length>=3);
   if(!content.length)continue;
   const score=content.reduce((v,t)=>v+1+Math.min(3,freq.get(t)||0)*.2+(nominal(t)?.5:0),0)-(j-i+1-content.length)*.25-(i-a)*.035;
   if(!best||score>best.score)best={...s,score};
  }
  return best;
 }
 function match(i,phrase){const p=phrase.split(' ').map(n);return p.every((x,j)=>tokens[i+j]===x);}
 function boundary(i,limit=22){let j=i;while(j<Math.min(words.length-1,i+limit)&&!/[.!?]$/.test(words[j].text))j++;return j;}
 function tailPhrase(a,b,maxChars){
  b=Math.min(words.length-1,b);let first=b;
  while(first>a&&b-first<4&&!/[,;.!?]$/.test(words[first-1].text)&&span(first-1,b).text.length<=maxChars)first--;
  return span(first,b);
 }
 function scene(kind,left,right,callout,start,end,title=left,extra={}){
  if(!left||!right||!callout||!title||left.first>=right.first)return null;
  start=Math.max(0,start);end=Math.min(duration,end);
  if(end-start<2||end-callout.start<1||right.end>end||left.start<start-.001)return null;
  const d=Math.max(.3,Math.min(1.8,right.start-left.end));
  const text={chapter:'',title:clean(title.text).toLocaleUpperCase('fr'),labels:[left.text,right.text].map(t=>t.toLocaleUpperCase('fr')),conclusion:callout.text.toLocaleUpperCase('fr'),...(kind==='chain'?{}:{symbols:kind==='question'?['?','+']:['+','€']})};
  const evidence=[left,right,callout,title].map(s=>({firstWord:s.first,lastWord:s.last,start:s.start,end:s.end,text:s.text}));
  return {kind,start,end,text,evidence,relationEvidence:extra,cues:{rightHighlight:right.start-start,arrowStart:left.end-start,arrowDuration:d,calloutStart:callout.start-start,calloutDuration:.43}};
 }
 const questions=[],values=[],chains=[];
 // Explicit comparisons. A simple "et" alone is NOT evidence of opposition.
 for(let i=0;i<tokens.length;i++){
  if(match(i,'rien à voir')||tokens[i]==='difference'){
   const join=tokens.lastIndexOf('et',i-1);
   if(join>=0&&i-join<12){
    const left=key(Math.max(0,join-7),join-1,20),right=key(join+1,i-1,20),callout=span(i,Math.min(words.length-1,i+(match(i,'rien à voir')?2:0)));
    const s=scene('question',left,right,callout,left?.start??0,Math.min(duration,callout.end+2),left,{type:'explicit-comparison',marker:[i,callout.last]});
    if(s){s.text.title=left.text.toLocaleUpperCase('fr')+' ≠ '+right.text.toLocaleUpperCase('fr');questions.push(s);}
   }
  }
  if(tokens[i]==='pas'){
   let j=i+2;while(j<Math.min(tokens.length,i+22)&&!['mais','plutot','cest'].includes(tokens[j]))j++;
   if(j>=Math.min(tokens.length,i+22))continue;
   const left=key(i+1,j-1,22),right=key(j+1,Math.min(j+8,words.length-1),22),callout=key((right?.last??j)+1,Math.min(words.length-1,j+18),22);
   const s=scene('question',left,right,callout,left?.start??0,Math.min(duration,(callout?.end??0)+1.3),left,{type:'negation-then-alternative',marker:[i,j]});
   if(s){s.text.title=left.text.toLocaleUpperCase('fr')+' ≠ '+right.text.toLocaleUpperCase('fr');questions.push(s);}
  }
 }
 // Functional predicates and their actual effects. Currency only if the speech
 // contains financial vocabulary; no money graphic is invented for other topics.
 const money=t=>/^(argent|largent|vendre|vend|vendent|ventes?|revenus?|remuner\w*|payer|payent|budgets?|couts?|couter|coute)$/.test(t);
 const financial=tokens.some(money);
 if(financial)for(let i=0;i<tokens.length;i++){
  if(!/^(permet|permettent|rapproch\w*|aider|ameliore\w*|augmente\w*|reduit\w*|genere\w*|apporte\w*|devient)$/.test(tokens[i]))continue;
  if(!tokens.slice(Math.max(0,i-12),i+21).some(money))continue;
  if(tokens.slice(Math.max(0,i-4),i).some(t=>['ne','pas'].includes(t)))continue;
  let first=Math.max(0,i-12);for(let j=first;j<i;j++)if(/[.!?]$/.test(words[j].text))first=j+1;
  const left=key(first,i-1,24);let right;
  const adjective=tokens.findIndex((t,j)=>j>i&&j<=i+5&&/^(simple|facile|efficace|rapide|clair|utile|difficile)$/.test(t));
  if(adjective>=0)right=span(['plus','moins'].includes(tokens[adjective-1])?adjective-1:adjective,adjective);
  else right=key(i+1,Math.min(words.length-1,i+7),24);
  const last=boundary(right?.last??i,20),callout=tailPhrase((right?.last??i)+1,last,30);
  const s=scene('value',left,right,callout,left?.start??0,Math.min(duration,Math.max(words[last].endMs/1000+.2,(callout?.start??0)+1.2)),left,{type:'functional-effect',marker:[i,i]});
  if(s)values.push(s);
 }
 // Repeated syntax is evidence of enumeration, not automatically of causation.
 for(const prefix of ['ceux qui','ça me','cela me','premièrement']){
  const starts=[];for(let i=0;i<tokens.length;i++)if(match(i,prefix))starts.push(i);
  if(starts.length<3)continue;
  for(let k=0;k<=starts.length-3;k++){
   const ids=starts.slice(k,k+3),nodes=ids.map((a,j)=>{
    const first=a+prefix.split(' ').length;let last=j<2?ids[j+1]-1:boundary(a,12);
    for(let x=first;x<last;x++)if(/[,;.!?]$/.test(words[x].text)){last=x;break;}
    const whole=span(first,last);return whole.text.length<=22?whole:key(first,last,22);
   });
   if(nodes.some(s=>!s)||new Set(nodes.map(s=>n(s.text))).size!==3)continue;
   if(nodes[2].end-nodes[0].start>12)continue;
   const title=nodes[0],callout=nodes[2],start=nodes[0].start,end=Math.min(duration,Math.max(words[boundary(nodes[2].last,6)].endMs/1000+.15,nodes[2].end+1.2));
   const s=scene('chain',nodes[0],nodes[1],callout,start,end,title,{type:'spoken-enumeration-not-causal-proof',marker:ids,omittedItems:Math.max(0,starts.length-3)});
   if(s){s.text.labels=nodes.map(s=>s.text.toLocaleUpperCase('fr'));s.evidence.push(...nodes.map(s=>({firstWord:s.first,lastWord:s.last,start:s.start,end:s.end,text:s.text})));s.cues={nodeStarts:nodes.map(x=>x.start-start),arrowStarts:nodes.slice(0,2).map(x=>x.end-start),arrowDuration:.4,calloutStart:callout.start-start,calloutDuration:.2};chains.push(s);}
  }
 }
 // Select a complete, nonoverlapping set; never force three unrelated boards.
 let best=null;
 for(const q of questions)for(const v of values)for(const c of chains){
  const set=[q,v,c].sort((a,b)=>a.start-b.start);
  if(set.some((s,i)=>i&&s.start<set[i-1].end+.12))continue;
  const score=set.reduce((a,s)=>a+s.evidence.reduce((n,e)=>n+e.lastWord-e.firstWord+1,0),0);
  if(!best||score>best.score)best={set,score};
 }
 if(!best)return null;
 return best.set.map((s,i)=>({...s,text:{...s.text,chapter:`0${i+1} / ${s.text.title.slice(0,35)}`}}));
}
