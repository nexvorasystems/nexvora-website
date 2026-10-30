# OpenAI blog generation

The daily generator uses OpenAI Responses for both drafting and SEO review.
Defaults: `gpt-6-luna`, `reasoning.effort: none`, Standard processing, no paid tools.
It still creates one pillar and one support article per scheduled run.

## Configuration

- Keep `OPENAI_API_KEY` in GitHub Actions secrets.
- `ANTHROPIC_API_KEY` is no longer consumed by the daily workflow.
- The existing Notion and Replicate secrets are still required for publishing.
- Optional Actions variables `OPENAI_WRITER_MODEL` and `OPENAI_REVIEW_MODEL` override
  Luna independently. `gpt-6.1-terra` is an alternative to evaluate for editorial
  quality; both defaults support reasoning effort `none`.
- Changing an API key does not resolve an organization's enforced spending limit.

## Preview and activation

Run `node --test scripts/test/openai-text.test.js`.
For a live preview, securely supply `OPENAI_API_KEY` and run
`node scripts/generate-post.js --dry-run`.

Preview mode generates and reviews both articles, validates their output, and writes
`.preview/YYYY-MM-DD/pillar.md` and `support.md`. It does not call Notion,
generate images, update website files, or push a commit. It uses an empty article
history, so this is an output-quality preview, not a test of live keyword deduplication.

GitHub's manual workflow defaults to preview mode and uploads the previews for
seven days. Runs on branches other than main are always previews. Scheduled runs
on main publish normally. Merge only after a live preview succeeds and its writing
quality has been reviewed. To publish manually on main, uncheck the dry-run input.

Failures in authentication, billing, article review, minimum length, metadata, or
completion status stop publishing. Temporary server errors and explicit rate
limits have at most two retries. Token usage is logged per successful API call.
Both article types start with a 12,000-token output allowance per drafting/review
stage. A truncated response can retry once with a tighter word instruction and
an 18,000-token ceiling. The allowance is a cap, not a fixed token charge.
Repeated truncation fails the job instead of publishing.
Both articles must finish validation before image generation, article-file writes,
or Notion article records begin. This prevents a failed support article from leaving
a new orphaned pillar record. Existing Notion database setup/history reads still
run before text generation. Image API failures retain the existing image-free
publishing behavior; Replicate credit is separate from OpenAI billing.
Overlong SEO titles and descriptions are shortened at word boundaries before
validation; the article body is preserved.
The normal Notion history, Flux images, site formatting, and schedule are retained.
The separate AI news roundup already uses OpenAI and is outside this migration.

## Cost reference, checked October 29, 2026

USD per one million uncached input/output tokens, Standard processing:

| Model | Input | Output |
| --- | ---: | ---: |
| GPT-6 Luna | $0.10 | $0.50 |
| GPT-6.1 Terra | $1.00 | $5.00 |
| Claude Sonnet 4.6 (previous writer) | $3.00 | $15.00 |

Luna's listed token rates are 96.7% below the previous Sonnet writer. This is a
rate comparison, not a measured whole-pipeline saving: token counts differ,
there are two text passes, and image costs are separate. A hypothetical single
request with 5,000 input and 5,000 output tokens costs $0.003 on Luna, $0.03 on
Terra, or $0.09 on Sonnet. Batch/Flex can reduce eligible rates further, but the
current four-call daily workflow uses Standard processing to avoid extra batch
orchestration and preserve the sequential review flow.

Sources:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/pricing
- https://platform.claude.com/docs/en/about-claude/pricing

