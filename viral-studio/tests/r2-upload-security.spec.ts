import {test,expect} from '@playwright/test';
import {uploadToR2} from '../lib/r2-upload';
test('signed upload capabilities cannot be sent to an arbitrary host hidden in a URL path',async()=>{
 const file=new File(['fixture'],'unit.mov',{type:'video/quicktime'});
 for(const url of ['https://evil.example/path/.r2.cloudflarestorage.com/object','https://user:password@'+'a'.repeat(32)+'.r2.cloudflarestorage.com/object','http://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/object'])
  await expect(uploadToR2({url,file,mime:file.type})).rejects.toThrow('Adresse R2 invalide.');
});
