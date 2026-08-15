# Qualitative vs. Quantitative Analysis

## 1. What it means

Quantitative analysis works from numbers that can be measured, computed, and audited — revenue, margins, ratios, DCF outputs. Qualitative analysis works from information that can't be reduced to a single verifiable number — management quality, competitive positioning, regulatory risk, brand strength, the *narrative* around a company. Both are inputs to a real investment decision; neither is sufficient alone.

## 2. Why investors care

Quantitative analysis tells an investor what a business *has done* and, through models, what it might be worth under stated assumptions — but the assumptions themselves (growth rate, margin trajectory, discount rate) are ultimately qualitative judgments dressed up as numbers. Two analysts can build technically identical DCF models and reach different valuations purely because they hold different qualitative views on, say, whether a company's growth is durable. Ignoring the qualitative layer doesn't make a valuation more objective — it just hides where the subjectivity actually lives.

## 3. How analysts use it

Analysts use quantitative data to build a base case, then use qualitative research (news, management commentary, competitive analysis, regulatory developments) to stress-test whether the assumptions behind that base case still hold. A strong quantitative track record with deteriorating qualitative signals (leadership turnover, regulatory scrutiny, product missteps) is a common setup for a *forward-looking* downgrade that the trailing numbers alone wouldn't yet show.

## 4. How it relates to financial statements

Financial statements are the purest form of quantitative data in investing — audited, standardized, comparable across companies. Qualitative information (news, sentiment, management tone) has no equivalent standardization; it's exactly the layer statements can't capture, which is why it has to come from a separate source (news, filings' MD&A sections, earnings call transcripts) rather than the statements themselves.

## 5. How it can affect valuation

Quantitative analysis produces a valuation *number* (DCF intrinsic value, comps-implied range). Qualitative analysis doesn't produce a competing number — it adjusts confidence in the inputs that produced that number: a qualitative red flag (leadership instability, regulatory exposure) typically translates into a wider discount rate, a more conservative growth assumption, or simply a wider band of uncertainty around the quantitative output, rather than a separate qualitative valuation.

## 6. Limitations

- **Qualitative analysis is not falsifiable in the way quantitative analysis is** — "management seems strong" can't be back-tested the way a revenue forecast can be checked against actual revenue.
- **It's more vulnerable to narrative and recency bias** — a string of positive headlines can inflate qualitative confidence beyond what the underlying business changes justify, and vice versa.
- **Automating qualitative classification (as Athena's news pipeline does) captures *category*, not *quality*** — knowing a headline is about "Leadership" says nothing about whether the leadership change is good or bad news.

## 7. How Athena uses it

Athena is explicit about keeping these two layers separate rather than blending them into one score. Sprints 1–9 built the quantitative layer (financial statements, ratios, growth, health score, DCF, comps) entirely from audited, stored data — never influenced by news. Sprint 10's News & Event Intelligence Engine adds the qualitative layer as its own independent pipeline (`backend/news/`), deterministically classified but never scored, weighted, or blended into the Financial Health Score or any valuation output. The one place the two layers meet is the AI Research Analyst's "Recent Developments" section (see `AIContextWithExternalSources.md`), which is explicitly instructed to state facts from news separately from any interpretation connecting them to Athena's existing quantitative metrics — the boundary between qualitative and quantitative is preserved even there, just made legible in prose instead of kept in separate systems.

## 8. Interview questions

1. *"Can qualitative analysis be quantified?"* — Partially, and often in a way that just relocates the subjectivity — e.g. an ESG score or a sentiment score turns a qualitative judgment into a number, but the number is only as objective as the methodology that produced it, which is itself a qualitative choice.
2. *"Why did Athena avoid building a single 'news sentiment score' for Sprint 10?"* — Because collapsing qualitative nuance into one Positive/Negative/Neutral number discards exactly the information that makes qualitative analysis valuable — a story can be positive for revenue and negative for margins at once, and a single score can't represent that; event *classification* (what kind of news this is) preserves more real signal than sentiment *scoring* (how it feels) without pretending to a precision the underlying data doesn't support. See `research/product/NewsAndEventIntelligence.md`.
