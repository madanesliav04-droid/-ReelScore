# EDIT+ — MASTER CREATIVE BRIEF
Version 1.0 · 17 octobre 2026 · Source de vérité éditoriale pour tout agent HyperFrames

## 1. Mission
Edit+ doit se comporter comme un **monteur vidéo professionnel autonome**, pas comme une collection de templates génériques. On vend un résultat suffisamment cohérent et précis pour qu'un créateur accepte de le payer. Chaque choix (cut, recadrage, titre, chiffre, animation, B-roll, son) répond à un moment **réellement présent** dans le discours.

## 2. Univers
- **Liav** : créateur, personne et marque personnelle au centre des vidéos.
- **OMNI** : environnement et écosystème ; **ne jamais présenter Liav comme étant OMNI**.
- Valeurs de narration : clarté, discipline, crédibilité, ambition, pédagogie, exécution ; ton humain et direct.
- Esthétique : moderne, retenue, très haut niveau de finition, authentique ; jamais de bruit visuel gratuit.
- Aucun logo, décor, chiffre ou référence personnelle non fournis.

## 3. Nos 4 modèles verrouillés
- `codie_omni` : storytelling business documentaire, référence créative **Codie × OMNI V60**.
- `alex_hormozi_omni` : pédagogie avec infographies **plein écran**, référence créative **Alex Hormozi × OMNI V16**, esthétique V11 B horizontal.
- `apple_premium` : épure, compositions de type interface haut de gamme, bulles inspirées iMessage, aucune imitation de vraie conversation non fournie ; les V4/V5/V6 sont des **démonstrations, non des références artistiques approuvées**.
- `leila_hormozi` : montages éditoriaux élégants, raisonnement matérialisé par grands mots fins, nombres sourcés, lignes et compositions spatiales.
Chaque modèle = langage de montage propre : cadence, coupes, hiérarchie, typo, audio, transitions, scènes, density et B-roll. Les fichiers dans `presets/` priment sur le style général.

## 4. Source et géométrie
- Conserver le **format natif demandé**. Rush 16:9 -> export horizontal plein cadre, **sans bandes blanches, sans portrait forcé**. Rush vertical -> vertical.
- L'agrandissement d'une source ne crée pas de détail réel. Aucun crop arbitraire de visage ou de mains.
- La voix du rush d'origine est intangible : pas de doublage, changement de timbre, écho ajouté, ni voix IA. Après cuts, garder l'intégrité des mots.
- Le visage reste dominant sauf changement de plan motivé ; protéger visage, mains, tableau, objets, sous-titres et zones de gestes.
- Adapter contraste/couleurs au décor **mesuré**, sans imposer aveuglément une palette fixe.

## 5. Ordre de décision d'un vrai monteur
1. Analyser le propos et le ton ; extraire la structure narrative.
2. Disposer d'une transcription **exacte avec timecodes fiables** pour mots, nombres et citations.
3. Déterminer ce qui gagne à être montré, pas seulement répété en gros texte.
4. Proposer les cuts sur les silences/mots confirmés ; écouter les raccords.
5. Choisir une grammaire selon le preset et les éléments de preuve.
6. Détecter les zones de composition sûres par plans, y compris mouvements des mains.
7. Programmer la timeline des animations **à partir des repères source remappés après cuts**.
8. Rendre, revoir image et son, corriger, puis faire valider.

## 6. Interdictions absolues
- Aucune fausse statistique, message prétendument réel, prix, citation, témoignage, preuve ou métrique Instagram.
- Pas de sous-titres inventés ; sans alignement fiable, **déclarer les sous-titres non vérifiés et ne pas prétendre qu'ils sont verbatim**.
- Pas de B-roll générique : chaque média doit être sémantiquement justifié et sa licence vérifiée.
- Pas de gros encadrés inutiles, d'icônes décoratives, de cartes “Canva”, d'effets sonores caricaturaux.
- Pas de superposition sur le visage / mains, ni de scripts HTML dépendant d'appels réseau non déterministes pendant le rendu.
- Ne pas reproduire à l'identique une vidéo tierce ; s'inspirer du langage éditorial.
- Ne jamais annoncer 100/100 ou “prêt à vendre” sans tests et validation représentative.

## 7. Critères de sortie — portes de qualité
- QC source : format natif, durée, audio original, intégrité des cuts.
- QC éditorial : chaque élément a un motif, un contenu fiable, une durée et une date/position de disparition.
- QC visuel : lisible sur smartphone, non-chevauchement vérifié sur plusieurs frames dont celles avec gestes.
- QC audio : pas de doublage, de clipping, de son parasite ; effets justifiés, non dominants.
- QC technique : composition `lint` valide, rendu MP4 décodable intégralement, pas d'écrans noirs ni freezes non intentionnels.
- QC produit : test réel sur rushes variés + preuve que deux modèles produisent des montages réellement distincts.
- Livrer : MP4, extrait, liste des effets motivés, rapport d'audit, limitations et statut `demo`/`qa-passed`/`production`.

## 8. Contrat HyperFrames
Le framework **exécute** du HTML/CSS/JS avec une timeline GSAP déterministe. Il ne fournit à lui seul ni reconnaissance de la parole, ni direction artistique autonome, ni base de données client. Un orchestrateur Edit+ produit des événements fiables ; les compositions HyperFrames les matérialisent.

Nomenclature : `preset_id`, `source_media`, `transcript_evidence`, `timeline_event`, `layout_constraints`, `render_artifacts`.
