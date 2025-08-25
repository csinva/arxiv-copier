// background.js (Manifest V3, service worker)

const MENU_ID = "copy_md_citation";
function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Copy Markdown citation",
      contexts: ["page"],
      documentUrlPatterns: [
        "*://arxiv.org/abs/*",
        "*://openreview.net/forum*"
      ]
    });
  });
}
chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup?.addListener(createMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Utilities in page
        const safeText = (el) => (el?.textContent || "").trim();
        const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || document.querySelector(`meta[property="${name}"]`)?.content;

        const host = location.hostname;
        const isArxiv = /(^|\.)arxiv\.org$/i.test(host);
        const isOpenReview = /(^|\.)openreview\.net$/i.test(host);

        // ------------ Generic helpers ------------
        function lastNameOf(full) {
          if (!full) return "";
          if (full.includes(",")) {
            return full.split(",")[0].trim().toLowerCase();
          }
          const parts = full.trim().split(/\s+/);
          if (parts.length === 1) return parts[0].toLowerCase();
          const particles = new Set(["van","von","der","de","da","di","la","le","du","del","della","dos","das"]);
          let i = parts.length - 1;
          let last = parts[i];
          while (i - 1 >= 0 && particles.has(parts[i - 1].toLowerCase())) {
            last = parts[i - 1] + " " + last;
            i--;
          }
          return last.toLowerCase();
        }
        function joinAuthors(lastnames) {
          const n = lastnames.length;
          if (n === 0) return "";
          if (n === 1) return lastnames[0];
          if (n === 2) return `${lastnames[0]} & ${lastnames[1]}`;
          if (n === 3) return `${lastnames[0]}, ${lastnames[1]} & ${lastnames[2]}`;
          if (n === 4) return `${lastnames[0]}, ${lastnames[1]}, ${lastnames[2]} & ${lastnames[3]}`;
          return `${lastnames[0]}...${lastnames[n - 1]}`; // > 4
        }
        function abbreviateTitle(title) {
          if (!title) return title;
          const replacements = [
            { re: /\bLarge(?:\s+|-)?Language(?:\s+|-)?Models\b/gi, to: "LLMs" },
            { re: /\bLarge(?:\s+|-)?Language(?:\s+|-)?Model\b/gi,  to: "LLM" },
            { re: /\bLanguage(?:\s+|-)?Models\b/gi, to: "LMs" },
            { re: /\bLanguage(?:\s+|-)?Model\b/gi,  to: "LM" },
            { re: /\bReinforcement(?:\s+|-)?Learning\b/gi, to: "RL" },
            { re: /\bNatural(?:\s+|-)?Language(?:\s+|-)?Processing\b/gi, to: "NLP" },
            { re: /\bMachine(?:\s+|-)?Learning\b/gi, to: "ML" },
            { re: /\bArtificial(?:\s+|-)?Intelligence\b/gi, to: "AI" },
            { re: /\bGraph(?:\s+|-)?Neural(?:\s+|-)?Networks\b/gi, to: "GNNs" },
            { re: /\bGraph(?:\s+|-)?Neural(?:\s+|-)?Network\b/gi,  to: "GNN" },
            { re: /\bConvolutional(?:\s+|-)?Neural(?:\s+|-)?Networks\b/gi, to: "CNNs" },
            { re: /\bConvolutional(?:\s+|-)?Neural(?:\s+|-)?Network\b/gi,  to: "CNN" },
            { re: /\bFoundation(?:\s+|-)?Models\b/gi, to: "FMs" },
            { re: /\bFoundation(?:\s+|-)?Model\b/gi,  to: "FM" },
            { re: /\bDiffusion(?:\s+|-)?Models\b/gi, to: "DMs" },
            { re: /\bDiffusion(?:\s+|-)?Model\b/gi,  to: "DM" },
            { re: /\bComputer(?:\s+|-)?Vision\b/gi, to: "CV" },
          ];
          let out = title;
          for (const { re, to } of replacements) out = out.replace(re, to);
          return out.replace(/\s+/g, " ").trim();
        }

        // ------------ arXiv extractors ------------
        function extractTitleArxiv() {
          let t = meta("citation_title") ||
                  safeText(document.querySelector("h1.title"))?.replace(/^Title:\s*/i, "") ||
                  safeText(document.querySelector("#abs h1, h1"));
          return (t || "").trim();
        }
        function extractAuthorsArxiv() {
          let authors = Array.from(document.querySelectorAll('meta[name="citation_author"]')).map(m => m.content).filter(Boolean);
          if (!authors.length) {
            const links = document.querySelectorAll(".authors a, .authors span a, .authors > a");
            if (links?.length) authors = Array.from(links).map(a => a.textContent.trim()).filter(Boolean);
            else {
              const block = document.querySelector(".authors");
              if (block) {
                let txt = block.textContent.replace(/^Authors?:\s*/i, "").trim();
                authors = txt.split(/\s*(?:,| and | & )\s*/i).map(s => s.trim()).filter(Boolean);
              }
            }
          }
          return authors;
        }
        function extractYearArxiv() {
          const candidates = [
            meta("citation_publication_date"),
            meta("citation_date"),
            meta("dc.date"),
            meta("prism.publicationDate"),
            meta("prism.publicationdate"),
          ].filter(Boolean);
          for (const c of candidates) {
            const m = String(c).match(/(\d{4})/);
            if (m) return m[1];
          }
          const hist = document.querySelector("#submission-history, .submission-history, .dateline, .submission-history-container");
          const text = hist?.textContent || document.body.textContent || "";
          const m = text.match(/(\d{4})/);
          return m ? m[1] : String(new Date().getFullYear());
        }

        // ------------ OpenReview extractors ------------
        function extractTitleOpenReview() {
          let t = meta("citation_title") ||
                  meta("og:title") ||
                  safeText(document.querySelector("h1, h2"));
          if (t) t = t.replace(/\s*\|\s*OpenReview\s*$/i, "");
          return (t || "").trim();
        }
        function extractAuthorsOpenReview() {
          // Try meta tags first
          let authors = Array.from(document.querySelectorAll('meta[name="citation_author"]')).map(m => m.content).filter(Boolean);
          if (authors.length) return authors;

          // Anchors to profiles typically contain /profile?id=...
          let profileLinks = document.querySelectorAll('a[href*="/profile?id="], a[ng-href*="/profile?id="]');
          if (profileLinks?.length) {
            return Array.from(profileLinks).map(a => a.textContent.trim()).filter(Boolean);
          }

          // Fallback: look near words like "Authors" or parse comma-separated line under title
          const candidates = Array.from(document.querySelectorAll("a, span, div, p")).slice(0, 400);
          for (const el of candidates) {
            const txt = safeText(el);
            if (!txt) continue;
            if (/^authors?\s*:/i.test(txt) || (/Published:/i.test(document.body.textContent) && el.previousElementSibling && /^(h1|h2)$/i.test(el.previousElementSibling.tagName))) {
              let list = txt.replace(/^authors?\s*:\s*/i, "");
              let arr = list.split(/\s*(?:,| and | & )\s*/i).map(s => s.trim()).filter(Boolean);
              if (arr.length) return arr;
            }
          }
          return [];
        }
        function extractYearOpenReview() {
          // Meta
          const metaYearSources = [
            meta("citation_publication_date"),
            meta("citation_date"),
            meta("dc.date"),
            meta("article:published_time"),
          ].filter(Boolean);
          for (const c of metaYearSources) {
            const m = String(c).match(/(\d{4})/);
            if (m) return m[1];
          }
          // Text pattern: "Published: <date>, ..."
          const body = document.body.textContent || "";
          let m = body.match(/Published:\s*[^,\n]*\b(\d{4})\b/i);
          if (m) return m[1];
          // Or any 4-digit year on the page (last resort)
          m = body.match(/(20\d{2}|19\d{2})/);
          if (m) return m[1];
          return String(new Date().getFullYear());
        }

        // ------------ Build markdown ------------
        function buildMarkdown() {
          const url = location.href;
          let rawTitle, authors, year;

          if (isOpenReview) {
            rawTitle = extractTitleOpenReview();
            authors = extractAuthorsOpenReview();
            year = extractYearOpenReview();
          } else if (isArxiv) {
            rawTitle = extractTitleArxiv();
            authors = extractAuthorsArxiv();
            year = extractYearArxiv();
          } else {
            // generic fallback
            rawTitle = meta("citation_title") || safeText(document.querySelector("h1, h2")) || document.title;
            authors = Array.from(document.querySelectorAll('meta[name="citation_author"]')).map(m => m.content).filter(Boolean);
            year = (document.body.textContent.match(/(20\d{2}|19\d{2})/)||[])[1] || String(new Date().getFullYear());
          }

          const title = abbreviateTitle(rawTitle || "");
          const lastnames = (authors || []).map(lastNameOf).filter(Boolean);
          const authorText = lastnames.length > 4 ? `${lastnames[0]}...${lastnames[lastnames.length - 1]}` : joinAuthors(lastnames);
          return `${title} ([${authorText}, ${year}](${url}))`;
        }

        async function copyToClipboard(text) {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch (_) {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            try {
              const ok = document.execCommand("copy");
              document.body.removeChild(ta);
              return ok;
            } catch (e) {
              document.body.removeChild(ta);
              return false;
            }
          }
        }

        const md = buildMarkdown();
        return copyToClipboard(md).then(() => md);
      },
      // No args
    });
    console.log("Markdown citation copied:", result);
  } catch (err) {
    console.error("Failed to copy Markdown citation:", err);
  }
});
