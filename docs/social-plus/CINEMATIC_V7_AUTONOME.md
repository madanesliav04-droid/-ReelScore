# Cinematic V7 — commande autonome locale

Cette commande utilise une nouvelle vidéo et ses propres mots. Elle ne lit ni les images, ni l’audio, ni les horaires du master V6/V7. Les fonctions graphiques originales de `render_v6_historique.py` restent la source des quatre compositions utilisées par la V7 validée : titre blanc/doré, chaîne, idée principale et cartes. Elles sont chargées par AST sans exécuter le script historique.

## Générer un montage

Prérequis existants : Node 24+, Python 3.10+, NumPy, Pillow, FFmpeg et FFprobe. Les polices libres et leurs licences sont déjà embarquées. Aucun service distant, voix générée ou API payante n’est appelé.

Avec une transcription du nouveau rush :

```bash
node apps/socialplus/scripts/render-cinematic-v7.mjs --input rush.mov --transcript mots.json --output cinematic.mp4 --preview
```

Schéma minimal de `mots.json` (horaires **du rush brut**, pas du master ni d’un montage précédent) :

```json
{"reviewed":false,"words":[{"text":"Bonjour","startMs":500,"endMs":900},{"text":"à","startMs":910,"endMs":1000},{"text":"tous.","startMs":1010,"endMs":1350}]}
```

`sourceSha256` peut lier explicitement ce fichier au SHA-256 du rush. Les entrées `word/start/end` en secondes sont aussi acceptées. Les durées des mots ne sont jamais réparties artificiellement depuis une phrase entière.

Sans `--transcript`, la commande appelle la transcription Whisper locale existante. Il faut préparer une fois l’environnement gratuit décrit dans `apps/socialplus/engines/requirements-asr.txt` et renseigner `SOCIALPLUS_ASR_MODEL_DIR` (poids locaux) et, si nécessaire, `SOCIALPLUS_ASR_MODULE_DIR` (modules Python). Aucun poids n’est téléchargé au rendu.

Windows PowerShell, après installation des prérequis :

```powershell
$env:SOCIALPLUS_ASR_MODEL_DIR = 'C:\SocialPlus\whisper-small'
$env:SOCIALPLUS_ASR_MODULE_DIR = 'C:\SocialPlus\asr-packages'
node apps/socialplus/scripts/render-cinematic-v7.mjs --input 'C:\Videos\rush.mov' --output 'C:\Videos\cinematic.mp4' --preview
```

Ce test n’a pas été exécuté sur une machine Windows. Avec `--transcript`, les variables ASR ne sont pas nécessaires.

## Ce que fait le moteur

- Détection locale des pauses, marges conservées et garde de 120 ms autour des intervalles ASR bruts. Une frontière de phrase ou un intervalle suffisamment long entre mots est exigé. Les pauses ambiguës restent intactes ; ce filtre ne prétend pas comprendre la prosodie avec certitude.
- Sélection déterministe de phrases contiguës dans les mots du rush, hors des mots incertains, avec au plus quatre séquences et un budget de 35 % du rush. Les cartes secondaires citent des propositions entières avec leur vrai déclenchement, sans recomposition en paquets arbitraires.
- Caméra native inchangée dans les plans parlés ; graphismes plein écran d’origine, sans B-roll, tracking fictif, recadrage du visage ou réutilisation de pixels du master.
- Animations originales et transitions smoothstep de 0,22 s, texte ajusté à des zones contrôlées. Les sous-titres fins, blancs et dorés, sont masqués sur les graphismes et reprennent aux bonnes bornes côté caméra.
- Export H.264/AAC avec une seule piste de voix issue de la nouvelle source. La coupe réencode l’AAC, sans doublage ni modification de hauteur. Sans coupe et pour une source AAC, la piste est copiée.

Les sorties sont `cinematic.mp4`, `cinematic.mp4.plan.json` (mots source et sortie, scènes, cuts, avertissements) et `cinematic.mp4.result.json`. Les sorties existantes et le rush ne sont jamais écrasés. Conserver les plans/transcriptions dans un stockage privé.

## Validation et limites

```bash
node --test apps/socialplus/server/cinematic-plan.test.mjs apps/socialplus/server/speech-captions.test.mjs
python -m unittest discover -s apps/socialplus/engines -p test_cinematic_scenes.py
python apps/socialplus/scripts/verify-cinematic-v7.py rush.mov cinematic.mp4
```

Le dernier script vérifie le décodage intégral, la définition native, les codecs, la voix par corrélation après les coupes et les images des plages caméra. Avec une trace `strace -f -e trace=openat` nommée `io-trace.log` à côté de la sortie, il contrôle aussi l’absence de lecture des anciens médias/timings. Il produit un rapport et une planche de captures privées.

Port actuel : rushs de 60 secondes au plus, dimensions paires jusqu’à 1080p, graphismes à 30 images/s. Le test réel de cette mission est horizontal 910×512. La lisibilité portrait n’est pas certifiée. Les métriques des polices libres peuvent différer des fontes historiques.

`--preview` ne confirme aucun mot. Une probabilité ASR faible, une entrée contenant plusieurs mots sans frontières distinctes ou un drapeau `reviewRequired` restent signalés. Sans `--preview`, une transcription réellement relue est exigée, avec des mots individuels horodatés et les ambiguïtés explicitement confirmées. Ni cette case ni une corrélation audio ne remplacent une validation phonétique indépendante. Le score commercial et `releaseApproved` restent non validés.
