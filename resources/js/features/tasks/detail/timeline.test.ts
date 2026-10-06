import { describe, expect, it } from "vite-plus/test";
import { commentCount, describeTaskActivity, toggleReaction, upsertComment } from "./timeline";
import type { TaskActivity, TaskComment } from "./types";

const comment = (id: string, at: string, over: Partial<TaskComment> = {}): TaskComment => ({
  kind: "comment",
  id,
  task_id: "t",
  author: { id: "u1", name: "Maya Lestari", avatar: null },
  body: null,
  body_text: "x",
  created_at: at,
  edited_at: null,
  deleted: false,
  reactions: [],
  attachments: [],
  ...over,
});

const activity = (event: string, properties: Record<string, unknown>): TaskActivity => ({
  kind: "activity",
  id: "a",
  event,
  properties,
  causer: null,
  created_at: "2026-10-01T00:00:00Z",
});

describe("upsertComment", () => {
  it("inserts in chronological order and replaces existing ones", () => {
    const items = [comment("a", "2026-10-01T00:00:00Z"), comment("c", "2026-10-03T00:00:00Z")];
    const inserted = upsertComment(items, comment("b", "2026-10-02T00:00:00Z"));

    expect(inserted.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(
      upsertComment(inserted, comment("b", "2026-10-02T00:00:00Z", { deleted: true }))[1],
    ).toMatchObject({ id: "b", deleted: true });
    expect(
      commentCount(
        upsertComment(inserted, comment("b", "2026-10-02T00:00:00Z", { deleted: true })),
      ),
    ).toBe(2);
  });
});

describe("toggleReaction", () => {
  it("adds, increments and removes the viewer", () => {
    const added = toggleReaction(comment("a", "x"), "👍", "me", "Saya");
    expect(added.reactions).toEqual([{ emoji: "👍", count: 1, user_ids: ["me"], names: ["Saya"] }]);

    const other = toggleReaction(added, "👍", "u2", "Rizky");
    expect(other.reactions[0].count).toBe(2);

    expect(toggleReaction(added, "👍", "me", "Saya").reactions).toEqual([]);
  });
});

describe("describeTaskActivity", () => {
  it("describes status changes and checklist completion", () => {
    expect(
      describeTaskActivity(
        activity("task.status_changed", {
          from: { name: "Todo" },
          to: { name: "Sedang dikerjakan" },
        }),
      ),
    ).toBe("mengubah status Todo → Sedang dikerjakan");
    expect(
      describeTaskActivity(activity("task.checklist_completed", { item: "Hero section" })),
    ).toBe("menyelesaikan “Hero section”");
    expect(
      describeTaskActivity(activity("task.assigned", { user_ids: ["u1"] }), { u1: "Rizky Aditya" }),
    ).toBe("menugaskan Rizky Aditya");
    expect(describeTaskActivity(activity("task.created", {}))).toBe("membuat tugas ini");
  });

  it("describes attachments added and removed", () => {
    expect(
      describeTaskActivity(
        activity("task.attachment_added", {
          filename: "Wireframe v2.pdf",
        }),
      ),
    ).toBe("melampirkan Wireframe v2.pdf");
    expect(describeTaskActivity(activity("task.attachment_removed", { filename: "Brief" }))).toBe(
      "melepas lampiran Brief",
    );
  });
});
