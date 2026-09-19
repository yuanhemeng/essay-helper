const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = { page: 27, zoom: 100, currentView: "阅读台", highlightMode: false };

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 2200);
}

function setView(view) {
  state.currentView = view;
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $("#breadcrumbView").textContent = view;
  $("#readingWorkspace").classList.toggle("hidden", view !== "阅读台");
  $("#researchView").classList.toggle("hidden", view !== "研究树");
  $("#submissionView").classList.toggle("hidden", view !== "投稿助手");
}

function updatePage(nextPage) {
  state.page = Math.min(42, Math.max(1, Number(nextPage) || 1));
  $("#pageInput").value = state.page;
  $("#readerStatus").textContent = `第 ${state.page} 页 · 阅读模式 · 可选择文本后添加高亮或批注`;
}

function updateZoom(nextZoom) {
  state.zoom = Math.min(160, Math.max(60, nextZoom));
  $("#zoomValue").textContent = `${state.zoom}%`;
  $("#documentPage").style.transform = `scale(${state.zoom / 100})`;
  $("#documentPage").style.marginBottom = `${(state.zoom - 100) * 7}px`;
}

function getSelectedText() {
  return window.getSelection()?.toString().trim() || "";
}

function addHighlight() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !getSelectedText()) {
    toast("请先在正文中选择一段文字");
    return;
  }
  const range = selection.getRangeAt(0);
  if (!$("#documentPage").contains(range.commonAncestorContainer)) {
    toast("只能标注当前论文正文");
    return;
  }
  const mark = document.createElement("mark");
  mark.className = "new-highlight";
  try {
    range.surroundContents(mark);
    selection.removeAllRanges();
    toast("已添加荧光标注");
  } catch {
    toast("这段文字跨越了多个段落，暂时无法标注");
  }
}

function addNote() {
  const selected = getSelectedText();
  toast(selected ? `已为“${selected.slice(0, 18)}${selected.length > 18 ? "…" : ""}”添加批注` : "已创建空白批注");
}

function appendMessage(text, role = "user") {
  const messages = $("#chatMessages");
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.innerHTML = role === "assistant"
    ? `<div class="message-avatar">✦</div><div class="message-bubble">${text}</div>`
    : `<div class="message-bubble">${text}</div>`;
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
}

function answerFor(question) {
  if (question.includes("三句话") || question.includes("核心思想")) {
    return "RAG 的核心是先检索、再生成：模型先从外部知识库找出与问题相关的证据，再基于证据组织答案。它把可更新的非参数记忆和模型自身的参数记忆结合起来，因此特别适合知识密集型任务。";
  }
  if (question.includes("关系")) {
    return "这部分可以直接支撑你的研究动机：它说明外部知识检索能够改善事实性和知识更新能力。你的研究树中“研究问题”和“方法设计”两个节点都可以引用这一节作为基础依据。";
  }
  if (question.includes("实验")) {
    return "论文的关键结论是：检索增强方法在开放域问答和事实核验任务上表现稳定，并且相比纯参数模型更容易更新知识、追溯证据。建议你继续查看第 4 节的对比实验表。";
  }
  return "我会结合当前页面和已导入的文献回答这个问题。就当前内容而言，RAG 的关键价值在于把检索到的外部证据纳入生成过程，从而提升回答的事实性与可解释性。";
}

function sendQuestion(question) {
  const text = question.trim();
  if (!text) return;
  appendMessage(text, "user");
  $("#chatInput").value = "";
  window.setTimeout(() => appendMessage(answerFor(text), "assistant"), 350);
}

function handleFiles(files) {
  const file = files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf") {
    toast("目前只支持 PDF 文件");
    return;
  }
  const url = URL.createObjectURL(file);
  const paperList = $("#paperList");
  const card = document.createElement("button");
  card.className = "paper-card selected";
  card.dataset.title = file.name;
  card.innerHTML = `<div class="paper-card-top"><span class="status-pill reading">刚刚导入</span><span class="paper-options">···</span></div><h2>${file.name}</h2><p>本地文献 · 等待 AI 解析</p><div class="paper-tags"><span>待解析</span><span>新导入</span></div><div class="paper-progress"><span style="width: 3%"></span></div><div class="paper-card-bottom"><span>第 1 页</span><span>刚刚</span></div>`;
  paperList.prepend(card);
  $$(".paper-card").forEach((item) => item.classList.toggle("selected", item === card));
  const readerTitle = $(".reader-title span:nth-child(2)");
  readerTitle.textContent = file.name;
  toast(`已导入 ${file.name}，AI 解析任务已创建`);
  card.addEventListener("click", () => {
    $$(".paper-card").forEach((item) => item.classList.toggle("selected", item === card));
    readerTitle.textContent = file.name;
  });
  // Keep the object URL ready for the PDF renderer that will be connected in the next milestone.
  card.dataset.objectUrl = url;
}

$("#prevPage").addEventListener("click", () => updatePage(state.page - 1));
$("#nextPage").addEventListener("click", () => updatePage(state.page + 1));
$("#pageInput").addEventListener("change", (event) => updatePage(event.target.value));
$("#zoomOut").addEventListener("click", () => updateZoom(state.zoom - 10));
$("#zoomIn").addEventListener("click", () => updateZoom(state.zoom + 10));
$("#highlightButton").addEventListener("click", addHighlight);
$("#noteButton").addEventListener("click", addNote);
$("#selectTool").addEventListener("click", () => toast("已切换到文本选择模式"));
$("#fullscreenButton").addEventListener("click", () => $("#documentStage").requestFullscreen?.());
$("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); sendQuestion($("#chatInput").value); });
$("#chatInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendQuestion(event.target.value); } });
$$(".ai-suggestions button").forEach((button) => button.addEventListener("click", () => sendQuestion(button.dataset.prompt)));
$$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$$(".paper-card").forEach((card) => card.addEventListener("click", () => {
  $$(".paper-card").forEach((item) => item.classList.toggle("selected", item === card));
  toast(`已打开：${card.dataset.title}`);
}));
$("#librarySearch").addEventListener("input", (event) => {
  const query = event.target.value.toLowerCase();
  $$(".paper-card").forEach((card) => { card.classList.toggle("hidden", !card.dataset.title.toLowerCase().includes(query)); });
});
$("#uploadButton").addEventListener("click", () => $("#fileInput").click());
$("#browseButton").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", (event) => handleFiles(event.target.files));
["dragenter", "dragover"].forEach((eventName) => $("#dropZone").addEventListener(eventName, (event) => { event.preventDefault(); $("#dropZone").classList.add("dragover"); }));
["dragleave", "drop"].forEach((eventName) => $("#dropZone").addEventListener(eventName, (event) => { event.preventDefault(); $("#dropZone").classList.remove("dragover"); }));
$("#dropZone").addEventListener("drop", (event) => handleFiles(event.dataTransfer.files));
$("#shortcutsButton").addEventListener("click", () => $("#shortcutsModal").classList.remove("hidden"));
$("#closeShortcuts").addEventListener("click", () => $("#shortcutsModal").classList.add("hidden"));
$("#shortcutsModal").addEventListener("click", (event) => { if (event.target.id === "shortcutsModal") event.currentTarget.classList.add("hidden"); });
$("#addCollectionButton").addEventListener("click", () => toast("分类创建入口已打开（下一步接入持久化）"));
$("#addNodeButton").addEventListener("click", () => toast("新节点已添加到研究树草稿"));
$("#documentStage").addEventListener("wheel", (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
    updateZoom(state.zoom + (event.deltaY < 0 ? 10 : -10));
  }
}, { passive: false });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#librarySearch").focus();
  }
  if (event.key.toLowerCase() === "h" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) addHighlight();
});
