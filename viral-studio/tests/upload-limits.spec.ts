import {test,expect} from "@playwright/test";
import {MAX_VIDEO_UPLOAD_BYTES,videoUploadPreflight,videoUploadErrorMessage} from "../lib/upload-limits";

test("blocks a 72 MiB MOV before uploading to the 50 MiB global Supabase cap",()=>{
  const message=videoUploadPreflight({name:"IMG_0531.MOV",size:72*1024*1024});
  expect(message).toContain("72,0 Mo");
  expect(message).toContain("50 Mo");
});
test("allows supported video exactly at the configured size cap",()=>{
  expect(videoUploadPreflight({name:"example.mov",size:MAX_VIDEO_UPLOAD_BYTES})).toBeNull();
  expect(videoUploadPreflight({name:"example.mp4",size:1000})).toBeNull();
  expect(videoUploadPreflight({name:"example.webm",size:1000})).toBeNull();
});
test("rejects empty and non-video files",()=>{
  expect(videoUploadPreflight({name:"example.mp4",size:0})).toContain("vide");
  expect(videoUploadPreflight({name:"example.jpg",size:1000})).toContain("MP4");
});
test("413 is a storage limit, not a resumable connection failure",()=>{
  expect(videoUploadErrorMessage(413)).toContain("50 Mo");
  expect(videoUploadErrorMessage(413)).not.toContain("reprendre");
  expect(videoUploadErrorMessage(0)).toContain("reprendre");
});
test("auth and upload conflicts have actionable messages",()=>{
  expect(videoUploadErrorMessage(401)).toContain("Reconnecte-toi");
  expect(videoUploadErrorMessage(403)).toContain("Reconnecte-toi");
  expect(videoUploadErrorMessage(409)).toContain("Conflit");
});
