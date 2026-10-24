"""Parameter bindings for the original scene functions; no reference pixels/voice.
Only texts selected from the current rush and their real cue times are bound.
"""
import ast,math
from PIL import Image,ImageDraw,ImageFont,ImageOps

class Bindings(ast.NodeTransformer):
 def __init__(self,strings=None,values=None,numbers=None,card_positions=None,index=1):
  self.strings=strings or {};self.values=values or {};self.numbers=numbers or {};self.card_positions=card_positions;self.index=index
 def visit_Constant(self,node):
  if isinstance(node.value,str) and node.value in self.strings:return ast.copy_location(ast.Constant(self.strings[node.value]),node)
  if isinstance(node.value,float) and node.value in self.numbers:return ast.copy_location(ast.Constant(self.numbers[node.value]),node)
  return node
 def visit_Assign(self,node):
  if len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in self.values:
   node.value=ast.parse(repr(self.values[node.targets[0].id]),mode='eval').body;return node
  return self.generic_visit(node)
 def visit_Call(self,node):
  node=self.generic_visit(node)
  if isinstance(node.func,ast.Name) and node.func.id=='base_header':node.args[0]=ast.Constant(self.index)
  if self.card_positions and isinstance(node.func,ast.Name) and node.func.id=='benefit':
   original=node.args[0].value;node.args[0]=ast.Constant(self.card_positions.get(original,original))
  return node

def label(text):return text.strip().rstrip('.,!?;:')

def cinematic_layers(e,index,count,scope,load,root):
 if str(e.get('kind','')).startswith('cinematic-'):
  from cinematic_scenes import autonomous_layers
  return autonomous_layers(e,index,count,scope,load,root)
 groups=e.get('details') or ([e['secondary']] if e.get('secondary') else [])
 primary=label(e['text']);a=e['startMs']/1000
 # Reuse the exact original chapter/header/scene drawing functions. Historical
 # sentences and their old times are never executed on a new rush.
 source=root/'cinematic-v7/src/render_v6_historique.py'
 scope=dict(scope)
 load(source,['base_header'],scope,Bindings({'CINEMATIC STORYTELLING':'SOCIAL+'},index=index+1))
 if groups:
  strings={'LA VALEUR CONCRÈTE':primary,'POURQUOI ON TE PAIE ?':primary.upper(),'UNE COMPÉTENCE DOIT ÊTRE UTILE':'','DU TEMPS':label(groups[0]['text']),'Faire gagner du temps':'','DE L’ARGENT':label(groups[1]['text']) if len(groups)>1 else '','Faire gagner de l’argent':'','UNE SOLUTION':label(groups[2]['text']) if len(groups)>2 else '','Résoudre un problème':''}
  positions={1:[352],2:[195,510],3:[60,352,644]}[len(groups)]
  load(source,['scene_layers'],scope,Bindings(strings,card_positions=dict(zip([60,352,644],positions)),index=index+1))
  original=scope['scene_layers'](3)
  layers=original[:2]
  for i,g in enumerate(groups):layers.append((original[3+i][0],max(0,g['startMs']/1000-a),.42,24))
 else:
  tokens=primary.split();mid=max(1,len(tokens)//2);one=' '.join(tokens[:mid]).upper();two=' '.join(tokens[mid:]).upper()
  strings={'LE DÉCLIC':primary,'LA MAUVAISE QUESTION':'','COMMENT GAGNER':one,'DE L’ARGENT EN LIGNE ?':two,'ET SI CE N’ÉTAIT PAS LA BONNE QUESTION ?':''}
  load(source,['scene_layers'],scope,Bindings(strings,index=index+1));original=scope['scene_layers'](0)
  layers=[original[0],(original[2][0],.08,.36,24),(original[3][0],.2,.36,24),original[4]]
 return layers

def spatial_scene(e,index,count,scope,load,root):
 """Reuse the V9 baseline/nodes or document template with current words."""
 source=root/'spatial-v10/code/portable_editplus_spatial_ui_v9_motion_flow.py'
 scope=dict(scope);a=e['startMs']/1000;b=e['endMs']/1000
 groups=[{'text':e['text'],'startMs':e['startMs']}]+e.get('details',[])
 groups=groups[:3]
 strings={'01 / 03':f'{index+1:02} / {count:02}','02 / 03':f'{index+1:02} / {count:02}','Compétence':label(e['text']),'Offre':label(e['text']),'Créer une valeur concrète':'','Ce qui te différencie':''}
 values={'labels':[label(g['text']).upper() for g in groups], 'times':[(g['startMs']/1000,b) for g in groups], 'descriptors':[(g['startMs']/1000,label(g['text']).upper()) for g in e.get('details',[])]}
 numbers={13.4:a,13.65:a,6.0:max(.1,b-a),20.66:a,21.0:a+.3,20.75:a,36.7:b}
 kind='stage2' if e.get('kind')=='document' else 'stage1'
 load(source,['ease','fade','txt','path','pill','rr',kind],scope,Bindings(strings,values,numbers))
 return scope,kind
