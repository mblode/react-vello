---
"react-vello": patch
---

Stop React's development build logging "Expected host context to exist" on
every commit. `getRootHostContext` returned `null`, which React reads as "no
host context was pushed"; it now returns a shared sentinel object.
