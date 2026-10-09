import {test,expect} from "@playwright/test";
import {MAX_VIDEO_UPLOAD_BYTES,UPLOAD_PART_BYTES,uploadParts,videoUploadPreflight,videoUploadErrorMessage} from "../lib/upload-limits";
test("allows 72 MiB MOV through multiple 40 MiB upload objects",()=>{
  expect(videoUploadPreflight({name:"IMG_0531.MOV",size:72*1024*1024})).toBeNull();
  const parts=uploadParts(72*1024*1024);
  expect(parts.map(x=>x.size)).toEqual([UPLOAD_PART_BYTES,32*1024*1024]);
  expect(parts[0].start).toBe(0);
  expect(parts[1].start).toBe(parts[0].end);
});
test("supports entire 500 MiB video and no oversized storage objects",()=>{
  expect(videoUploadPreflight({name:"example.mov",size:MAX_VIDEO_UPLOAD_BYTES})).toBeNull();
  const parts=uploadParts(MAX_VIDEO_UPLOAD_BYTES);
  expect(parts.length).toBe(13);
  expect(parts.reduce((a,b)=>a+b.size,0)).toBe(MAX_VIDEO_UPLOAD_BYTES);
  expect(parts.every(p=>p.size<=UPLOAD_PART_BYTES)).toBe(true);
  expect(videoUploadPreflight({name:"too-large.mov",size:MAX_VIDEO_UPLOAD_BYTES+1})).toContain("500 Mo");
});
test("rejects empty, illegal extensions and impossible sizes",()=>{
  expect(videoUploadPreflight({name:"example.mp4",size:0})).toContain("vide");
  expect(videoUploadPreflight({name:"example.jpg",size:1000})).toContain("MP4");
  expect(()=>uploadParts(-1)).toThrow();
});
test("413 and auth errors distinguish storage and session state",()=>{
  expect(videoUploadErrorMessage(413)).toContain("morceau");
  expect(videoUploadErrorMessage(401)).toContain("Reconnecte-toi");
  expect(videoUploadErrorMessage(403)).toContain("Reconnecte-toi");
  expect(videoUploadErrorMessage(409)).toContain("Conflit");
  expect(videoUploadErrorMessage(0)).toContain("reprendre");
});
