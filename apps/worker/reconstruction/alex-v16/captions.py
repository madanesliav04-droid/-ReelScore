"""Timed words supplied by the existing transcription pipeline, never inferred."""
from PIL import ImageDraw
from scenes import font, INK, ACCENT


def draw_caption(im, words, t):
    active=next((i for i,w in enumerate(words) if w['start']<=t<w['end']),None)
    if active is None:return
    # A small phrase around the spoken word; deterministic wrapping to safe width.
    first=active
    while first>0 and active-first<4 and words[first]['start']-words[first-1]['end']<.35:first-=1
    last=min(len(words),first+8)
    size=max(16,round(min(im.width/910,im.height/512)*25))
    f=font(size);d=ImageDraw.Draw(im);limit=im.width*.86
    group=list(range(first,last))
    while len(group)>1 and d.textlength(' '.join(words[i]['text'] for i in group),font=f)>limit:
        if group[-1]>active:group.pop()
        else:group.pop(0)
    line=' '.join(words[i]['text'] for i in group)
    if d.textlength(line,font=f)>limit:raise ValueError('Caption exceeds safe width; shorten the word rather than clip it')
    x=(im.width-d.textlength(line,font=f))/2;y=im.height*.89
    for i in group:
        word=words[i]['text'];d.text((x,y),word,font=f,fill=ACCENT if i==active else INK,anchor='lt')
        x+=d.textlength(word+' ',font=f)
