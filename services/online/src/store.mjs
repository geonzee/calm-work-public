import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export async function openStore() {
  const { PrismaClient } = require("../../../output/online-client");
  const db = new PrismaClient();
  await db.$connect();
  return {
    async read(id) {
      const row = await db.resource.findUnique({ where: { id } });
      return row ? { ...JSON.parse(row.value), revision: row.revision } : null;
    },
    async list(kind, after = "", limit = 100) {
      const rows = await db.resource.findMany({
        where: { kind, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: "asc" },
        take: limit + 1,
      });
      return {
        items: rows
          .slice(0, limit)
          .map((row) => ({ ...JSON.parse(row.value), revision: row.revision })),
        next: rows.length > limit ? rows[limit - 1].id : null,
      };
    },
    async create(id, kind, value) {
      await db.resource.create({
        data: { id, kind, value: JSON.stringify(value) },
      });
      return { ...value, revision: 0 };
    },
    async change(id, mutate) {
      for (let retry = 0; retry < 12; retry++) {
        const row = await db.resource.findUnique({ where: { id } });
        if (!row)
          throw Object.assign(new Error("Not found."), { statusCode: 404 });
        const value = JSON.parse(row.value);
        const result = mutate(value, row.revision);
        const changed = await db.resource.updateMany({
          where: { id, revision: row.revision },
          data: { value: JSON.stringify(value), revision: { increment: 1 } },
        });
        if (changed.count === 1) return { result, revision: row.revision + 1 };
      }
      throw Object.assign(
        new Error("This resource is busy. Retry your change."),
        { statusCode: 409 },
      );
    },
    async close() {
      await db.$disconnect();
    },
  };
}
