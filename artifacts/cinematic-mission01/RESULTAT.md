# Mission 01 — Cinematic V7 autonome

**Autonomie technique exécutée sur un nouveau rush parlé. Validation phonétique et commerciale non acquise.**

Le script V7 original réutilisait les images/voix de V6 et des horaires fixes. La nouvelle commande conserve les fonctions de dessin historiques, chargées seules, et utilise le nouveau rush, sa voix et ses propres horaires. Aucun moteur des cinq autres modèles ni interface n’est développé. Les modifications aux fichiers partagés sont conditionnées à Cinematic.

## Résultats réellement exécutés

- Commande sans transcription fournie : ASR locale CPU, plan automatique, coupe et export MP4 réussis. Après les corrections du plan et des sous-titres, le rendu final réutilise cette transcription, sans nouvelle inférence ASR inutile.
- Huit tests Node ciblés réussis. Un test Python exerce les quatre compositions graphiques originales avec de nouveaux textes et interdit l’accès aux anciens médias/timings.
- Rush source de 47,100 s : sortie 45,637 s, 910×512 natif horizontal, H.264/AAC, une piste audio stéréo. Décodage intégral sans erreur.
- Quatre scènes automatiques, transitions smoothstep 0,22 s, titres blancs/dorés et cartes déclenchées par les phrases courantes. Captures d’entrée, milieu et sortie inspectées ; aucune certification de lecture continue à vitesse réelle n’est revendiquée.
- Une pause coupée : 8,187–9,640 s. Une autre pause conservée faute de preuve de frontière suffisante. Les intervalles ASR et marges autour des mots empêchent les coupes sur les syllabes indiquées. Ce contrôle n’est pas une compréhension sémantique complète.
- Six comparaisons de voix originale : décalage mesuré nul à 8 kHz et corrélation minimale supérieure à 0,9994. Trois comparaisons d’images caméra : correspondance à une image près. Ces mesures ne prouvent pas chaque frontière phonétique.
- Trace `strace openat` du rendu complet : aucun accès à l’ancienne vidéo brute, aux vidéos V6/V7 ou au JSON historique de synchronisation. Les fonctions Python de dessin V6 sont intentionnellement réutilisées.

## Défauts restants

La transcription automatique a 19 entrées à confirmer, dont quatre regroupent plusieurs mots sans frontières acoustiques distinctes. Elles sont signalées, jamais validées automatiquement. Aucun horaire intermédiaire n’est inventé pour séparer ces groupes. Le mode normal exige des mots individuels relus ; ce rendu est explicitement une prévisualisation. L’écoute humaine et un alignement phonétique indépendant restent à faire.

Le choix de phrases graphiques est déterministe et cite le rush ; il ne remplace pas une direction narrative humaine. Le port est limité à 60 s, 1080p et dimensions paires ; graphismes à 30 fps. Le portrait et Windows n’ont pas été testés matériellement. Les polices libres embarquées ne garantissent pas les métriques historiques exactes. Aucun score de 100/100 ni autorisation de commercialisation n’est attribué.

## Livraison

Code : branche `codex/cinematic-v7-autonomous-20261024`. Commandes et schéma : `docs/social-plus/CINEMATIC_V7_AUTONOME.md`. Liste exacte des fichiers : `files-modified.json`. Mesures : `real-rush-qa.json`. Vidéo et transcription conservées dans le stockage privé, hors du code source. Aucun déploiement ni modification de la PR #53.
