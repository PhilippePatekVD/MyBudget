# Family Office — MyBudget v2

Refonte complète de l'ancien `Family Hub v0.1.15` en conservant les données Firebase existantes et les mêmes collections.

## Philosophie

Le projet reste un outil familial/personnel gratuit de consultation et de saisie. Il ne déclenche aucune transaction financière et n'utilise aucune API IA payante.

## Modules

- Vue d'ensemble
- Budget / journal des flux
- Patrimoine : liquidités, bourse, consolidation
- Prévoyance : 3a et projection 2e pilier
- Préparation fiscale (sans faux calcul d'impôt exact)
- Immobilier : amortissement théorique des financements
- Crédits à la consommation
- Projets
- Sport

## Compatibilité des données

Les collections Firestore historiques sont conservées :

- `transactions`
- `bourse`
- `creditsconso`
- `projects`
- `pillar3`
- `sport`
- `watchlist`
- `savings/{uid}`
- `immo/{uid}`
- `prevoyance2/{uid}`
- `taxconfig/{uid}`

L'ancienne application est archivée dans `legacy/index-v0.1.15.html`.

## Coût

Aucun nouveau service payant n'a été ajouté. Le projet continue d'utiliser Firebase tel qu'il était déjà configuré et GitHub Pages. Vérifier que le projet Firebase reste sur le niveau gratuit souhaité et dans ses quotas si l'objectif est de garantir zéro facturation.

## Fiscalité

Le précédent calculateur d'impôt utilisait une formule simplifiée donnant une précision trompeuse. La v2 conserve les données de préparation fiscale (revenu, fortune, déductions, provision mensuelle choisie) mais ne prétend plus produire un montant d'impôt officiel.

Le plafond 3a utilisé comme repère 2026 est de CHF 7'258 pour une personne salariée affiliée au 2e pilier. Il s'agit d'un plafond individuel.

## Déploiement

Application statique compatible GitHub Pages et installable sur iPhone comme webapp/PWA.
