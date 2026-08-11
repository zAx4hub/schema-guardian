/** schema-guardian — Block breaking migrations. Author: zAx4hub */
export type Column = { name: string; type: string; nullable?: boolean; primaryKey?: boolean };
export type Table = { name: string; columns: Column[] };
export type Report = {
  project: string;
  author: string;
  summary: string;
  score: number;
  findings: Array<Record<string, unknown>>;
  metrics: Record<string, number>;
  allowed?: boolean;
};

const AUTHOR = "zAx4hub";
const TYPE_RANK: Record<string, number> = {
  int: 1,
  bigint: 2,
  float: 3,
  double: 4,
  text: 5,
  varchar: 5,
  json: 6,
};

export function diffTables(before: Table[], after: Table[]) {
  const findings: Array<{ id: string; kind: string; severity: "block" | "warn" | "info"; detail: string }> = [];
  const bMap = new Map(before.map((t) => [t.name, t]));
  const aMap = new Map(after.map((t) => [t.name, t]));
  for (const [name, bt] of bMap) {
    const at = aMap.get(name);
    if (!at) {
      findings.push({ id: name, kind: "drop_table", severity: "block", detail: `table ${name} removed` });
      continue;
    }
    const bc = new Map(bt.columns.map((c) => [c.name, c]));
    const ac = new Map(at.columns.map((c) => [c.name, c]));
    for (const [cn, col] of bc) {
      const next = ac.get(cn);
      if (!next) {
        findings.push({ id: `${name}.${cn}`, kind: "drop_column", severity: "block", detail: "column removed" });
        continue;
      }
      if (col.type !== next.type) {
        const widen = (TYPE_RANK[next.type] ?? 0) >= (TYPE_RANK[col.type] ?? 0);
        findings.push({
          id: `${name}.${cn}`,
          kind: "type_change",
          severity: widen ? "warn" : "block",
          detail: `${col.type}→${next.type}`,
        });
      }
      if (col.nullable && next.nullable === false) {
        findings.push({ id: `${name}.${cn}`, kind: "null_to_notnull", severity: "block", detail: "nullability tightened" });
      }
      if (col.primaryKey && !next.primaryKey) {
        findings.push({ id: `${name}.${cn}`, kind: "pk_removed", severity: "block", detail: "primary key removed" });
      }
    }
    for (const [cn, col] of ac) {
      if (!bc.has(cn)) {
        const sev = col.nullable === false ? "warn" : "info";
        findings.push({ id: `${name}.${cn}`, kind: "add_column", severity: sev, detail: `added ${col.type}` });
      }
    }
  }
  for (const name of aMap.keys()) {
    if (!bMap.has(name)) findings.push({ id: name, kind: "add_table", severity: "info", detail: "table added" });
  }
  return findings;
}

export function run(input: { before?: Table[]; after?: Table[] } = {}): Report {
  const before =
    input.before ??
    [
      {
        name: "users",
        columns: [
          { name: "id", type: "int", primaryKey: true },
          { name: "email", type: "varchar", nullable: false },
          { name: "age", type: "int", nullable: true },
        ],
      },
    ];
  const after =
    input.after ??
    [
      {
        name: "users",
        columns: [
          { name: "id", type: "int", primaryKey: true },
          { name: "email", type: "text", nullable: false },
          { name: "age", type: "int", nullable: false },
        ],
      },
    ];
  const diffs = diffTables(before, after);
  const blocks = diffs.filter((d) => d.severity === "block");
  const findings = diffs.map((d) => ({
    id: d.id,
    text: `${d.kind}: ${d.detail}`,
    score: d.severity === "block" ? 0 : d.severity === "warn" ? 0.5 : 1,
    tag: d.severity,
  }));
  const allowed = blocks.length === 0;
  return {
    project: "schema-guardian",
    author: AUTHOR,
    summary: allowed ? `Migration allowed; changes=${diffs.length}` : `BLOCKED; breaking=${blocks.length}`,
    score: allowed ? 1 : Math.max(0, 1 - blocks.length * 0.25),
    findings,
    metrics: { changes: diffs.length, blocks: blocks.length, warns: diffs.filter((d) => d.severity === "warn").length },
    allowed,
  };
}

export function demo(): Report {
  return run();
}

export function inspect() {
  return {
    name: "schema-guardian",
    author: AUTHOR,
    oneLiner: "Block breaking migrations",
    features: ["drop detect", "type narrowing", "null tighten", "allow/block"],
    version: "0.1.0",
    commands: ["demo", "run", "inspect"],
  };
}

export function similarity(a: string, b: string): number {
  return a === b ? 1 : 0;
}
export function rank(text: string): number {
  return Math.min(1, text.length / 40);
}
