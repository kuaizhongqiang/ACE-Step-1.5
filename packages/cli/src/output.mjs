/**
 * Output formatting — human readable + --json mode
 */
const output = { _json: false };

output.init = function (flags) {
  this._json = !!flags.json;
};

output.print = function (text) {
  process.stdout.write(text + '\n');
};

output.printError = function (text) {
  process.stderr.write(text + '\n');
};

output.json = function (obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
};

output.auto = function (text, jsonObj) {
  this._json ? this.json(jsonObj) : this.print(text);
};

output.table = function (headers, rows) {
  if (this._json) {
    this.json(rows);
    return;
  }
  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce((m, r) => Math.max(m, String(r[i] || '').length), 0);
    return Math.max(h.length, maxData) + 2;
  });
  // Header
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('');
  this.print(headerLine);
  this.print(colWidths.map(w => '─'.repeat(w)).join(''));
  // Rows
  for (const row of rows) {
    this.print(row.map((v, i) => String(v || '').padEnd(colWidths[i])).join(''));
  }
};

output.exit = function (code) {
  process.exit(code);
};

export default output;
