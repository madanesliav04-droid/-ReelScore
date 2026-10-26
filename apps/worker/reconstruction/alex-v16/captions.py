"""Stable phrases, exact supplied active-word intervals, no invented words."""
from PIL import ImageDraw
from scenes import font, INK, ACCENT


def groups(words):
    result=[];current=[]
    for i,w in enumerate(words):
        if current and (len(current)>=10 or w['start']-words[current[-1]]['end']>.35 or w['end']-words[current[0]]['start']>3):
            result.append(current);current=[]
        current.append(i)
        if w['text'].endswith(('.',',','?','!',';',':')):result.append(current);current=[]
    if current:result.append(current)
    return result


def caption_layout(im,words,t):
    group=next((g for g in groups(words) if words[g[0]]['start']<=t<words[g[-1]]['end']),None)
    if group is None:return None
    portrait=im.height>im.width
    size=round(24*im.width/512) if portrait else max(16,round(min(im.width/910,im.height/512)*25))
    f=font(size);d=ImageDraw.Draw(im);limit=im.width*.86;lines=[[]]
    for i in group:
        if d.textlength(words[i]['text'],font=f)>limit:raise ValueError('Caption exceeds safe width')
        candidate=lines[-1]+[i]
        if lines[-1] and d.textlength(' '.join(words[k]['text'] for k in candidate),font=f)>limit:lines.append([i])
        else:lines[-1]=candidate
    if len(lines)>2:raise ValueError('Caption exceeds two readable lines')
    if len(lines)==2:
        candidates=[]
        for split in range(1,len(group)):
            parts=[group[:split],group[split:]]
            widths=[d.textlength(' '.join(words[i]['text'] for i in part),font=f) for part in parts]
            if max(widths)>limit:continue
            orphan=160 if min(map(len,parts))==1 and len(group)>3 else 0
            function_word=80 if words[parts[0][-1]]['text'].lower() in ['un','une','le','la','les','du','de','des','à','que'] else 0
            candidates.append((abs(widths[0]-widths[1])+orphan+function_word,split,parts))
        if candidates:lines=min(candidates,key=lambda x:(x[0],x[1]))[2]
    # Keep the two-line block above the bottom social-player controls.
    top=im.height*.76 if portrait else im.height*.89-(len(lines)-1)*(size+6)
    return {'lines':lines,'font':f,'size':size,'top':top,'active':next((i for i in group if words[i]['start']<=t<words[i]['end']),None)}


def draw_caption(im,words,t,on_graphic=True):
    layout=caption_layout(im,words,t)
    if layout is None:return
    d=ImageDraw.Draw(im);f=layout['font']
    for row,line in enumerate(layout['lines']):
        text=' '.join(words[i]['text'] for i in line)
        x=(im.width-d.textlength(text,font=f))/2;y=layout['top']+row*(layout['size']+6)
        prefix=''
        for i in line:
            px=x+d.textlength(prefix,font=f)
            ink=ACCENT if i==layout['active'] else INK if on_graphic else (255,255,255)
            d.text((px,y),words[i]['text'],font=f,fill=ink,anchor='lt',stroke_width=0 if on_graphic else max(1,round(layout['size']*.05)),stroke_fill=(20,22,28))
            prefix+=words[i]['text']+' '
