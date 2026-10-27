# Alex V16 — test automatique depuis un rush brut

Un nouveau MP4 a été généré depuis le vrai rush vertical de 27 secondes, et non depuis le master monté. Le test final a refait la transcription hors ligne : aucun fichier de transcription ou plan de montage fourni manuellement. Les trois infographies utilisent les mots et leurs horaires du nouveau rush. Le master n’est pas une entrée de ce pipeline.

## Résultats exécutés

- Import HTTP local authentifié : 202 ; sans authentification : 401.
- Sélection du modèle `hormozi_omni`, appel du même générateur que le worker Social+.
- Lecture avant résultat refusée (409), progression réelle monotone, lecture MP4 Range (206), téléchargement (200), empreinte téléchargée identique.
- MP4 H.264/AAC/faststart, 512×910 natif, 30 fps, 815 images, 27,166667 s, 1 703 166 octets.
- Décodage intégral exécuté. Une seule piste AAC, bitstream identique au rush original : aucune voix ajoutée, aucun filtre audio ni changement de tonalité.
- 107 mots présents dans le plan et dans les sous-titres ; 107 surlignages contrôlés dans les pixels décodés, au milieu de chaque intervalle. Fraction minimale de pixels de glyphe bleu attendus : 93,79 %.
- Retard maximal dû à la grille vidéo par rapport aux timestamps ASR : 28,67 ms. Ce résultat n’est PAS une preuve d’alignement phonétique indépendant.
- Aucun silence long entre phrases ne justifiait un cut : aucun cut artificiel imposé. Le mécanisme de cuts conservateurs est testé unitairement, pas revendiqué comme validé sur un rush contenant de multiples silences longs.
- 67 tests Node et 13 tests Python réussis ; syntaxe du worker vérifiée. Correction de contrat SQL testée deux fois sur PostgreSQL 17 local isolé : Alex accepté, valeurs antérieures préservées, valeurs invalides refusées, RLS conservée. Aucune base distante modifiée.

## Défauts corrigés pendant ce test

Le MOV brut avait une cadence irrégulière. La stabilisation native à 30 fps sans crop ni filtre audio supprime le blocage. Les sous-titres sont désormais présents sur les séquences filmées aussi, avec groupes stables, lignes équilibrées et contours allégés : plus de mot « un » isolé en fin de ligne au premier passage. La version portrait redessine les vecteurs à la taille native : titres 28 px, légendes 18–20 px, sous-titres 24 px à largeur 512. Les trois flèches/nœuds restent lisibles et séparés. Les sous-titres commencent à 76 % de la hauteur portrait, avec deux lignes contenues au-dessus de 83 % : une marge conservatrice vis-à-vis des contrôles bas, sans certification Instagram/TikTok sur appareil physique. Images de contrôle à 1, 7, 11, 17,2, 24,8 et 26,1 s inspectées.

## Limites — modèle non validé commercialement

1. Cinq entrées de transcription restent incertaines (détails dans les livrables privés). Les mots n’ont pas été devinés, corrigés sans preuve ou marqués « validés ». La vérification phonétique exacte nécessite leur écoute humaine.
2. Le planificateur déterministe reconnaît actuellement certaines structures françaises de conseil commercial : expliquer versus problème existant, vente facilitée et démonstration de solution. Un sujet hors de ces structures est refusé explicitement ; il n’obtient pas des infographies génériques. Ce n’est donc pas encore un directeur sémantique universel.
3. La police exacte historique n’est pas retrouvée. Les variantes Inter libres existantes sont réutilisées ; les métriques et l’adaptation portrait restent soumises à validation visuelle. Aucun score 100/100 ni fidélité parfaite revendiqués.
4. Le test HTTP est un banc d’intégration local utilisant de vrais fichiers et le vrai renderer partagé. Ce n’est pas le déploiement Vercel/Supabase, et aucun Safari sur iPhone physique n’a été testé. La persistance distante et l’image Docker optionnelle restent non exécutées.
5. Les indicateurs serveur/Edge et le sélecteur Alex restent désactivés par défaut. Aucun déploiement, abonnement, dépense, fusion ou modification de production.


Les détails de transcription, extraits audio et vidéos restent dans les livrables privés.

Commande et configuration : `apps/worker/reconstruction/alex-v16/README.md`. Le code est sauvegardé sans mise à jour de la référence Git de la PR afin de ne pas déclencher le hook de production.
