# Import et contrôle technique sur l’appareil

`/analyse-locale` permet de choisir un fichier réel, le visionner et calculer des
mesures depuis le navigateur. Aucun fichier n’est envoyé ou conservé sur un
serveur. Le code original d’analyse éditoriale et les six moteurs sont inchangés.

Ce parcours **ne remplace pas** l’analyse éditoriale Social+ : pas de transcription,
de diagnostic du hook, de clarté/CTA/rétention ni de score sur 100. Ces éléments
restent indisponibles sans backend isolé. Le bouton de la section Analyse de
`/apercu` mène explicitement à ce contrôle technique, distinct du bouton serveur.

Mesures réelles : dimensions/durée natives du lecteur ; si le navigateur décode
la piste, crête et RMS dBFS, fenêtres de faible énergie sous −35 dBFS pendant au
moins 0,3 seconde. Une pause est à réécouter, pas automatiquement à couper.
Les crêtes proches de 0 dBFS ne certifient pas à elles seules une distorsion.
Le rapport JSON peut être téléchargé localement ; il ne certifie ni LUFS, ni
synchronisation phonétique, ni décodage complet d’un fichier quelconque.

Limites : lecture jusqu’à 200 Mo ; test jusqu’à 10 minutes ; audio décodé seulement
pour les fichiers ≤40 Mo et ≤90 secondes afin de limiter la mémoire sur iPhone.
Un échec de décodage affiche « audio non mesuré » et ne prétend pas que la vidéo
est muette. MOV/HEVC dépend des codecs du navigateur. Le résultat dépend des
échantillons décodés et de la version du navigateur ; même PCM/paramètres donne
les mêmes mesures, pas une garantie entre tous les décodeurs.

Validation locale exécutée : 3 tests réussis sur Chromium, avec un vrai MP4
H.264/AAC synthétique autorisé de 2 secondes (aucun média personnel), mesure
audio et détection d’une pause connue, lecture avec progression de currentTime,
téléchargement JSON et retrait du fichier. Aucun POST/PUT ni appel API n’a été
observé pendant ce parcours. Test de fichier vide et test déterministe sur PCM
connus réussis. Build Next.js et TypeScript réussis.

WebKit Linux a été téléchargé, mais son lancement n’a pas pu être testé : les
bibliothèques système manquent et l’installation via `su` a été refusée. Aucun
test Safari physique n’est annoncé. Le sélecteur `PLAYWRIGHT_BROWSER=webkit` est
préparé pour une machine disposant de ces dépendances. Aucun paquet applicatif
ni service payant n’a été ajouté.

Le 28/10, l’inventaire Railway confirme un seul environnement, **production**.
Il n’a été ni modifié ni utilisé pour contourner l’absence de backend de test.
