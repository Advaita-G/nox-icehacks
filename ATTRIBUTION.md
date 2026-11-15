# Authors and provenance

Nox was built for IceHacks 2026 by **Advaita Gupta** ([Advaita-G](https://github.com/Advaita-G)) and **Juwon** ([juwonyu246](https://github.com/juwonyu246)).

| Contributor | Delivered work |
| --- | --- |
| Advaita Gupta | 3D physics workbench, measurements, baseline/version/checkpoint recovery, input integration, correctness review and release preparation. |
| Juwon | Canvas/photo input, AI interpretation and clarification, voice/editor, runtime integration, live input cases and drawing-first assistant interface. |
| Both | Shared contracts, UX, integration, testing, debugging and presentation. |

This public repository is a clean export of the team's private development source, initially from application commit `9e7064a85a9b89ebc523a8bb887a07d228429811`. The export preserves application modules and regression fixtures but omits private Git history, credentials, personal process instructions and team handoffs. A new repository's first commit does not replace the contributions of either teammate. Subsequent public commits identify changes made after this snapshot.

The current public live deployment uses **NVIDIA Nemotron 3.5 Super VL** through OpenRouter’s pinned `nvidia/nemotron-3.5-super-vl:free` endpoint. [Official published weights](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16) use **OpenMDW-1.1**; no model weights are bundled. [The hosted free endpoint](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free) has finite request/capacity limits and service/data terms. The server enforces zero price ceilings with no paid fallback. Momen with IceHacks credits, GPT 6 Luna, and Cloudflare-hosted Apache-2.0 [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4)/[Qwen3.8](https://huggingface.co/Qwen/Qwen3.8-27B) are historical runtime/evidence providers. The final film records the earlier real Momen session. Current and earlier results are distinguished in [verification](docs/VERIFICATION.md). **Codex** and **Claude Code** supplied significant implementation and review assistance; neither teammate claims to have trained these models or authored Rapier/Three.js.

The original workflow/checklist material was process guidance, not an existing application; it is not bundled in this public export. The included scene/source fixtures are controlled mechanism examples and captured model replies used by regression tests. They are not human acceptance for every later build.

See [third-party notices](THIRD_PARTY_NOTICES.md) and [copyright status](COPYRIGHT.md).
