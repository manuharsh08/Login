import { supabase, DEFAULT_AVATAR, isMissingTable, setupHint } from "../lib/supabase.js";
import { requireUser, displayName, wireLogout } from "../lib/session.js";
import { countLabel, el, renderList, setNotice, wireTabs } from "../lib/ui.js";
import { describeVideo } from "../lib/video.js";
import { dueStatus } from "../lib/dates.js";
import "../lib/snow.js";

const welcomeText = document.getElementById("welcomeText");
const profileIcon = document.getElementById("profileIcon");
const testsList = document.getElementById("testsList");
const resultsList = document.getElementById("resultsList");
const testsCount = document.getElementById("testsCount");
const resultsCount = document.getElementById("resultsCount");
const videosList = document.getElementById("videosList");
const videosCount = document.getElementById("videosCount");
const videoSearch = document.getElementById("videoSearch");
const noticesList = document.getElementById("noticesList");
const noticesCount = document.getElementById("noticesCount");
const assignmentsList = document.getElementById("assignmentsList");
const assignmentsCount = document.getElementById("assignmentsCount");

const user = await requireUser();

welcomeText.textContent = `Welcome, ${displayName(user)}`;
profileIcon.src = user.user_metadata?.photo || DEFAULT_AVATAR;
profileIcon.alt = `${displayName(user)} profile picture`;
wireLogout();
wireTabs(document.querySelector('[role="tablist"]'));

function videoCard(video) {
  const media = describeVideo(video.video_url);

  const player =
    media.kind === "embed"
      ? el("div", { className: "video-frame" }, [
          el("iframe", {
            src: media.embedUrl,
            title: video.title,
            loading: "lazy",
            allow: "accelerometer; encrypted-media; picture-in-picture; fullscreen",
            allowFullscreen: true,
            referrerPolicy: "strict-origin-when-cross-origin",
          }),
        ])
      : el("a", {
          className: "start-btn video-link",
          href: media.href,
          target: "_blank",
          rel: "noreferrer",
          text: media.href ? `Open on ${media.provider}` : "Video unavailable",
        });

  const meta = [el("h4", { text: video.title }), el("p", { text: video.subject })];
  if (video.description) meta.push(el("small", { text: video.description }));

  return el("article", { className: "video-card" }, [player, el("div", {}, meta)]);
}

function testCard(test) {
  return el("article", { className: "test-card" }, [
    el("div", { className: "test-info" }, [
      el("h4", { text: test.title }),
      el("p", { text: test.subject }),
    ]),
    el("a", {
      className: "start-btn",
      href: test.form_url,
      target: "_blank",
      rel: "noreferrer",
      text: "Start Test",
    }),
  ]);
}

function resultCard(result, test) {
  const attemptedAt = result.attempted_at ? new Date(result.attempted_at) : null;
  const dateText =
    attemptedAt && !Number.isNaN(attemptedAt.valueOf()) ? attemptedAt.toLocaleDateString() : "";

  return el("article", { className: "result-card" }, [
    el("div", {}, [
      el("h4", { text: test?.title || "Test" }),
      el("p", { text: test?.subject || "Subject not available" }),
      el("small", { text: dateText }),
    ]),
    el("div", {
      className: "score-badge",
      text: `${result.score}/${result.total} (${result.percentage}%)`,
    }),
  ]);
}

let allVideos = [];

function renderVideos() {
  const term = (videoSearch?.value ?? "").trim().toLowerCase();
  const shown = term
    ? allVideos.filter(video =>
        `${video.title} ${video.subject} ${video.description ?? ""}`.toLowerCase().includes(term)
      )
    : allVideos;

  videosCount.textContent = countLabel(shown.length, "video");
  renderList(
    videosList,
    shown,
    videoCard,
    term
      ? `No lessons match "${videoSearch.value.trim()}".`
      : "No video lessons have been added yet."
  );
}

async function loadVideos() {
  setNotice(videosList, "Loading lessons...");

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading videos:", error.message);
    setNotice(
      videosList,
      isMissingTable(error)
        ? setupHint("Video lessons", "0003_videos.sql")
        : "Could not load video lessons. Please refresh and try again.",
      "error"
    );
    return;
  }

  allVideos = data ?? [];
  renderVideos();
}

videoSearch?.addEventListener("input", renderVideos);

function noticeCard(notice) {
  const posted = new Date(notice.created_at);
  const meta = [];

  if (notice.pinned) meta.push(el("span", { className: "pill pill-pinned", text: "Pinned" }));
  meta.push(
    el("small", {
      text: Number.isNaN(posted.valueOf()) ? "" : posted.toLocaleDateString(),
    })
  );

  return el("article", { className: `notice-card${notice.pinned ? " notice-pinned" : ""}` }, [
    el("div", { className: "notice-head" }, [el("h4", { text: notice.title }), ...meta]),
    el("p", { className: "notice-body", text: notice.body }),
  ]);
}

async function loadNotices() {
  setNotice(noticesList, "Loading notices...");

  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading notices:", error.message);
    setNotice(
      noticesList,
      isMissingTable(error)
        ? setupHint("Notices", "0004_notices_assignments.sql")
        : "Could not load notices. Please refresh and try again.",
      "error"
    );
    return;
  }

  const notices = data ?? [];
  noticesCount.textContent = countLabel(notices.length, "notice");
  renderList(noticesList, notices, noticeCard, "No notices have been posted yet.");
}

function assignmentCard(assignment) {
  const due = dueStatus(assignment.due_date);

  const info = [el("h4", { text: assignment.title }), el("p", { text: assignment.subject })];
  if (assignment.description) info.push(el("small", { text: assignment.description }));

  const side = [el("div", { className: `due-badge due-${due.tone}`, text: due.label })];
  if (assignment.link_url) {
    side.push(
      el("a", {
        className: "start-btn",
        href: assignment.link_url,
        target: "_blank",
        rel: "noreferrer",
        text: "Open",
      })
    );
  }

  return el("article", { className: "assignment-card" }, [
    el("div", { className: "test-info" }, info),
    el("div", { className: "assignment-side" }, side),
  ]);
}

async function loadAssignments() {
  setNotice(assignmentsList, "Loading assignments...");

  // Undated assignments sort last rather than first.
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error loading assignments:", error.message);
    setNotice(
      assignmentsList,
      isMissingTable(error)
        ? setupHint("Assignments", "0004_notices_assignments.sql")
        : "Could not load assignments. Please refresh and try again.",
      "error"
    );
    return;
  }

  const assignments = data ?? [];
  assignmentsCount.textContent = countLabel(assignments.length, "assignment");
  renderList(assignmentsList, assignments, assignmentCard, "No assignments have been set yet.");
}

async function loadDashboard() {
  setNotice(testsList, "Loading tests...");
  setNotice(resultsList, "Loading results...");

  const [tests, results] = await Promise.all([
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
    supabase.from("results").select("*").eq("email", user.email),
  ]);

  if (tests.error) {
    console.error("Error loading tests:", tests.error.message);
    setNotice(testsList, "Could not load tests. Please refresh and try again.", "error");
  }
  if (results.error) {
    console.error("Error loading results:", results.error.message);
    setNotice(resultsList, "Could not load results. Please refresh and try again.", "error");
  }

  const allTests = tests.data ?? [];
  const allResults = results.data ?? [];
  const testsById = new Map(allTests.map(test => [test.id, test]));
  const attemptedIds = new Set(allResults.map(result => result.test_id));

  if (!tests.error) {
    const pending = allTests.filter(test => !attemptedIds.has(test.id));
    testsCount.textContent = `${pending.length} pending`;
    renderList(testsList, pending, testCard, "No tests are available right now.");
  }

  if (!results.error) {
    const sorted = [...allResults].sort(
      (a, b) => new Date(b.attempted_at) - new Date(a.attempted_at)
    );
    resultsCount.textContent = countLabel(sorted.length, "attempt");
    renderList(
      resultsList,
      sorted,
      result => resultCard(result, testsById.get(result.test_id)),
      "No attempts yet."
    );
  }
}

await Promise.all([loadDashboard(), loadVideos(), loadNotices(), loadAssignments()]);
