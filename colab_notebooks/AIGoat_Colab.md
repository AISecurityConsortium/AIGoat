# Run AIGoat on Google Colab

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/AISecurityConsortium/AIGoat/blob/main/colab_notebooks/AIGoat_Colab.ipynb)

[`AIGoat_Colab.ipynb`](AIGoat_Colab.ipynb) runs the full platform inside a Google Colab runtime: Ollama and the Mistral model, the FastAPI backend, and the React frontend. Use it when you cannot install Ollama locally, or when your machine has less than 8 GB of free RAM.

The notebook clones the `main` branch of this repository. Nothing on your own machine is touched.

## Before you start

| | |
|---|---|
| **Account** | A Google account signed in to [Google Colab](https://colab.research.google.com/) |
| **Runtime** | **T4 GPU** recommended (`Runtime` → `Change runtime type`). CPU works, but each chat reply takes 30 to 60 seconds |
| **RAM** | About 12 GB free. The optional tool-calling model needs more, so use a GPU runtime for it |
| **Time** | First run takes 10 to 15 minutes: `pip install` (3 to 5 min), `ollama pull mistral` (4.5 GB), and the first React compile |

## Steps

1. **Open the notebook.** Click the **Open in Colab** badge above. Alternatively, download [`AIGoat_Colab.ipynb`](AIGoat_Colab.ipynb) and upload it with `File` → `Upload notebook`.
2. **Pick a GPU runtime.** `Runtime` → `Change runtime type` → `T4 GPU` → `Save`.
3. **Decide on the tool-calling model.** Mistral is enough for the chat and RAG labs. The agent labs, the MCP host labs, and the Agentic Kill Chain need a model that makes native tool calls. Cell **7b** pulls `qwen3.5:9b` (about 6.6 GB) and sets it as `ollama.agent_model`. Set `AGENT_MODEL = None` in that cell to skip the download.
4. **Run everything.** `Runtime` → `Run all`. The cells run top to bottom. Wait for step 12 to print **AI Goat is running!**
5. **Open the app.** Click the application link printed by step 12.

## Which URL to open

Step 12 prints addresses on **Colab's own domain**, not `localhost`. Each is an HTTPS address that contains the port number (`3000` or `8000`); Google decides the exact format and may change it:

| What | Link printed by step 12 |
|---|---|
| **AIGoat application** | `AIGoat application` (port 3000) |
| **API docs (Swagger)** | `API docs (Swagger)` (port 8000, ends in `/docs`) |
| **Agentic Kill Chain** | `Agentic Kill Chain` (the app link plus `/challenges?killchain=1`; sign in as `admin`) |

`http://localhost:3000` and `http://localhost:8000` exist only inside the Colab VM. They will not open from your browser.

The links only work in a browser signed in to the same Google account, and they stop working when the runtime disconnects. Re-run step 12 to print them again while the runtime is alive.

## Logins

| Username | Password | Role |
|---|---|---|
| `alice`, `bob`, `charlie`, `frank` | `password123` | Regular user |
| `admin` | `admin123` | Admin / staff |

The admin assistant, the RAG page, and the Agentic Kill Chain are staff-only.

## Troubleshooting

| Symptom | What to do |
|---|---|
| The app link shows a blank page or 404 | The React dev server is still compiling. Wait a minute, then reload. Read `frontend.log` with the step 13 cell |
| Chat replies time out or never arrive | You are on a CPU runtime, or the model is still loading. Switch to a T4 GPU runtime and run all cells again |
| Agent or MCP labs make no tool calls | Mistral does not emit native tool calls. The backend reads the model at startup, so set `AGENT_MODEL` in cell 7b, then `Runtime` → `Disconnect and delete runtime` and run all cells again. In the kill chain workbench, also pick the model in the **Model** dropdown |
| A cell fails with "Backend exited early" | Uncomment the `tail` lines in the step 13 cell to read `backend.log` |
| Everything stopped working after a break | Colab disconnects idle runtimes and wipes the VM. Run all cells again. Your progress and the database are not kept |

The notebook is a convenience runner for training. It inherits every intentional vulnerability of AIGoat, so do not share the Colab links with people outside your session.
