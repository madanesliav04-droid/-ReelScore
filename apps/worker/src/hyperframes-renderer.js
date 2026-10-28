import path from 'node:path';
import {spawn} from 'node:child_process';
import {stat} from 'node:fs/promises';

/**
 * Optional HyperFrames render adapter.
 * Does not change the existing production Edit+ pipeline.
 * Call only with a trusted, locally generated composition directory.
 */
export async function renderWithHyperframes({
  compositionDir,
  outputPath,
  timeoutMs=180_000,
  fps=30
}={}){
  if(process.env.ENABLE_HYPERFRAMES_RENDER!=='true'){
    throw new Error('HYPERFRAMES_DISABLED: opt-in is required');
  }
  if(typeof compositionDir!=='string'||!compositionDir.trim()||
     typeof outputPath!=='string'||!outputPath.trim()){
    throw new TypeError('compositionDir and outputPath are required');
  }
  const duration=Math.min(600_000,Math.max(5_000,Number(timeoutMs)||180_000));
  const rate=Math.min(60,Math.max(1,Math.floor(Number(fps)||30)));
  const project=path.resolve(compositionDir);
  const destination=path.resolve(outputPath);
  // File extensions alone do not enable HyperFrames alpha encoding.
  const format=path.extname(destination).toLowerCase()==='.webm'?'webm':
    path.extname(destination).toLowerCase()==='.mov'?'mov':'mp4';
  const cli=path.join(process.cwd(),'node_modules','.bin','hyperframes');

  const result=await new Promise((resolve,reject)=>{
    const child=spawn(cli,[
      'render',project,'--format',format,'--output',destination,
      '--fps',String(rate),'--quality','looks'
    ],{
      env:{...process.env,HYPERFRAMES_NO_UPDATE_CHECK:'1'},
      shell:false,stdio:['ignore','pipe','pipe']
    });
    let stderr='';
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      reject(new Error('HYPERFRAMES_RENDER_TIMEOUT'));
    },duration);
    child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-4000);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0) reject(new Error('HYPERFRAMES_RENDER_FAILED '+code+': '+stderr));
      else resolve(destination);
    });
  });
  const rendered=await stat(result);
  if(rendered.size<1000)throw new Error('HYPERFRAMES_INVALID_OUTPUT');
  return {outputPath:result,sizeBytes:rendered.size};
}

