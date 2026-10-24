"""Bind new-rush words to the four original V6 drawing grammars used by V7.
This module never loads historical video, audio, word timings or cut tables.
"""
from PIL import ImageDraw

def halves(text):
    words=text.strip().rstrip('.,!?;:').split()
    if len(words)<2:return text.strip().rstrip('.,!?;:'),''
    split=min(range(1,len(words)),key=lambda i:abs(len(' '.join(words[:i]))-len(' '.join(words[i:]))))
    return ' '.join(words[:split]),' '.join(words[split:])

def autonomous_layers(e,index,count,scope,load,root):
    from reference_scenes import Bindings,label
    local=dict(scope);primary=label(e['text']);one,two=halves(primary)
    groups=e.get('details',[]);texts=[label(g['text']) for g in groups]
    # Preserve original positions, palette, weights and primitives. Fit only
    # variable copy; no clipping or historical label should survive binding.
    def textxy(d,xy,msg,sz=24,color=scope['WHITE'],anchor='lt',wt='b'):
        if not msg:return
        x,y=xy
        width=840 if x==480 else (150 if x==208 else 230 if x==510 else 150 if x==810 else 220 if y==362 else max(35,908-x))
        if msg=='→':width=45
        lines=[str(msg)]
        f=local['font'](sz,wt)
        if f.getlength(msg)>width and y in (362,387):lines=[s for s in halves(msg) if s]
        while sz>11 and max(f.getlength(s) for s in lines)>width:sz-=1;f=local['font'](sz,wt)
        if max(f.getlength(s) for s in lines)>width:raise ValueError('Cinematic text cannot fit safely: '+msg)
        gap=sz*1.15
        for i,line in enumerate(lines):
            pos=(x,y+(i-(len(lines)-1)/2)*gap)
            bounds=d.textbbox(pos,line,font=f,anchor=anchor)
            if bounds[0]<20 or bounds[1]<10 or bounds[2]>940 or bounds[3]>520:raise ValueError('Cinematic text outside safe canvas: '+msg)
            d.text(pos,line,font=f,fill=color,anchor=anchor,stroke_width=0)
    local['textxy']=textxy
    source=root/'cinematic-v7/src/render_v6_historique.py'
    load(source,['base_header'],local,Bindings({'CINEMATIC STORYTELLING':'SOCIAL+'},index=index+1))
    strings={
      'LE DÉCLIC':'','LA MAUVAISE QUESTION':'','COMMENT GAGNER':one.upper(),'DE L’ARGENT EN LIGNE ?':two.upper(),'ET SI CE N’ÉTAIT PAS LA BONNE QUESTION ?':'',
      'LA VRAIE LOGIQUE':'','TU GAGNES QUAND TU':one.upper(),'AIDES LES AUTRES':two.upper(),
      'LE DEUXIÈME POINT':'','APPRENDS UNE':one.upper(),'COMPÉTENCE':two.upper(),
      'LA VALEUR CONCRÈTE':'','POURQUOI ON TE PAIE ?':primary.upper(),'UNE COMPÉTENCE DOIT ÊTRE UTILE':'',
      'DU TEMPS':texts[0] if texts else '', 'Faire gagner du temps':'',
      'DE L’ARGENT':texts[1] if len(texts)>1 else '', 'Faire gagner de l’argent':'',
      'UNE SOLUTION':texts[2] if len(texts)>2 else '', 'Résoudre un problème':'',
      'RÉSOUDRE UN VRAI PROBLÈME':texts[0] if texts else '',
      'AIDER':texts[0].upper() if texts else '', 'GAGNER':texts[2].upper() if len(texts)>2 else ''}
    if len(texts)>1:
        middle=halves(texts[1]);strings.update({'CRÉER DE LA':middle[0].upper(),'VALEUR':middle[1].upper()})
    else:strings.update({'CRÉER DE LA':'','VALEUR':''})
    kind=e.get('kind');variant={'cinematic-question':0,'cinematic-chain':1,'cinematic-key':2,'cinematic-cards':3}[kind]
    if variant==1 and len(groups)!=3:raise ValueError('A chain needs three spoken groups')
    positions={0:[],1:[352],2:[195,510],3:[60,352,644]}[len(groups)]
    load(source,['scene_layers'],local,Bindings(strings,card_positions=dict(zip([60,352,644],positions)),index=index+1))
    original=local['scene_layers'](variant);a=e['startMs']/1000
    cue=lambda i:max(0,groups[i]['startMs']/1000-a)
    if variant==0:return [original[0],(original[2][0],.04,.36,24),(original[3][0],.14,.36,24),(original[4][0],.25,.45,0)]
    if variant==2:return [original[0],(original[1][0],.04,.36,24),(original[2][0],.14,.36,24),(original[3][0],.28,.4,0)]+([(original[4][0],cue(0),.36,24)] if groups else [])
    if variant==1:
        return [original[0],(original[1][0],.04,.36,24),(original[2][0],.14,.36,24),
                (original[3][0],cue(0),.36,24),(original[4][0],cue(1),.3,0),(original[5][0],cue(1),.36,24),
                (original[6][0],cue(2),.3,0),(original[7][0],cue(2),.36,24)]
    return original[:2]+[(original[3+i][0],cue(i),.36,24) for i in range(len(groups))]
