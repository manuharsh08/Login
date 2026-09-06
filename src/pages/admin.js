import { supabase, isMissingTable, setupHint } from "../lib/supabase.js";
import { requireAdmin, wireLogout } from "../lib/session.js";
import { describeVideo } from "../lib/video.js";
import { dueStatus } from "../lib/dates.js";
import { isMissingSebBucket, publishSebConfig, removeSebConfig } from "../lib/seb.js";
import { openQuestionEditor } from "../lib/questionEditor.js";
import { changePasswordSection } from "../lib/password.js";
import {
  countLabel,
  el,
  errorMessage,
  renderList,
  setBusy,
  setNotice,
  toast,
  wireTabs,
} from "../lib/ui.js";
import "../lib/snow.js";

const addTestBtn = document.getElementById("addTestBtn");
const testTitle = document.getElementById("testTitle");
const testSubject = document.getElementById("testSubject");
const testRequiresSeb = document.getElementById("testRequiresSeb");
const adminTestsList = document.getElementById("adminTestsList");
const questionEditor = document.getElementById("questionEditor");
const adminResultsList = document.getElementById("adminResultsList");
const adminTestsCount = document.getElementById("adminTestsCount");
const adminResultsCount = document.getElementById("adminResultsCount");
const addNoticeBtn = document.getElementById("addNoticeBtn");
const noticeTitle = document.getElementById("noticeTitle");
const noticeBody = document.getElementById("noticeBody");
const noticePinned = document.getElementById("noticePinned");
const adminNoticesList = document.getElementById("adminNoticesList");
const adminNoticesCount = document.getElementById("adminNoticesCount");
const addAssignmentBtn = document.getElementById("addAssignmentBtn");
const assignmentTitle = document.getElementById("assignmentTitle");
const assignmentSubject = document.getElementById("assignmentSubject");
const assignmentDescription = document.getElementById("assignmentDescription");
const assignmentDue = document.getElementById("assignmentDue");
const assignmentLink = document.getElementById("assignmentLink");
const adminAssignmentsList = document.getElementById("adminAssignmentsList");
const adminAssignmentsCount = document.getElementById("adminAssignmentsCount");
const addVideoBtn = document.getElementById("addVideoBtn");
const videoTitle = document.getElementById("videoTitle");
const videoSubject = document.getElementById("videoSubject");
const videoDescription = document.getElementById("videoDescription");
const videoLink = document.getElementById("videoLink");
const adminVideosList = document.getElementById("adminVideosList");
const adminVideosCount = document.getElementById("adminVideosCount");
const totalVideos = document.getElementById("totalVideos");
const totalTests = document.getElementById("totalTests");
const totalAttempts = document.getElementById("totalAttempts");
const avgScore = document.getElementById("avgScore");

await requireAdmin();
wireLogout();
wireTabs(document.querySelector('[role="tablist"]'));
document.getElementById("passwordMount")?.append(changePasswordSection());

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readTestForm() {
  const title = testTitle.value.trim();
  const subject = testSubject.value.trim();

  if (!title || !subject) {
    toast("A test needs a title and a subject.", "error");
    return null;
  }
  return { title, subject, requires_seb: testRequiresSeb.checked };
}

addTestBtn.addEventListener("click", async () => {
  const payload = readTestForm();
  if (!payload) return;

  const reset = setBusy(addTestBtn, "Adding...");

  const { data: created, error } = await supabase.from("tests").insert([payload]).select();

  if (error) {
    reset();
    console.error("Create test failed:", error.message);
    toast(errorMessage(error, "Could not create the test."), "error");
    return;
  }

  reset();

  testTitle.value = "";
  testSubject.value = "";
  testRequiresSeb.checked = true;
  toast("Test added. Add questions to it below.", "success");

  // The lockdown config is generated and hosted here so a teacher never has to
  // produce or host a .seb file themselves.
  if (payload.requires_seb && created?.[0]) {
    try {
      const configUrl = await publishSebConfig(supabase, created[0]);
      const { error: linkError } = await supabase
        .from("tests")
        .update({ seb_config_url: configUrl })
        .eq("id", created[0].id);
      if (linkError) throw linkError;
    } catch (uploadError) {
      console.error("Could not publish .seb config:", uploadError);
      // The test exists; only its lockdown config is missing. Say exactly that.
      toast(
        isMissingSebBucket(uploadError)
          ? "Test added, but lockdown setup needs migration 0006_seb_config_storage.sql."
          : errorMessage(uploadError, "Test added, but its lockdown config could not be saved."),
        "error"
      );
    }
  }

  await Promise.all([loadTests(), loadStats()]);
});

/** Swaps a test card into an inline edit form (replaces chained prompt() calls). */
function editForm(test, onDone) {
  const titleInput = el("input", { value: test.title, placeholder: "Title" });
  const subjectInput = el("input", { value: test.subject, placeholder: "Subject" });

  const saveBtn = el("button", { type: "button", className: "edit-btn", text: "Save" });
  const cancelBtn = el("button", { type: "button", className: "secondary", text: "Cancel" });

  saveBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim();

    if (!title || !subject) {
      toast("A test needs a title and a subject.", "error");
      return;
    }

    const reset = setBusy(saveBtn, "Saving...");
    const { error } = await supabase.from("tests").update({ title, subject }).eq("id", test.id);

    if (error) {
      reset();
      console.error("Update test failed:", error.message);
      toast(errorMessage(error, "Could not update the test."), "error");
      return;
    }

    reset();

    toast("Test updated.", "success");
    await onDone();
  });

  cancelBtn.addEventListener("click", onDone);

  return el("article", { className: "test-card test-card-editing" }, [
    el("div", { className: "form-stack" }, [titleInput, subjectInput]),
    el("div", { className: "admin-actions" }, [saveBtn, cancelBtn]),
  ]);
}

function testCard(test) {
  const questionsBtn = el("button", { type: "button", className: "edit-btn", text: "Questions" });
  const editBtn = el("button", { type: "button", className: "edit-btn", text: "Rename" });
  const refreshBtn = el("button", {
    type: "button",
    className: "edit-btn",
    text: "Refresh lockdown",
  });

  // Regenerates the .seb file. Needed after any change to what the config
  // must allow — an out-of-date config silently breaks the exam inside SEB.
  refreshBtn.addEventListener("click", async () => {
    const reset = setBusy(refreshBtn, "Refreshing...");
    try {
      const configUrl = await publishSebConfig(supabase, test);
      const { error } = await supabase
        .from("tests")
        .update({ seb_config_url: configUrl })
        .eq("id", test.id);
      if (error) throw error;
      toast("Lockdown config refreshed.", "success");
      await loadTests();
    } catch (err) {
      console.error("Refresh config failed:", err);
      toast(
        isMissingSebBucket(err)
          ? "Run supabase/migrations/0006_seb_config_storage.sql first."
          : errorMessage(err, "Could not refresh the lockdown config."),
        "error"
      );
    } finally {
      reset();
    }
  });
  const deleteBtn = el("button", { type: "button", className: "delete-btn", text: "Delete" });

  // The editor takes over the panel so it gets the full width.
  questionsBtn.addEventListener("click", () => {
    adminTestsList.hidden = true;
    questionEditor.hidden = false;
    openQuestionEditor(questionEditor, test, () => {
      questionEditor.hidden = true;
      questionEditor.replaceChildren();
      adminTestsList.hidden = false;
      loadTests();
    });
  });

  const sebState =
    test.requires_seb === false
      ? "Opens in any browser"
      : test.seb_config_url
        ? "Protected by Safe Exam Browser"
        : "Protected — lockdown setup incomplete";

  const card = el("article", { className: "test-card" }, [
    el("div", { className: "test-info" }, [
      el("h4", { text: test.title }),
      el("p", { text: test.subject }),
      el("small", { className: "seb-note", text: sebState }),
    ]),
    el("div", { className: "admin-actions" }, [questionsBtn, editBtn, refreshBtn, deleteBtn]),
  ]);

  editBtn.addEventListener("click", () => {
    card.replaceWith(editForm(test, loadTests));
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${test.title}"? This cannot be undone.`)) return;

    const reset = setBusy(deleteBtn, "Deleting...");
    const { error } = await supabase.from("tests").delete().eq("id", test.id);

    if (error) {
      reset();
      console.error("Delete test failed:", error.message);
      toast(errorMessage(error, "Could not delete the test."), "error");
      return;
    }

    // Leaves no orphaned config behind in storage.
    await removeSebConfig(supabase, test.id);
    reset();

    toast("Test deleted.", "success");
    await Promise.all([loadTests(), loadStats()]);
  });

  return card;
}

function resultCard(result, title) {
  return el("article", { className: "result-card" }, [
    el("div", {}, [el("h4", { text: title || "Test" }), el("p", { text: result.email })]),
    el("div", {
      className: "score-badge",
      text: `${result.score}/${result.total} (${result.percentage}%)`,
    }),
  ]);
}

async function loadTests() {
  setNotice(adminTestsList, "Loading tests...");

  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading tests:", error.message);
    setNotice(adminTestsList, "Could not load tests.", "error");
    return;
  }

  const tests = data ?? [];
  adminTestsCount.textContent = countLabel(tests.length, "test");
  renderList(adminTestsList, tests, testCard, "No tests have been created yet.");
}

async function loadResults() {
  setNotice(adminResultsList, "Loading results...");

  // Joined client-side rather than with a PostgREST embed (`tests (title)`).
  // The embed needs a foreign key from results.test_id to tests.id, which this
  // schema does not declare, so it fails with "Could not find a relationship".
  // The dashboard resolves titles the same way.
  const [results, tests] = await Promise.all([
    supabase
      .from("results")
      .select("test_id, email, score, total, percentage, attempted_at")
      .order("attempted_at", { ascending: false }),
    supabase.from("tests").select("id, title"),
  ]);

  if (results.error) {
    console.error("Error loading results:", results.error.message);
    setNotice(adminResultsList, "Could not load results.", "error");
    return;
  }

  if (tests.error) {
    console.error("Error loading test titles:", tests.error.message);
  }

  const titlesById = new Map((tests.data ?? []).map(test => [test.id, test.title]));
  const rows = results.data ?? [];

  adminResultsCount.textContent = countLabel(rows.length, "result");
  renderList(
    adminResultsList,
    rows,
    result => resultCard(result, titlesById.get(result.test_id)),
    "No results yet."
  );
}

async function loadStats() {
  const [tests, attempts, scores, videos] = await Promise.all([
    supabase.from("tests").select("*", { count: "exact", head: true }),
    supabase.from("results").select("*", { count: "exact", head: true }),
    supabase.from("results").select("percentage"),
    supabase.from("videos").select("*", { count: "exact", head: true }),
  ]);

  // The videos table may not exist yet; that must not blank the other tiles.
  totalVideos.textContent = videos.error ? "0" : (videos.count ?? 0);

  if (tests.error || attempts.error || scores.error) {
    console.error("Error loading stats:", (tests.error || attempts.error || scores.error).message);
    return;
  }

  const percentages = (scores.data ?? []).map(row => Number(row.percentage) || 0);
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : 0;

  totalTests.textContent = tests.count ?? 0;
  totalAttempts.textContent = attempts.count ?? 0;
  avgScore.textContent = `${Math.round(average)}%`;
}

function readVideoForm() {
  const title = videoTitle.value.trim();
  const subject = videoSubject.value.trim();
  const url = videoLink.value.trim();

  if (!title || !subject || !url) {
    toast("Title, subject and video link are all required.", "error");
    return null;
  }
  if (!isValidUrl(url)) {
    toast("Enter a valid http(s) video link.", "error");
    return null;
  }
  return {
    title,
    subject,
    description: videoDescription.value.trim() || null,
    video_url: url,
  };
}

addVideoBtn.addEventListener("click", async () => {
  const payload = readVideoForm();
  if (!payload) return;

  const reset = setBusy(addVideoBtn, "Adding...");
  const { error } = await supabase.from("videos").insert([payload]);
  reset();

  if (error) {
    console.error("Create video failed:", error.message);
    toast(
      isMissingTable(error)
        ? "Run supabase/migrations/0003_videos.sql to enable video lessons."
        : errorMessage(error, "Could not add the video."),
      "error"
    );
    return;
  }

  videoTitle.value = "";
  videoSubject.value = "";
  videoDescription.value = "";
  videoLink.value = "";
  toast("Video added.", "success");

  await Promise.all([loadVideos(), loadStats()]);
});

function videoCard(video) {
  const media = describeVideo(video.video_url);
  const deleteBtn = el("button", { type: "button", className: "delete-btn", text: "Delete" });

  const meta = [
    el("h4", { text: video.title }),
    el("p", { text: video.subject }),
    el("small", { text: `${media.provider}${video.description ? " — " + video.description : ""}` }),
  ];

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;

    const reset = setBusy(deleteBtn, "Deleting...");
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    reset();

    if (error) {
      console.error("Delete video failed:", error.message);
      toast(errorMessage(error, "Could not delete the video."), "error");
      return;
    }

    toast("Video deleted.", "success");
    await Promise.all([loadVideos(), loadStats()]);
  });

  return el("article", { className: "test-card" }, [
    el("div", { className: "test-info" }, meta),
    el("div", { className: "admin-actions" }, [deleteBtn]),
  ]);
}

async function loadVideos() {
  setNotice(adminVideosList, "Loading videos...");

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading videos:", error.message);
    setNotice(
      adminVideosList,
      isMissingTable(error)
        ? setupHint("Video lessons", "0003_videos.sql")
        : "Could not load videos.",
      "error"
    );
    return;
  }

  const videos = data ?? [];
  adminVideosCount.textContent = countLabel(videos.length, "video");
  renderList(adminVideosList, videos, videoCard, "No videos have been added yet.");
}

/** A management card with a Delete button, shared by notices and assignments. */
function managedCard({ className = "test-card", info, label, onDelete, reload }) {
  const deleteBtn = el("button", { type: "button", className: "delete-btn", text: "Delete" });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;

    const reset = setBusy(deleteBtn, "Deleting...");
    const { error } = await onDelete();
    reset();

    if (error) {
      console.error("Delete failed:", error.message);
      toast(errorMessage(error, "Could not delete it."), "error");
      return;
    }

    toast("Deleted.", "success");
    await reload();
  });

  return el("article", { className }, [
    el("div", { className: "test-info" }, info),
    el("div", { className: "admin-actions" }, [deleteBtn]),
  ]);
}

addNoticeBtn.addEventListener("click", async () => {
  const title = noticeTitle.value.trim();
  const body = noticeBody.value.trim();

  if (!title || !body) {
    toast("A notice needs both a title and a message.", "error");
    return;
  }

  const reset = setBusy(addNoticeBtn, "Posting...");
  const { error } = await supabase
    .from("notices")
    .insert([{ title, body, pinned: noticePinned.checked }]);
  reset();

  if (error) {
    console.error("Post notice failed:", error.message);
    toast(
      isMissingTable(error)
        ? setupHint("Notices", "0004_notices_assignments.sql")
        : errorMessage(error, "Could not post the notice."),
      "error"
    );
    return;
  }

  noticeTitle.value = "";
  noticeBody.value = "";
  noticePinned.checked = false;
  toast("Notice posted.", "success");
  await loadNotices();
});

async function loadNotices() {
  setNotice(adminNoticesList, "Loading notices...");

  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading notices:", error.message);
    setNotice(
      adminNoticesList,
      isMissingTable(error)
        ? setupHint("Notices", "0004_notices_assignments.sql")
        : "Could not load notices.",
      "error"
    );
    return;
  }

  const notices = data ?? [];
  adminNoticesCount.textContent = countLabel(notices.length, "notice");

  renderList(
    adminNoticesList,
    notices,
    notice =>
      managedCard({
        label: notice.title,
        info: [
          el("h4", { text: `${notice.pinned ? "\u{1F4CC} " : ""}${notice.title}` }),
          el("p", { text: notice.body }),
        ],
        onDelete: () => supabase.from("notices").delete().eq("id", notice.id),
        reload: loadNotices,
      }),
    "No notices have been posted yet."
  );
}

addAssignmentBtn.addEventListener("click", async () => {
  const title = assignmentTitle.value.trim();
  const subject = assignmentSubject.value.trim();
  const link = assignmentLink.value.trim();

  if (!title || !subject) {
    toast("An assignment needs a title and a subject.", "error");
    return;
  }
  if (link && !isValidUrl(link)) {
    toast("Enter a valid http(s) link, or leave it blank.", "error");
    return;
  }

  const reset = setBusy(addAssignmentBtn, "Adding...");
  const { error } = await supabase.from("assignments").insert([
    {
      title,
      subject,
      description: assignmentDescription.value.trim() || null,
      due_date: assignmentDue.value || null,
      link_url: link || null,
    },
  ]);
  reset();

  if (error) {
    console.error("Create assignment failed:", error.message);
    toast(
      isMissingTable(error)
        ? setupHint("Assignments", "0004_notices_assignments.sql")
        : errorMessage(error, "Could not add the assignment."),
      "error"
    );
    return;
  }

  [
    assignmentTitle,
    assignmentSubject,
    assignmentDescription,
    assignmentDue,
    assignmentLink,
  ].forEach(input => (input.value = ""));
  toast("Assignment added.", "success");
  await loadAssignments();
});

async function loadAssignments() {
  setNotice(adminAssignmentsList, "Loading assignments...");

  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error loading assignments:", error.message);
    setNotice(
      adminAssignmentsList,
      isMissingTable(error)
        ? setupHint("Assignments", "0004_notices_assignments.sql")
        : "Could not load assignments.",
      "error"
    );
    return;
  }

  const assignments = data ?? [];
  adminAssignmentsCount.textContent = countLabel(assignments.length, "assignment");

  renderList(
    adminAssignmentsList,
    assignments,
    assignment =>
      managedCard({
        label: assignment.title,
        info: [
          el("h4", { text: assignment.title }),
          el("p", { text: assignment.subject }),
          el("small", { text: dueStatus(assignment.due_date).label }),
        ],
        onDelete: () => supabase.from("assignments").delete().eq("id", assignment.id),
        reload: loadAssignments,
      }),
    "No assignments have been set yet."
  );
}

await Promise.all([
  loadTests(),
  loadResults(),
  loadVideos(),
  loadNotices(),
  loadAssignments(),
  loadStats(),
]);
