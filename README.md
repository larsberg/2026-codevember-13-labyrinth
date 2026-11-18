# Little Bites · Codevember 13 / Labyrinth

A black-and-white family diner placemat game in Three.js. Click or tap the crayon, press GO, then drag through the maze to the burger. Lift to rest and resume on the end of your mark. The drawn tip and printed wall widths both count for contact. The maze has 210 cells. A collision stamps FAILURE on the menu, drops the crayon with Box3D, and triggers a bass-heavy spoken announcement with a long stereo echo.

Tap the paper after a win or loss to retry the same maze. Press F to preview the “YOU FAILED” voice. H opens the drawer; its Audio tab includes the live distortion control (0% keeps the original sound). Space generates another menu. M toggles sound, P pauses, and H opens the inherited studio controls. Development Save/Reload uses the existing setup API and public/settings.json.

Run `npm run dev` on port 1234. `npm run check` exercises wall grazing, fast swipes, lifting, solvability and settings persistence, then builds the sketch.
