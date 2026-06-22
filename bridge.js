function generateAiSummaryReport(event) {
  if (typeof window.__generateAiSummaryReportImpl === "function") {
    return window.__generateAiSummaryReportImpl(event);
  }
}

function generatePptOutlinePrompt(event) {
  if (typeof window.__generatePptOutlinePromptImpl === "function") {
    return window.__generatePptOutlinePromptImpl(event);
  }
}
