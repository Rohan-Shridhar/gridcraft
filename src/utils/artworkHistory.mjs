const MAX_HISTORY = 15;

export function createArtworkHistory(cells) {
  return { cells: [...cells], history: [], future: [] };
}

export function artworkHistoryReducer(state, action) {
  switch (action.type) {
    case "reset":
      return createArtworkHistory(action.cells);
    case "resetHistory":
      return { ...state, history: [], future: [] };
    case "paint": {
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= state.cells.length ||
        state.cells[action.index] === action.color
      ) {
        return state;
      }
      const cells = [...state.cells];
      cells[action.index] = action.color;
      return replaceCells(state, cells);
    }
    case "fill": {
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= state.cells.length ||
        !Number.isInteger(action.gridSize) ||
        action.gridSize <= 0
      ) {
        return state;
      }
      const cells = floodFill(
        state.cells,
        action.index,
        state.cells[action.index],
        action.color,
        action.gridSize
      );
      return cells === state.cells ? state : replaceCells(state, cells);
    }
    case "fillEmpty": {
      if (action.color === null || !state.cells.includes(null)) return state;
      return replaceCells(
        state,
        state.cells.map((cell) => (cell === null ? action.color : cell))
      );
    }
    case "replace":
      return replaceCells(state, [...action.cells]);
    case "clear": {
      if (state.cells.every((cell) => cell === null)) return state;
      return replaceCells(state, Array(state.cells.length).fill(null));
    }
    case "undo":
      if (!state.history.length) return state;
      return {
        cells: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
        future: [state.cells, ...state.future.slice(0, MAX_HISTORY - 1)],
      };
    case "redo":
      if (!state.future.length) return state;
      return {
        cells: state.future[0],
        history: [...state.history.slice(-MAX_HISTORY + 1), state.cells],
        future: state.future.slice(1),
      };
    default:
      return state;
  }
}

function replaceCells(state, cells) {
  return {
    cells,
    history: [...state.history.slice(-MAX_HISTORY + 1), state.cells],
    future: [],
  };
}

function floodFill(cells, index, targetColor, fillColor, gridSize) {
  if (targetColor === fillColor) return cells;
  const newCells = [...cells];
  const stack = [index];
  const visited = new Set();

  while (stack.length > 0) {
    const idx = stack.pop();
    if (visited.has(idx)) continue;

    const row = Math.floor(idx / gridSize);
    const col = idx % gridSize;

    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) continue;
    if (newCells[idx] !== targetColor) continue;

    newCells[idx] = fillColor;
    visited.add(idx);

    if (col > 0) stack.push(idx - 1);
    if (col < gridSize - 1) stack.push(idx + 1);
    if (row > 0) stack.push(idx - gridSize);
    if (row < gridSize - 1) stack.push(idx + gridSize);
  }

  return newCells;
}
