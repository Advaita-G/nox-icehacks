# Third-party notices

Nox uses the following pinned components. Their authors retain their copyright and license terms.

| Component | Version | Role | License / source |
| --- | --- | --- | --- |
| Rapier3D JavaScript compatibility package | 0.21.0 | Rigid-body simulation | Apache-2.0; [license text](licenses/Rapier3D.txt), [source](https://github.com/dimforge/rapier.js) |
| Three.js | 0.186.0 | 3D rendering | MIT; [license text](licenses/Three.js.txt), [source](https://github.com/mrdoob/three.js) |
| TypeScript | 7.0.2 (root), 6.0.3 (input package) | Type checking | Apache-2.0; [source](https://github.com/microsoft/TypeScript) |
| Vite | 8.3.6 (root), 8.3.5 (input package) | Build/development server | MIT; [source](https://github.com/vitejs/vite) |
| Vitest | 5.0.5 | Input-package tests | MIT; [source](https://github.com/vitest-dev/vitest) |
| jsdom | 30.1.3 | Input-package test DOM | MIT; [source](https://github.com/jsdom/jsdom) |

Development type declarations and transitive packages are pinned in the two lockfiles; their installed packages supply their individual licenses. GPT 6 Luna/Momen and browser speech are external services, not bundled model weights. Their use and the coding assistants are disclosed in [ATTRIBUTION.md](ATTRIBUTION.md). No service credentials are included.

These notices do not grant a project-wide license to Nox's original application code. See [COPYRIGHT.md](COPYRIGHT.md).
