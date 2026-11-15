# Authors and provenance

Nox was built for IceHacks 2026 by **Advaita Gupta** ([Advaita-G](https://github.com/Advaita-G)) and **Juwon** ([juwonyu246](https://github.com/juwonyu246)).

| Contributor | Delivered work |
| --- | --- |
| Advaita Gupta | 3D physics workbench, measurements, baseline/version/checkpoint recovery, input integration, correctness review and release preparation. |
| Juwon | Canvas/photo input, AI interpretation and clarification, voice/editor, runtime integration, live input cases and drawing-first assistant interface. |
| Both | Shared contracts, UX, integration, testing, debugging and presentation. |

This public repository is a clean export of the team's private development source, initially from application commit `9e7064a85a9b89ebc523a8bb887a07d228429811`. The export preserves application modules and regression fixtures but omits private Git history, credentials, personal process instructions and team handoffs. A new repository's first commit does not replace the contributions of either teammate. Subsequent public commits identify changes made after this snapshot.

The restored review deployment uses **Momen** with existing IceHacks participant credits; the latest recovery checks did not query the configured model, so they do not assert a new model name. Stable production and the earlier 113-second film use **Gemma 4 26B A4B hosted directly by Cloudflare Workers AI** ([hosted model](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/), [official model source](https://ai.google.dev/gemma/docs/core/model_card_4), [Apache 2.0 weight licence](https://ai.google.dev/gemma/apache_2)). Earlier Cloudflare attempts used [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), also [Apache 2.0](https://huggingface.co/Qwen/Qwen3.8-27B/resolve/main/LICENSE), Copyright 2026 Alibaba Cloud. Model weights are not bundled. Earlier recorded interpretation cases used **GPT 6 Luna through Momen**. The Momen failures, recovery and current-provider receipts are distinguished in [verification](docs/VERIFICATION.md). **Codex** and **Claude Code** supplied significant implementation and review assistance; the team remains responsible for the code, tests, physical model and claims. Neither teammate claims to have trained the foundation model or authored Rapier/Three.js.

The original workflow/checklist material was process guidance, not an existing application; it is not bundled in this public export. The included scene/source fixtures are controlled mechanism examples and captured model replies used by regression tests. They are not human acceptance for every later build.

See [third-party notices](THIRD_PARTY_NOTICES.md) and [copyright status](COPYRIGHT.md).
