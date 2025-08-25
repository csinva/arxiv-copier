**5 years later, it turns out GPT-5 can just write this extension entirely!**



# ArXiv/OpenReview → Markdown Citation (Title + authors)

Right-click an arXiv abstract page (e.g., `https://arxiv.org/abs/2410.00812`) **or** an OpenReview forum page (e.g., `https://openreview.net/forum?id=mxMvWwyBWe`) and choose **“Copy Markdown citation”**.  
This copies Markdown like:

```
Crafting Interpretable Embeddings for Language Neuroscience by Asking LLMs Questions ([benara...gao, 2024](https://openreview.net/forum?id=mxMvWwyBWe))
```

or

```
Generative causal testing to bridge data-driven models and scientific theories in language neuroscience ([antonello...huth, 2025](https://arxiv.org/abs/2410.00812))
```

### Formatting rules

- **Author last names** only, all **lowercase**.
- If there are **> 4 authors**, shorten to `first...last`.
- Otherwise, join as `a, b, c & d`.
- Extracts **year** from page meta or visible “Published:” text (OpenReview) / submission history (arXiv).
- Applies common **abbreviations** in titles (case-insensitive):
  - Large Language Models → **LLMs**
  - Language Model(s) → **LM/LMs**
  - Reinforcement Learning → **RL**
  - Natural Language Processing → **NLP**
  - Machine Learning → **ML**
  - Artificial Intelligence → **AI**
  - Graph/Convolutional Neural Network(s) → **GNN/CNN**
  - Foundation Model(s) → **FM/FMs**
  - Diffusion Model(s) → **DM/DMs**
  - Computer Vision → **CV**

You can customize abbreviations inside `background.js` (`abbreviateTitle()`), and tune the OpenReview selectors in `extractAuthorsOpenReview()` if their DOM changes.

## Install (Chrome/Edge/Brave)

1. Unzip this folder.
2. Go to `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Open an arXiv or OpenReview page, right-click, and click **Copy Markdown citation**.
5. Paste into your notes.


## Prompt
Prompt used to create this:
```
Create a fully downloadable chrome extension. Given an arXiv page (e.g. https://arxiv.org/abs/2410.00812), the extension should give an option to right-click the page and copy-paste the title and authors in markdown format. Specifically, it should copy the title, followed by a citation of the author last names and year, with the author names linking back to the page. 
- author last names should be lowercase
- if there are greater than 4 authors, then the last names should give the first author, followed by "..." then the final last name.
- abbreviate very common terms, for example "Large language models" to "LLMs"

Here are some examples after copying:

Generative causal testing to bridge data-driven models and scientific theories in language neuroscience ([antonello...huth, 2025](https://arxiv.org/abs/2410.00812))

Context-faithful Prompting for LLMs ([zhou, shang, poon & chen, 2023](https://arxiv.org/abs/2303.11315))

Adapting Language Models for Zero-shot Learning by Meta-tuning on Dataset and Prompt Collections ([zhong...klein, 2021](https://arxiv.org/abs/2104.04670))
```