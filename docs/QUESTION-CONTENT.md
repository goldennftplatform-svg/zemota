# Question Content

Add reviewed content to `src/data/triviaAdditional.json`. It is a JSON array, imported automatically; no engine edits or registration counts are needed. Run `npm run validate:content`, `npm run test:package`, then `npm run build`. Builds reject invalid content.

Each row has `id` (unique across every bank, lowercase letters/digits/underscore/hyphen, maximum 80 characters), `q` (nonempty question), `choices` (two to four distinct nonempty strings; True/False rows use exactly `["True", "False"]`), `answer` (zero-based integer index of the correct choice before shuffling), `teach` (nonempty explanation), and `endgameWeight` (integer 0-5). Choices are shuffled deterministically by stable ID, except True/False rows, which are kept in canonical `True, False` order so the prompt reads naturally. One-option questions (and empty or duplicate answers) are rejected before shuffling. Do not change IDs when correcting punctuation; use a new ID when replacing the substance of a question.

Nonhistorical format example only, NOT a question to publish:

```json
{
  "id": "example_format_only",
  "q": "Which word appears first in this example: wagon, river, canvas, wheel?",
  "choices": ["wagon", "river", "canvas", "wheel"],
  "answer": 0,
  "teach": "This demonstrates the format, not a historical claim.",
  "endgameWeight": 0
}
```

Before publishing historical additions, record a museum/source citation and reviewer in the content change description. Do not infer historical facts from game balance or synthetic examples. The shipped extra file is the full master bank (the user-approved EMOTA trivia list). New questions become eligible immediately after an update; retired IDs are discarded.

Seen IDs persist per run and are filtered against the loaded bank, not truncated at 300. New questions become eligible immediately after an update; retired IDs are discarded. Missing seen-ID fields in older v1 saves restore as empty. Previously truncated saves cannot recover IDs that were already lost. After the entire bank is exhausted, the existing new-cycle behavior allows repeats. `test:package` adds 250 synthetic four-option entries to the in-memory imported JSON content, then runs the actual startup `buildTriviaBank()` validation/finalization/shuffle pipeline. It checks deterministic shuffling and correct-answer preservation, selects each question without repetition, and round-trips all IDs through the real engine save loader. Tests do not modify the content file on disk.
