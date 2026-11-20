const challenges = {
  emptyCorner: {
    hint: { en: 'Finish with an empty top-left corner.', ru: 'Оставьте верхнюю левую клетку пустой.' },
    qualifies: grid => grid[0][0] < 0
  },
  trackSecondRow: {
    hint: { en: 'Keep the left cell of the second row empty.', ru: 'Оставляйте левую клетку второго ряда пустой.' },
    advance: (failed, event) => failed || Number(event.grid[1][0] >= 0),
    qualifies: (_grid, failed) => failed === 0
  }
};

export function getThirdStarChallenge(id) {
  return challenges[id];
}
