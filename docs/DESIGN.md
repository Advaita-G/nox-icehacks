# Nox: one conversation, one room

Current user direction, November 14: the first screen is Nox. Speaking is primary. A drawing becomes the running experiment in that same space. The previous neon workbench/chat-sidebar composition is rejected.

## Direction

A quiet full-window voice room: a central Nox presence and one gesture to speak, becoming a physical experiment after the request. Matte charcoal, off-white type, neutral rules and restrained colors on physical objects. No cyan glow, orbital rings, glass cards or dashboard chrome on arrival.

Reference: an inspected [published voice-room image](https://us1.discourse-cdn.com/openai1/original/4X/5/1/e/51ede110a8a24e030e264981c36b4784495b93de.png) supplies a single focal point and sparse controls. OpenDesign's OpenAI DESIGN.md supplies neutral surfaces, restrained type and whitespace; it is a reference, not copied branding. Use installed system typography, without new dependencies.

## Flow and ownership

- `data-room=arrival`: only the central Nox entry and a discreet accessibility/keyboard alternative; no visible canvas, toolbar, file controls or text box.
- `conversation`: Nox listens and speaks; camera/upload and optional keyboard become available in context. Show the latest actual utterance, with history optional.
- `checking`: the actual normalized drawing occupies the room, with cancel/stop and real pending state. Never fabricate progress or understanding.
- `experiment`: the real simulation takes the room; Nox becomes a compact lower conversation dock. Advanced controls sit behind Tools. Spoken creation, movement, reviewed edits, Run/Pause/Save remain primary.
- Fresh browser visits begin with Nox even when a saved experiment exists; saved data remains intact and is shown by a user action.

Browser microphone consent needs one user gesture; Nox itself is that gesture. Do not start a microphone automatically. Denied/unsupported speech reveals a reachable typed alternative. Stop stays available during active work.

## Preservation and checks

Keep scene validation, cancellation identity, actual physics, source retention, model access gates and Save/reload. A local ramp/ball request creates fresh declared geometry and runs; it is not represented as fresh AI interpretation. Photo interpretation still needs a real configured provider.

Verify first view, named speech request to model/run, photo/check/reveal, reviewed edit, cancellation, keyboard fallback, persistence, reduced motion and 320/375/768/1280 layout through source, computed layout and accessibility. No audit screenshots. Record visual preference as unverified; test counts alone do not establish the intended product.

Motion execution: [voice-room motion plan](../plans/001-nox-presence-motion.md).

## Presence and spatial conversation (#25)

**The presence.** Nox's period is a ball on a drawn line, the same ball the physics scenes use. It moves only from real signals:

| Signal | Motion |
|---|---|
| Listening | The line tilts into a ramp. |
| Recognizer speech start to end | The line traces for as long as speech is detected. No audio level is implied. |
| Pending request | The ball rolls along the ramp. This means working, not progress. |
| Each spoken word boundary | The ball hops. A plain cadence stands in when a voice reports no boundaries. |
| Stop or cancel | The ball drops at once. |
| Error | The line kinks. |
| Arrival, once | The line draws in and the ball lands as the period. |

Nothing loops while Nox is idle.

**Conversation in the room.** None of these marks change physics, and they clear on the next turn, Stop or cancel.
- The part Nox is talking about gets one note anchored to it. A part outside the view keeps its note at the nearest edge.
- A reviewed, unapplied change appears as a ghost at the proposed pose or size, or as a velocity arrow. These are derived only from the proposal's operations.
- After yes, "Applied …" lands on the part, then leaves.
- The user's actual drawing lies on the floor under the model it became, then fades.

**Rules.**
- Animate transform and opacity only.
- No blur or animated shadow over the live canvas.
- The delayed-frame guard is unchanged. A one-time solver warm-up runs before a run starts.
- Reduced motion and Pause motion remove all of the movement above. State is still readable from the line, the ball's position and the text.
