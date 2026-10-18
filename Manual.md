# GridCraft Manual

GridCraft is a browser-based pixel art editor. Draw on a square grid, import an
image to convert it into pixels, and export your finished artwork as a PNG.

## Open GridCraft

Use the live app at [gridcraft-by-me.vercel.app](https://gridcraft-by-me.vercel.app/).

To run it locally, install the project dependencies with `npm install`, then run
`npm run dev` and open the local address shown in the terminal.

## Draw on the canvas

Click a cell to color it, or click and drag to paint several cells. The canvas
starts at 16×16. Choose a color with the color picker in the tools bar, then
draw with the paint brush.

## Choose a grid size

Use the grid buttons below the canvas to choose a size:

| Size | Suitable for |
| --- | --- |
| 16×16 | Simple icons and small pixel art |
| 32×32 | More detailed icons |
| 64×64 | Detailed pixel art |
| 128×128 | Large, detailed drawings |

Changing the grid size asks for confirmation and clears the current drawing.
Grid lines are shown on the 16×16 grid; the larger grids open without grid lines.
Use the eye button below the canvas to toggle grid lines and preview the artwork.
In preview mode, drawing tools and grid-size controls are disabled. Undo and redo
remain available.

## Use the drawing tools

| Tool | What it does |
| --- | --- |
| Paint brush | Paint cells with the selected color |
| Eraser | Make painted cells transparent |
| Fill | Fill connected cells that have the same color as the clicked cell |
| Fill transparent cells | Fill every transparent cell with the selected color |
| Undo / Redo | Step backward or forward through recent drawing changes |
| Clear | Clear the canvas after confirmation |
| Color picker | Choose the active paint color |

GridCraft keeps up to 15 recent canvas changes for undo and redo.

### Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Undo | `Ctrl + Z` |
| Redo | `Ctrl + Y` |
| Paint brush | `A` |
| Eraser | `E` |
| Fill tool | `B` |
| Fill transparent cells | `C` |
| Clear canvas | `D` |

Clearing the canvas with the shortcut also asks for confirmation.

## Import an image

Select the import button in the top menu and choose an image file. GridCraft
resizes it to the current grid dimensions and converts its pixels into canvas
cells. Transparent image pixels remain transparent. If the image has more than
80 distinct colors, GridCraft asks whether to continue importing it.

## Export your artwork

Select the export button in the top menu to download the current canvas as a
PNG. The export removes grid lines and spacing, and preserves transparency.

## Save and present snapshots

Use **+ New Snap** in the Snaps panel to capture the current canvas. Snapshots
include the pixel colors, transparency, grid size, background, and slide
metadata. They are saved in this browser and restored when GridCraft is reopened.
The storage is local to the browser; clearing site data or switching browsers
does not transfer snapshots.

Select a snap to rename it, add an optional caption or notes, set its presentation
duration, or include it in or exclude it from the presentation. Reorder slides
with drag and drop or the move buttons. **Present** plays included slides in
their listed order.

Use a selected snap's image buttons to download it as SVG or PNG. **Export All**
downloads the full storyboard and metadata as a JSON backup; **Import** appends
snapshots from a GridCraft JSON export. Imports are validated, limited to 25 MB
and 100 snapshots, and do not run imported content. If saved data cannot be
recovered, export the recovered snaps before choosing to replace the unreadable
browser data.

Set **Frame duration** and choose **Export WebM** to create an animation from
the included slides. WebM export uses the browser's built-in media recorder and
is limited to 40 slides and two minutes per export. WebM support depends on the
browser.

## Other controls

- Use the theme button in the upper-right corner to switch between light and
  dark themes.
- Select the keyboard button in the top menu to view shortcuts.
- Select the book button in the top menu to open this manual.
