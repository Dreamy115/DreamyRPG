// Shamelessly stolen from https://github.com/Changaco/unicode-progress-bars
export const bar_styles = [
  '▁▂▃▄▅▆▇█',
  '⣀⣄⣤⣦⣶⣷⣿',
  '⣀⣄⣆⣇⣧⣷⣿',
  '○◔◐◕⬤',
  '□◱◧▣■',
  '□◱▨▩■',
  '□◱▥▦■',
  '░▒▓█',
  '░█',
  '⬜⬛',
  '▱▰',
  '▭◼',
  '▯▮',
  '◯⬤',
  '⚪⚫',
];
function repeat(s: string, i: number) {
  var r = '';
  for(var j = 0; j < i; j++)
    r += s;
  return r;
}
export function make_bar(percent: number, bar_style: string, max_size: number) {
  var d, full, m, middle, r = "", rest, x,
    min_delta = Number.POSITIVE_INFINITY,
    full_symbol = bar_style[bar_style.length - 1],
    n = bar_style.length - 1;
  if(percent == 100) return {
    str: repeat(full_symbol, max_size), delta: 0
  };
  percent = percent / 100;
  for(var i = max_size; i >= max_size; i--) {
    x = percent * i;
    full = Math.floor(x);
    rest = x - full;
    middle = Math.floor(rest * n);
    if(percent != 0 && full == 0 && middle == 0)
      middle = 1;
    d = Math.abs(percent - (full+middle/n)/i) * 100;
    if(d < min_delta) {
      min_delta = d;
      m = bar_style[middle];
      if(full == i) m = '';
      r = repeat(full_symbol, full) + m + repeat(bar_style[0], i-full-1);
    }
  }

  return {str: r, delta: min_delta};
}
// end shameless steal