import { describe, expect, it } from "vitest";
import { consoleFolders } from "./consoleRoots";

const sources = [
  { id: "93646454-77e1", name: "mysql-prod", driver: "mysql" },
  { id: "pg", name: "", driver: "postgres" },
] as never;

describe("consoleFolders", () => {
  it("lists a console folder under its data source's name", () => {
    expect(consoleFolders("/data/consoles/db", ["93646454-77e1"], sources)).toMatchObject([
      { label: "mysql-prod", path: "/data/consoles/db/93646454-77e1" },
    ]);
  });

  it("names the folder of another database of the source after both", () => {
    expect(consoleFolders("/d", ["93646454-77e1.orders"], sources)[0]?.label).toBe("mysql-prod: orders");
  });

  it("leaves out folders whose data source is gone", () => {
    expect(consoleFolders("/d", ["deleted-source", "93646454-77e1"], sources).map((f) => f.label)).toEqual([
      "mysql-prod",
    ]);
  });

  it("falls back to the id of an unnamed data source", () => {
    expect(consoleFolders("/d", ["pg"], sources)[0]?.label).toBe("pg");
  });
});
