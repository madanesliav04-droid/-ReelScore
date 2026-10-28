"""Build the licensed Latin render subsets; development only (fontTools).
Usage: python engines/build_fonts.py /path/to/downloaded/google-font-sources
No downloads take place here or in the runtime renderer.
"""
import sys,json,hashlib,shutil
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

def main(source):
 source=Path(source);out=Path(__file__).parent/'fonts';out.mkdir(exist_ok=True)
 existing=out/'manifest.json'
 if existing.exists():
  for entry in json.loads(existing.read_text())['fonts'].values():
   actual=hashlib.sha256((source/entry['sourceFile']).read_bytes()).hexdigest()
   if actual!=entry['sourceSha256']:raise RuntimeError('Source font version differs from the recorded manifest: '+entry['sourceFile'])
 fonts={};aliases={};unicode_set=set(range(0x250))|set(range(0x2000,0x2070))|set(range(0x2190,0x2300))|{0x20ac,0x2713}
 specs=[('Inter-VF.ttf','SocialPlusSans-'+style+'.ttf','SocialPlus Sans '+style,{'wght':weight,'opsz':14},'Inter-OFL.txt') for style,weight in [('Regular',400),('Medium',500),('SemiBold',600),('Bold',700),('ExtraBold',800)]]
 specs += [('Inter-VF.ttf','SocialPlusDisplay-SemiBold.ttf','SocialPlus Display SemiBold',{'wght':600,'opsz':32},'Inter-OFL.txt'),('EBGaramond-VF.ttf','SocialPlusSerif-Regular.ttf','SocialPlus Serif',{'wght':400},'EBGaramond-OFL.txt'),('Lato-Regular.ttf','SocialPlusHumanist-Regular.ttf','SocialPlus Humanist',None,'Lato-OFL.txt')]
 for original,file,family,axes,license_file in specs:
  f=TTFont(source/original)
  if axes:f=instantiateVariableFont(f,axes,inplace=True)
  opt=subset.Options();opt.name_IDs=['*'];opt.name_legacy=True;opt.name_languages=['*'];opt.recalc_timestamp=False
  sub=subset.Subsetter(options=opt);sub.populate(unicodes=unicode_set);sub.subset(f)
  # Modified subsets have distinct names, including the Lato reserved name.
  names={1:family,2:'Regular',3:family+'-Latin-v1',4:family,6:family.replace(' ',''),16:family,17:'Regular'}
  for record in f['name'].names:
   if record.nameID in names:record.string=names[record.nameID].encode(record.getEncoding(),errors='replace')
  f.save(out/file)
  fonts[file]={'family':family,'license':license_file,'sha256':hashlib.sha256((out/file).read_bytes()).hexdigest(),'sourceFile':original,'sourceSha256':hashlib.sha256((source/original).read_bytes()).hexdigest(),'axes':axes}
 for old,new in [('Inter-Regular.otf','SocialPlusSans-Regular.ttf'),('Inter-Medium.otf','SocialPlusSans-Medium.ttf'),('Inter-SemiBold.otf','SocialPlusSans-SemiBold.ttf'),('Inter-Bold.otf','SocialPlusSans-Bold.ttf'),('Inter-ExtraBold.otf','SocialPlusSans-ExtraBold.ttf'),('InterDisplay-SemiBold.otf','SocialPlusDisplay-SemiBold.ttf'),('EBGaramond08-Regular.ttf','SocialPlusSerif-Regular.ttf'),('Lato-Regular.ttf','SocialPlusHumanist-Regular.ttf'),('Lato-Medium.ttf','SocialPlusHumanist-Regular.ttf')]:aliases[old]=new
 for name in ['Inter-OFL.txt','EBGaramond-OFL.txt','Lato-OFL.txt']:shutil.copyfile(source/name,out/name)
 manifest={'license':'SIL OFL 1.1','source':'https://github.com/google/fonts','charset':'Latin U+0000–024F, punctuation, arrows and mathematical signs; no promise of full Unicode coverage','modified':True,'note':'Inter current optical instances and EB Garamond are authorized alternatives to historical files. Lato Medium is replaced by Lato Regular. Modified subsets renamed; no exact historical font identity claimed.','aliases':aliases,'fonts':fonts}
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print({p.name:p.stat().st_size for p in out.glob('*.ttf')})
if __name__=='__main__':main(sys.argv[1])
