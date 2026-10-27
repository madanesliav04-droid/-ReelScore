import {test,expect} from '@playwright/test';
import {resumableUploadUrl} from '../lib/storage-endpoint';

test('hosted storage keeps its dedicated resumable domain',()=>{
  expect(resumableUploadUrl('https://project.supabase.co')).toBe('https://project.storage.supabase.co/storage/v1/upload/resumable');
});
test('isolated self-hosted upload uses its actual origin and port',()=>{
  expect(resumableUploadUrl('http://127.0.0.1:56321/')).toBe('http://127.0.0.1:56321/storage/v1/upload/resumable');
  expect(resumableUploadUrl('https://private.example.test')).toBe('https://private.example.test/storage/v1/upload/resumable');
});
