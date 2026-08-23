# Direction UI Navex — tokens à ajouter à `tailwind.config.ts`

Inspiration : cartes saturées par bloc sur fond neutre, grille colorée = donnée métier,
coins très arrondis (2xl/3xl), une seule carte "hero" par écran.

```ts
// apps/web/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        navex: {
          bg: "#FAFAF9",       // fond général (stone-50)
          ink: "#171717",      // texte principal
          amber: {
            DEFAULT: "#F4A825", // accent primaire — CTA, statut "en cours"
            soft: "#FDECC8",
          },
          alert: {
            DEFAULT: "#E8483B", // maintenance, fragile, hero critique
            soft: "#FBE0DD",
          },
          info: {
            DEFAULT: "#2F6FED", // en transit / à traiter
            soft: "#DCE6FC",
          },
          success: {
            DEFAULT: "#16A34A", // positionné / complet
            soft: "#DCF5E5",
          },
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,23,23,0.04), 0 8px 24px -8px rgba(23,23,23,0.08)",
      },
    },
  },
};
```

## Règle d'usage (à respecter pour que ça ne devienne pas criard)

- Une seule carte saturée "hero" par écran maximum — tout le reste en blanc/stone-100 avec bordure fine.
- Les couleurs des badges de statut (déjà définis dans `status-badge.tsx`) doivent être les
  **mêmes** couleurs que celles de la grille d'occupation et des stat-cards — pas de palette parallèle.
- Radius : `rounded-2xl` sur les cartes, `rounded-full` sur les badges/boutons pill, jamais de `rounded-none`.
