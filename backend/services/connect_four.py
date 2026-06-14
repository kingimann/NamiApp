"""Connect Four engine: a 6×7 grid, drop a disc down a column, four-in-a-row
wins. Board is a 42-char string, index = row*7 + col, row 0 = top. Pieces are
'R' / 'Y'; '.' is empty. Includes a heuristic alpha-beta CPU.
"""
import random as _random
from typing import List, Optional

ROWS, COLS = 6, 7


def initial_board() -> str:
    return "." * (ROWS * COLS)


def _idx(r: int, c: int) -> int:
    return r * COLS + c


# Pre-compute every 4-in-a-row window (horizontal, vertical, both diagonals).
def _build_lines():
    lines = []
    for r in range(ROWS):
        for c in range(COLS):
            if c + 3 < COLS:
                lines.append([_idx(r, c + i) for i in range(4)])
            if r + 3 < ROWS:
                lines.append([_idx(r + i, c) for i in range(4)])
            if r + 3 < ROWS and c + 3 < COLS:
                lines.append([_idx(r + i, c + i) for i in range(4)])
            if r + 3 < ROWS and c - 3 >= 0:
                lines.append([_idx(r + i, c - i) for i in range(4)])
    return lines


_LINES = _build_lines()


def drop_row(board: str, col: int) -> int:
    """Lowest empty row in a column, or -1 if full."""
    for r in range(ROWS - 1, -1, -1):
        if board[_idx(r, col)] == ".":
            return r
    return -1


def drop(board: str, col: int, piece: str) -> Optional[str]:
    r = drop_row(board, col)
    if r < 0:
        return None
    b = list(board)
    b[_idx(r, col)] = piece
    return "".join(b)


def winner(board: str) -> Optional[str]:
    for a, b, c, d in _LINES:
        v = board[a]
        if v != "." and v == board[b] == board[c] == board[d]:
            return v
    return None


def is_full(board: str) -> bool:
    return "." not in board


def legal_cols(board: str) -> List[int]:
    return [c for c in range(COLS) if board[_idx(0, c)] == "."]


def _score_window(cells: List[str], me: str, opp: str) -> int:
    mine = cells.count(me)
    theirs = cells.count(opp)
    empty = cells.count(".")
    if mine and theirs:
        return 0
    if mine == 3 and empty == 1:
        return 50
    if mine == 2 and empty == 2:
        return 10
    if theirs == 3 and empty == 1:
        return -80
    if theirs == 2 and empty == 2:
        return -8
    return 0


def _evaluate(board: str, me: str, opp: str) -> int:
    score = 0
    # Centre column control is valuable.
    for r in range(ROWS):
        if board[_idx(r, 3)] == me:
            score += 6
        elif board[_idx(r, 3)] == opp:
            score -= 6
    for line in _LINES:
        score += _score_window([board[i] for i in line], me, opp)
    return score


def _negamax(board, me, opp, depth, alpha, beta):
    w = winner(board)
    if w == me:
        return 100000 + depth
    if w == opp:
        return -100000 - depth
    cols = legal_cols(board)
    if not cols or depth == 0:
        return _evaluate(board, me, opp)
    best = -10 ** 9
    for c in sorted(cols, key=lambda x: abs(x - 3)):   # centre-first ordering
        val = -_negamax(drop(board, c, me), opp, me, depth - 1, -beta, -alpha)
        if val > best:
            best = val
        if best > alpha:
            alpha = best
        if alpha >= beta:
            break
    return best


def cpu_col(board: str, me: str, opp: str, difficulty: str = "medium") -> Optional[int]:
    cols = legal_cols(board)
    if not cols:
        return None
    # Always take an immediate win or block one.
    for c in cols:
        if winner(drop(board, c, me)) == me:
            return c
    for c in cols:
        if winner(drop(board, c, opp)) == opp:
            return c
    if difficulty == "easy":
        return _random.choice(cols)
    depth = 6 if difficulty == "hard" else 4
    best, best_c = -10 ** 9, cols[len(cols) // 2]
    for c in sorted(cols, key=lambda x: abs(x - 3)):
        val = -_negamax(drop(board, c, me), opp, me, depth - 1, -10 ** 9, 10 ** 9)
        if val > best:
            best, best_c = val, c
    return best_c
