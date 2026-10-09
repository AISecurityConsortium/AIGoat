## How to Run AIGoat Colab Notebook

Follow these steps to get the AIGoat Colab notebook up and running:

1.  **Download the Notebook:**
    *   Download the `AIGoat_Colab.ipynb` file directly from its GitHub location: `https://github.com/AISecurityConsortium/AIGoat/blob/main/colab_notebooks/AIGoat_Colab.ipynb`

2.  **Access Google Colab:**
    *   Log in to your Google account and navigate to the Google Colab platform: `https://colab.research.google.com/`.

3.  **Upload the Notebook to Colab:**
    *   Once in Colab, go to `File` in the top menu.
    *   Select `Upload Notebook`.
    *   Choose the `AIGoat_Colab.ipynb` file that you downloaded in the first step.

4.  **Execute All Cells:**
    *   After the notebook has finished loading in Colab, Select `Runtime` to GPU.
    *   Select `Run all` to execute every cell in the notebook sequentially.

5.  **Optional: add a tool-calling model:**
    *   The notebook installs Mistral, which is enough for the chat and RAG labs.
    *   The agent labs, the MCP host labs and the Agentic Kill Chain work best with a tool-capable model. Run the optional cell "7b" (`qwen3.5:9b`, about 6.6 GB) before the backend starts. A GPU runtime is recommended.

6.  **Open the app:**
    *   Click the link printed by the last cell. Log in with `alice / password123` (also `bob`, `charlie`, `frank`) or `admin / admin123`. The admin assistant, the RAG page and the Agentic Kill Chain (`/challenges?killchain=1`) are staff-only.
