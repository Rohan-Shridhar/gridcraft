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

## Save artwork to an album

Sign in with GitHub to initialize your `gridcraft-artworks` library. Each album
is a folder at the repository root; each Story is a folder inside an album,
and each artwork is a JSON file inside its Story folder. Open an album and
choose a Story to browse and edit its artwork on the pixel canvas.

Canvas changes stay local until you select **Save to GitHub**. A save creates a
versioned commit in the shared artwork library and updates the artwork's file
version. If someone else changed that file in the meantime, GridCraft stops the
save. Compare the remote version, reload it (discarding local edits), or save
your local drawing under a new artwork name; remote changes are never silently
overwritten.

Use **Rename** to move an artwork to a new file name or **Delete** to remove it
from the album after confirmation. The editor also shows recent commits for the
artwork. Album artwork retains the same image import, PNG export, drawing tools,
undo/redo, transparency, and background-color controls as the standalone editor.

## Create Stories in an album

Sign in and open an album, then choose **Stories**. Create a Story, select
artworks from that album, and add them as ordered frames. Drag frames to reorder
them, or use the move buttons. Set each frame's duration, the default duration,
and whether playback loops. Use the timeline and playback controls to preview.
Select **Save Story** to commit its manifest to the album. Artwork pixels remain
in the artwork files; a Story stores only artwork references and timing.

Choose **Export GIF** to download a real animated GIF. Frames must use the same
grid size. Export is limited to 120 frames and 1,048,576 source pixels total to
avoid excessive browser memory use.

### Migrate old local Snaps

Existing browser Snaps are preserved for migration. In an album's Stories tab,
download a JSON backup first, then choose **Migrate to Story**. GridCraft creates
an artwork for each valid Snap and a Story in the original order, carrying over
titles, captions/notes, and durations. Migration does not delete local Snap
data. If a GitHub request fails partway through, GridCraft reports how many
artworks were already created; the browser data remains unchanged.

## Work with branches

Use the branch selector in an album or artwork editor to switch branches. Album
artworks and Stories are loaded from the selected branch, and new saves target
that branch. The **Branches** tab supports creating a branch from the current
branch, renaming or deleting eligible branches, comparing GitHub's actual
comparison, and viewing commit history. The library's default branch is marked
and cannot be deleted. Switching away from unsaved artwork or Story changes
asks before discarding them.

## Issues and pull requests

The **Issues** and **Pull Requests** tabs are GridCraft collaboration features,
not GitHub Issues or Pull Requests. GridCraft stores their titles, descriptions,
comments, reviews, and state in its application database. Issues can be filtered,
created, edited by their author or album owner, commented on, and closed or
reopened. Pull requests compare artwork and Story files between albums; the
base album owner can merge a request if the files have not changed since it was
opened. GitHub does not receive a corresponding issue or pull request.

## Fork an album

Choose **Fork album** to copy the album folder and all of its contents into your
own `gridcraft-artworks` repository. The copy appears as a separate album in
your dashboard and retains its source relationship in GridCraft. This is a
folder copy, not a GitHub repository fork.

## Other controls

- Use the theme button in the upper-right corner to switch between light and
  dark themes.
- Select the keyboard button in the top menu to view shortcuts.
- Select the book button in the top menu to open this manual.
