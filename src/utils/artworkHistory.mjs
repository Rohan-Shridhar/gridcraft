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
      if (state.cells[action.index] === action.color) return state;
      const cells = [...state.cells];
      cells[action.index] = action.color;
      return replaceCells(state, cells);
    }
    case "replace":
      return replaceCells(state, [...action.cells]);
    case "clear":
      return replaceCells(state, Array(state.cells.length).fill(null));
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
