// Deliberately artificial labels; NOT a transcript or a validated artistic model.
import {writeFile} from 'node:fs/promises';
const plan={width:320,height:568,durationMs:3000,events:[],captions:[],referenceWords:[
 {text:'TEST',startMs:100,endMs:450},{text:'SYNTHETIQUE',startMs:450,endMs:900},
 {text:'CAPTURE',startMs:1250,endMs:1600},{text:'LOCALE',startMs:1600,endMs:1950},
 {text:'EXPORT',startMs:2200,endMs:2500},{text:'IOS',startMs:2500,endMs:2850}],
 referenceDirection:{layout:{hero:[.08,.08,.84,.18],chat:[.14,.32,.72,.07],captionLeft:[.08,.67,.8,.12],captionRight:[.12,.67,.8,.12]},impacts:[{firstWord:0,accentWord:1,lastWord:1}],bubbles:[{firstWord:2,lastWord:3,stack:0}],captionRuns:[{firstWord:4,lastWord:5,side:'left'}]}};
await writeFile(process.argv[2],JSON.stringify(plan));
