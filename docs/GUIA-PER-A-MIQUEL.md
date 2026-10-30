# Guia: què pots fer tu sol al projecte

Aquesta guia explica què pots millorar pel teu compte (dibuix, números, idees) sense
trencar res, i com comprovar-ho. Quan tornis a treballar amb Claude, digues-li què has
canviat i ho revisarà.

## Abans de començar

- Obre una terminal a la carpeta del projecte.
- `npm run dev` → obre el joc al teu ordinador a http://127.0.0.1:5199/brute/ . Els canvis
  es veuen sols quan guardes un fitxer.
- `npm test` → comprova que no s'ha trencat res (ha de dir que tots els tests passen).
- `npm run balance -- 500 classes` → mira l'equilibri de les classes (cada `!` és un problema).
- Treballa en una branca nova si vols provar coses: `git checkout -b proves-miquel`.

## 1. Jugar i apuntar (el més útil de tot)

- Juga al mòbil a https://miquelg151.github.io/brute/
- Guarda captures del que no t'agradi a la carpeta `captures/` (aquesta carpeta no es puja mai).
- Apunta en un fitxer `docs/idees.md`:
  - quines classes, branques o cartes et semblen massa fortes o massa fluixes;
  - què no s'entén (una carta, una pantalla, un botó);
  - idees noves: cartes, armes, mascotes, mecàniques.

## 2. Dibuix (Aseprite o qualsevol editor de píxel)

Tots els dibuixos són PNG a `public/art/` i la llista és a `public/art/manifest.json`.
Les instruccions detallades (mides de cada capa, ordre, frames d'animació) són a
`docs/ART.md`.

- **Retocar** un dibuix: obre el PNG, modifica'l i guarda'l amb el mateix nom i la mateixa
  mida. No cal tocar res més.
- **Veure-ho tot junt:** obre el joc afegint `?gallery` a l'adreça
  (http://127.0.0.1:5199/brute/?gallery).
- Si el mòbil continua mostrant el dibuix vell, espera uns minuts: es guarda a la memòria.

## 3. Icones

### Com funcionen ara

- Les icones (vida, força, mascota, habilitat...) estan dibuixades amb codi a
  `src/ui/icons.ts`, com una graella de lletres de **7 × 7 píxels**.
- Cada carta fa servir una d'aquestes icones. La llista "carta → icona" és `CARD_ICONS` a
  `src/ui/cardView.ts`.
- Els botons del pla (Stance, Target, Weapon use) també: la llista "opció → icona" és
  `OPTION_ICONS` a `src/ui/icons.ts`.
- El text que surt quan toques una estadística al Fighter tab és a `STAT_NOTES`
  (`src/ui/describe.ts`). El color fosc del nom de classe sobre paper (Bouncer) és a
  `classTextColor` (`src/ui/palette.ts`).
- El joc les mostra ampliades: cada píxel es veu de **3, 4 o 6 píxels** de pantalla segons
  el lloc (petit, normal, gran). Per això una icona de 7 × 7 es veu d'entre 21 i 42 píxels.

### Substituir una icona per un PNG teu (sense programar)

1. Dibuixa la icona a **7 × 7 píxels**, fons transparent.
2. Guarda-la a `public/art/icons/<nom>.png` (crea la carpeta `icons` si no existeix).
   El `<nom>` ha de ser un dels de `src/ui/icons.ts` (per exemple `health`, `pet`, `skill`,
   `magic`, `rage`...).
3. Afegeix-la al `public/art/manifest.json`, dins de l'objecte principal:
   ```json
   "icons": {
     "health": "icons/health.png",
     "pet": "icons/pet.png"
   }
   ```
4. Obre `?gallery` per veure-la.

Atenció: si canvies una icona que fa servir una carta, també canvia a la carta
(per exemple `icons/pet.png` canvia la icona de "Sic 'em" i de "Stray Dog").

### Més grans o més petites?

- **Recomanat: 7 × 7.** Totes les icones tenen aquesta mida i encaixen a les pantalles.
- **Pots fer-les de 8 × 8 o 9 × 9** si una icona ho necessita: es veurà una mica més gran,
  i normalment encara hi cap.
- **No facis icones de 14 × 14 o més grans:** com que el joc les amplia, es veurien el doble
  de grans i trencarien les pantalles. Si vols icones més detallades (per exemple 14 × 14 o
  16 × 16), digues-ho a Claude: caldrà canviar la mida a la qual el joc les amplia, i és
  un canvi petit de codi.
- Fes servir els colors del joc (la paleta és `PAL` a `src/ui/theme.ts`) perquè tot lligui.

### Afegir icones noves (una icona pròpia per a cada carta o habilitat)

Això necessita un petit canvi de codi. La manera més fàcil:

1. Dibuixa les icones a 7 × 7 i guarda-les a `public/art/icons/` amb el nom de la carta o
   habilitat, per exemple `icons/card-headbutt.png`, `icons/skill-combo.png`.
2. Fes una llista a `docs/idees.md`: "headbutt → icons/card-headbutt.png".
3. Quan tornis, Claude les connectarà (afegirà els noms a `icons.ts` i a `CARD_ICONS`).

Ara mateix les habilitats fan servir una **estrella genèrica**, així que les icones
d'habilitats són les que més es notarien. Els noms de les cartes i habilitats són a
`src/core/cards.ts` (cartes) i `src/core/catalog.ts` (habilitats, `SKILLS`).

## 4. Números (sense programar)

- `src/core/catalog.ts`:
  - `CLASSES`: estadístiques inicials de cada classe;
  - `WEAPONS`: mal (`damage`), precisió (`accuracy`) i si és pesada (`heavy`);
  - `PETS`: vida, mal, agilitat i velocitat de les mascotes;
  - `GEAR`: què dona cada peça d'equip;
  - `ORIGINS`: el bonus de cada origen.
- `src/core/cards.ts`: cost (`cost`) i text (`describe`) de cada carta.

Després de canviar un número:
1. `npm test` (si un test falla, potser comprova aquell número: digues-ho a Claude);
2. `npm run balance -- 500 classes` per veure si l'equilibri continua bé.

## 5. Colors i textos

- Colors de tot el joc: `PAL` a `src/ui/theme.ts`. Canviar-ne un el canvia a tot arreu.
- Noms i textos del joc (en anglès): són a `catalog.ts`, `cards.ts` i a les pantalles de
  `src/ui/screens/` i `src/ui/tabs/`.

## 6. Captures del mòbil sense mòbil

Amb el joc obert (`npm run dev`), en una altra terminal:
`npm run screens` fa captures de totes les pantalles a mida de mòbil a la carpeta `screens/`.
Va bé per veure si un canvi trenca alguna pantalla.

## 7. Pujar els canvis

Si vols, pots deixar-ho tot a la branca i que Claude ho revisi i ho pugi. Si ho vols pujar tu:
```
git add -A
git commit -m "El que has canviat"
git push
```
Recorda: pujar a `main` publica el joc a la web en un parell de minuts.
