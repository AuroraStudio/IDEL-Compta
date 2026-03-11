# IDEL Compta — Tableau de bord infirmier libéral

Outil de suivi comptable et de simulation de cotisations pour infirmiers libéraux (IDEL).

## Fonctionnalités

- **Dashboard** : KPIs en temps réel (CA, bénéfice BNC, revenu net, lissé mensuel)
- **Saisie mensuelle** : CA + charges déductibles (véhicule, blanchissage, matériel, assurances, divers)
- **Simulation cotisations** : URSSAF et CARPIMKO calculées selon l'année d'exercice (1ère, 2ème, 3ème+)
- **Régimes fiscaux** : Micro-BNC (34% abattement) ou Réel BNC (frais réels / 2035)
- **Alertes** : provision mensuelle recommandée, risque de régularisation en années 1-2

## Chiffres encodés (2025)

### CARPIMKO
- Retraite complémentaire : 2 312 € forfait + 3% (revenus entre 25 246 € et 237 179 €)
- Invalidité-décès : 1 022 €
- ASV (part assurée) : 236 €
- Retraite de base : ~10.75% du bénéfice (à partir de l'année 3)

### URSSAF
- Maladie : 4% à 6.7% selon revenus
- Allocations familiales : 0% à 3.1%
- CSG/CRDS : 9.7%
- Retraite de base : ~10.75%
- Invalidité-décès : 1.3% (plafonné au PASS)

## Installation et déploiement

```bash
npm install
npm run dev      # Dev local
npm run build    # Build production
```

### Déploiement Vercel

1. Push le projet sur un repo GitHub
2. Connecte le repo à Vercel (vercel.com)
3. Vercel détecte automatiquement la config (vercel.json inclus)
4. Deploy !

## Notes importantes

Les calculs sont des **estimations indicatives** basées sur les taux 2025.
La régularisation réelle dépend des revenus N-1 déclarés à l'URSSAF et à la CARPIMKO.
Il est recommandé de consulter un expert-comptable spécialisé IDEL pour la déclaration 2035.
