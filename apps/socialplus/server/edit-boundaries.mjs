// A graphic endpoint inside a removed pause collapses to that splice. Speech
// continues using the strict inherited mapper: no word may live inside a cut.
export function mapEditBoundary(ms,keepRanges){
 let elapsed=0;
 for(const r of keepRanges){if(ms<r.startMs)return elapsed;if(ms<=r.endMs)return elapsed+ms-r.startMs;elapsed+=r.endMs-r.startMs;}
 return elapsed;
}
