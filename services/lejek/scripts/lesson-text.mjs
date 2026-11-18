import {execFile} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';

const exec=promisify(execFile);

export async function extractLessonText(filename,encoded) {
  const ext=filename.split('.').pop().toLowerCase();
  const bytes=Buffer.from(encoded,'base64');
  if (ext==='txt') return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if (!['pdf','docx','xlsx','pptx'].includes(ext)) throw new Error('Unsupported document');
  const dir=await mkdtemp(join(tmpdir(),'lejek-lesson-'));
  try {
    const file=join(dir,'document.'+ext);
    await writeFile(file,bytes,{mode:0o600});
    const options={timeout:8000,maxBuffer:512_000};
    const {stdout}=ext==='pdf'
      ?await exec('pdftotext',['-f','1','-l','40','-enc','UTF-8',file,'-'],options)
      :await exec('python3',ext==='docx'?['scripts/extract-docx.py',file]:['scripts/extract-office.py',file,ext],options);
    return stdout;
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}
