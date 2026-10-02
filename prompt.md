You are working inside the existing **StegoCode** repository.

The project has evolved substantially and the documentation now needs a consolidation pass so that future agents and human readers can understand:

1. what StegoCode is actually investigating,
2. what Route A has accomplished,
3. what remains before Route A can be considered complete,
4. what Routes B and C will investigate,
5. what the eventual StegoCode end product/research outcome should look like.

This task is **DOCUMENTATION AND ROADMAP ONLY**.

Do NOT implement Route B.

Do NOT implement Route C.

Do NOT modify QR algorithms.

Do NOT modify experimental results.

Do NOT fabricate physical-test results.

Do NOT create an A5 experiment.

---

# CURRENT STATE

Route A currently consists of:

```text
A1 — COMPLETE / FROZEN
Valid ECC/mask visual-similarity baseline

A2 — COMPLETE / FROZEN
Controlled random target-directed modification

A3 — COMPLETE / FROZEN
Codeword-aware target-directed optimization
+ synthetic robustness

A4 — IMPLEMENTED
Correctness audit complete
96-configuration generalization benchmark complete
Cross-environment software audit complete
Physical test tooling complete
Physical validation PENDING USER DATA COLLECTION
```

Therefore:

```text
ROUTE A — NOT YET SCIENTIFICALLY COMPLETE
```

because real screen/print/camera observations have not yet been collected.

---

# IMPORTANT A4 RESULTS TO DOCUMENT

Preserve the actual results already produced.

A4 generalization used:

```text
8 synthetic target types
×
3 payload lengths
×
4 ECC levels
=
96 configurations
```

Targets:

```text
T01 circle
T02 G-like
T03 diagonal
T04 triangle
T05 cross
T06 sparse
T07 dense
T08 asymmetric
```

Payloads:

```text
a        = 1 UTF-8 byte
g.co     = 4 UTF-8 bytes
abcdefg  = 7 UTF-8 bytes
```

ECC:

```text
L
M
Q
H
```

Results currently include:

```text
A3_CLEAN_MAX:
96 / 96 configurations

A3_ROBUST:
94 / 96 configurations

A3 clean-max similarity gain over A1:
mean   ≈ 5.95 percentage points
median ≈ 5.44 percentage points
min    ≈ 0.91 percentage points
max    ≈ 9.07 percentage points

Matched A2 vs A3:
A3 outperformed A2: 94 / 96
tie:                 2 / 96
underperformed:      0 / 96
```

ECC median clean gains:

```text
H ≈ 9.07pp
Q ≈ 7.25pp
M ≈ 5.44pp
L ≈ 3.63pp
```

Payload lengths 1/4/7 bytes showed similar median gain in the current benchmark.

Target-structure correlations were weak in the recorded benchmark.

Synthetic robustness dataset:

```text
480 candidate configurations
×
10 presets
=
4800 cases
```

Existing software decoders:

```text
jsQR
OpenCV QRCodeDetector
```

Do not generalize these results beyond the experiment's tested conditions.

---

# IMPORTANT CORRECTNESS AUDIT RESULT

A4 discovered a real QR penalty implementation bug.

Document:

```text
A4-BUG-001
```

The Rule-3 penalty logic contained a strict-equality boolean/type error that caused Rule 3 to remain zero.

The shared implementation was corrected.

Historical consequences:

```text
QR penalty columns affected
standard-selected mask affected

decode results NOT affected
similarity results NOT affected
A3 selected default candidate NOT affected
```

After correction the recorded standard masks for the `g.co` control became:

```text
L → 3
M → 6
Q → 0
H → 2
```

Document that the bug was:

```text
found
root-caused
fixed
regression-tested
derived penalty outputs regenerated
```

Do not hide that an earlier implementation contained this error.

This is a positive example of the project's correctness-audit methodology.

---

# REWRITE THE PROJECT'S CENTRAL EXPLANATION

The project should no longer primarily describe itself as:

```text
QR cryptography experiment
```

because that is technically misleading.

The core project should be described as:

# StegoCode

**A browser-based research studio for visually integrated machine-readable codes and image steganography.**

StegoCode investigates the trade-offs among:

```text
visual appearance
machine readability
error correction
data capacity
digital robustness
camera robustness
hiddenness
```

The project has three distinct research routes.

---

# DEFINE ROUTE A CLEARLY

## Route A — Standards-Compatible Artistic QR

Research question:

> How closely can a standards-compatible QR symbol be moved toward the appearance of a target logo while ordinary QR decoders continue to recover the original payload reliably?

Normal QR decoder required:

```text
YES — ordinary QR decoder works
```

Special StegoCode decoder required:

```text
NO
```

Route A changes QR data/ECC modules while preserving mandatory QR function structure.

Its central algorithmic discovery so far is:

> At the same number of target-directed module changes, concentrating those changes into fewer Reed–Solomon/codeword symbols preserves decoding substantially better than distributing the changes randomly.

Keep this statement scoped to the project's tested configurations.

Do not claim theoretical universality.

---

# EXPLAIN A1–A4 IN PLAIN LANGUAGE

Create a concise explanation suitable for someone who has never read the experiments.

## A1

Question:

> How much logo resemblance can ordinary valid QR generation provide without altering any encoded modules?

Method:

```text
4 ECC levels
×
8 masks
```

Control baseline.

---

## A2

Question:

> What happens if we deliberately change QR modules toward the target image?

Method:

seeded random target-directed modification.

Finding:

visual similarity rises predictably, but random modifications rapidly damage decoding.

---

## A3

Question:

> Can the same visual modifications be positioned more intelligently?

Method:

pack target-directed changes into fewer QR codewords.

Important invariant:

```text
same module budget
=
same visual similarity
```

Therefore A2 and A3 differ mainly in:

```text
WHERE damage occurs
```

rather than:

```text
HOW MUCH damage occurs
```

A3 substantially extended clean decode survival under the controlled setup.

---

## A4

Question:

> Does A3's advantage survive different targets, payloads, ECC levels, environments and physical capture?

Status:

```text
software generalization — COMPLETE
synthetic robustness — COMPLETE
physical tooling — COMPLETE
physical data — PENDING
```

Do not mark Route A complete yet.

---

# DEFINE THE ROUTE A END PRODUCT

Documentation should make clear what Route A ultimately aims to provide.

Conceptual future UI:

```text
Target logo:
[ image ]

Payload:
google.com

Mode:
Standard QR Compatible

Profile:
Reliability / Balanced / Similarity

[ Generate ]

→ optimized artistic QR

Metrics:
visual similarity
ECC
modified modules
affected codewords
digital validation
synthetic robustness
physical-validation status

[ Download ]
```

The key requirement is:

> Route A output should remain readable by ordinary standards-compatible QR scanners.

StegoCode-specific scanning must NOT be necessary.

---

# EXPLAIN ROUTE A'S FUNDAMENTAL LIMITATION

Route A cannot arbitrarily become any logo.

QR has mandatory geometry including:

```text
finder patterns
timing structure
format information
dark module
quiet zone
encoded payload constraints
```

Therefore Route A is fundamentally constrained.

Its goal is NOT:

```text
turn any logo perfectly into a QR
```

Its goal is:

```text
maximize resemblance subject to standard-QR compatibility and measured robustness.
```

This limitation is the main motivation for Route B.

---

# DEFINE ROUTE B

# Route B — Custom Logo Code

Research question:

> If standard QR compatibility is abandoned, how much more closely can a machine-readable optical code resemble a natural logo while remaining practical to scan with a dedicated StegoCode decoder?

Ordinary QR compatibility:

```text
NO
```

StegoCode decoder:

```text
YES
```

Route B gives us freedom to design:

```text
registration markers
orientation
payload placement
error correction
synchronization
spatial distribution
camera recovery
custom geometry
```

without preserving QR's finder squares and placement rules.

The objective becomes:

```text
human sees:
logo-like symbol

StegoCode sees:
structured optical data
```

---

# ROUTE B ROADMAP

Keep Route B intentionally small.

## B1 — Custom Code Foundation

Design the minimum viable StegoCode optical format.

Required research components:

```text
symbol geometry
registration/orientation
payload framing
ECC
encoding
rendering
camera decoding
perspective recovery
```

Success criterion:

> A custom StegoCode symbol can encode a payload, survive basic digital/camera transformations, and decode using the StegoCode scanner.

No logo optimization yet.

---

## B2 — Logo-Constrained Encoding

Introduce target-logo adaptation.

Investigate:

```text
where encoded information can be placed
which regions may preserve target geometry
redundancy allocation
logo-aware symbol distribution
visual similarity
```

Compare against Route A.

Question:

> How much visual freedom was gained by abandoning QR compatibility?

---

## B3 — Robustness and Route A Comparison

Evaluate:

```text
digital transforms
screens
print
camera
angle
distance
lighting
multiple logo structures
multiple payloads
```

Compare:

```text
Route A
standard QR compatibility
more visual restriction

vs

Route B
custom scanner
greater expected visual freedom
```

Route B ends after B3 unless future evidence justifies more work.

Do NOT create B4–B8 automatically.

---

# DEFINE ROUTE C

# Route C — Image Steganography

Research question:

> How much information can be embedded into an ordinary image while minimizing visible change and maintaining useful robustness?

Existing system already provides a Route C baseline.

Current implementation:

```text
RGB LSB embedding
alpha skipped

STG framing
UTF-8 payload
CRC-16
CRC-8 block protection
GF(256) parity
single-symbol block repair
```

Route C differs fundamentally from Routes A/B.

Human appearance:

```text
ordinary image
```

Machine-readable visual marker:

```text
none obvious
```

---

# ROUTE C ROADMAP

Keep this small as well.

## C1 — Existing LSB Baseline

Formalize and benchmark the current protected LSB codec.

Measure:

```text
capacity
visual distortion
clean recovery
controlled corruption
```

Much of the implementation already exists.

---

## C2 — Robust Embedding

Investigate techniques intended to survive transformations that destroy raw LSB data.

Possible research families:

```text
redundant spatial embedding
block-based embedding
DCT-domain ideas
DWT-domain ideas
synchronization
stronger ECC
```

Do not preselect a final method in this documentation phase.

---

## C3 — Evaluation

Compare:

```text
visibility
capacity
JPEG survival
resize survival
crop survival
screenshot survival
camera survival where applicable
```

Produce the final Route C analysis.

---

# DEFINE THE THREE-ROUTE COMPARISON

Add a table similar to:

| Property | Route A | Route B | Route C |
|---|---|---|---|
| Human appearance | QR/logo hybrid | Logo-like custom symbol | Normal image |
| Ordinary QR scanner | Yes | No | No |
| StegoCode decoder required | No | Yes | Yes |
| Camera-oriented | Yes | Yes | Initially limited |
| Visual freedom | Limited | High | Very high |
| Hiddenness | Low/medium | Medium | High |
| Standard compatibility | QR | Custom | Custom |
| Existing implementation | Advanced | Planned | Baseline exists |

Do not frame one route as universally superior.

They serve different goals.

---

# DEFINE THE FINAL STEGOCODE STUDIO

Document the eventual project vision.

Potential application structure:

```text
StegoCode Studio

┌───────────────────────────────┐
│ Artistic QR                   │
│ Route A                       │
│ Standard scanner compatible   │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Logo Code                     │
│ Route B                       │
│ Maximum logo integration      │
│ StegoCode scanner             │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Image Steganography           │
│ Route C                       │
│ Invisible image payload       │
└───────────────────────────────┘
```

A user could eventually choose based on desired trade-off:

```text
Need normal phone QR compatibility?
→ Route A

Need symbol to look much more like the logo?
→ Route B

Need the data to be visually hidden?
→ Route C
```

---

# CRYPTOGRAPHY LAYER

Clarify that cryptography is a SEPARATE payload layer.

Conceptually:

```text
plaintext
↓
optional encryption / signature
↓
payload bytes
↓
Route A / B / C encoding
```

Possible future payload protection may include:

```text
encryption
digital signatures
authentication
tamper evidence
```

But:

```text
QR != encryption
steganography != encryption
encoding != encryption
```

Do not implement cryptography during this task.

---

# PROJECT ROADMAP AFTER THIS DOCUMENTATION PASS

Set the top-level roadmap to:

```text
FOUNDATION
Existing QR + protected LSB implementations
        ✅

ROUTE A
Standards-Compatible Artistic QR
        │
        ├─ A1 ✅
        ├─ A2 ✅
        ├─ A3 ✅
        └─ A4 ◐
             physical validation pending
        │
        ▼
Freeze Route A v1
Write/finalize Route A report

        ↓

ROUTE B
Custom Logo Code
        │
        ├─ B1 Custom-code foundation
        ├─ B2 Logo-aware encoding
        └─ B3 Robustness + Route A comparison

        ↓

ROUTE C
Image Steganography
        │
        ├─ C1 Existing baseline
        ├─ C2 Robust embedding
        └─ C3 Evaluation

        ↓

FINAL INTEGRATION
StegoCode Studio
        │
        ├─ Artistic QR
        ├─ Logo Code
        └─ Image Steganography

        ↓

OPTIONAL FUTURE
Cryptographic payload layer
```

Do not automatically create implementation phases beyond these.

---

# IMMEDIATE NEXT WORK

The immediate current task is still:

```text
A4 physical data collection
```

NOT Route B coding yet.

Documentation should explicitly show:

```text
CURRENT:
Route A / A4
Physical validation pending

NEXT AFTER A4 COMPLETION:
Route B / B1
Custom Code Foundation
```

---

# CREATE A HUMAN-READABLE "START HERE" DOCUMENT

Create:

```text
docs/START_HERE.md
```

This should explain the entire project without assuming QR/ECC knowledge.

Keep it concise.

Sections:

```text
What is StegoCode?

What problem are we exploring?

What are Routes A/B/C?

What have we learned so far?

What is currently unfinished?

What are we doing next?

What should the end product look like?
```

A new developer should understand the project direction after reading this one file.

---

# CREATE A PROJECT STATUS DOCUMENT

Create:

```text
docs/PROJECT_STATUS.md
```

Include:

```text
Current date
Current active route
Current active experiment
Implemented routes
Pending work
Known bugs
Known limitations
Next milestone
```

Current state:

```text
Active route:
A

Active experiment:
A4

Software status:
implemented

Generalization:
complete

Physical validation:
pending

Next route after A4:
Route B
```

---

# UPDATE AGENT_CONTEXT

`docs/AGENT_CONTEXT.md` should become the canonical concise context for future coding agents.

Include:

```text
PROJECT PURPOSE

THREE ROUTES

CURRENT STATE

IMPORTANT EXISTING RESULTS

FILES NOT TO CASUALLY REWRITE

KNOWN FIXED BUG:
A4-BUG-001 Rule-3

CURRENT TASK:
A4 physical validation

NEXT IMPLEMENTATION AFTER ROUTE A:
B1 custom optical-code foundation
```

Future agents should not restart Route A or invent A5.

---

# UPDATE RESEARCH_ROADMAP

Rewrite:

```text
docs/RESEARCH_ROADMAP.md
```

to emphasize the three-route structure rather than only Route A.

Use:

```text
Route A
A1–A4

Route B
B1–B3

Route C
C1–C3

Final integration
```

Clearly distinguish:

```text
implemented
current
planned
optional
```

---

# UPDATE ROOT README

The root README should answer within the first screen:

```text
What does this project do?

Why are there three routes?

What currently works?

What experiment is active?

Where should a developer start reading?
```

Link prominently to:

```text
docs/START_HERE.md
docs/PROJECT_STATUS.md
docs/RESEARCH_ROADMAP.md
```

---

# PRESERVE RESEARCH HONESTY

Do not say:

```text
Route A proven physically robust
```

because physical data has not been collected.

Use:

```text
Route A software/generalization results are complete;
physical validation remains pending.
```

Likewise do not claim:

```text
A3 universally beats random placement
```

Use the bounded finding:

> A3 outperformed the matched A2 random baseline in 94 of 96 tested software-generalization configurations and tied in 2, under the experiment's defined conditions.

---

# FINAL DOCUMENTATION VERIFICATION

After updating docs:

1. Check every Route A status reference.
2. Remove stale references to A5–A8.
3. Confirm no document says A4 is physically complete.
4. Confirm Route B is PLANNED, not implemented.
5. Confirm Route C baseline exists but robust Route C work is planned.
6. Confirm QR is not described as cryptography.
7. Confirm A4-BUG-001 is documented.
8. Confirm A1/A2/A3 remain frozen.
9. Check all documentation links.
10. Check Markdown.
11. Do not change experiment code.
12. Do not regenerate experimental data.
13. Do not commit unless explicitly instructed.

---

# REQUIRED FINAL REPORT

Return:

## Documentation added

## Documentation modified

## Project purpose summary

## Current status

## Updated roadmap

## Route A status

## Route B roadmap

## Route C roadmap

## Final StegoCode vision

## Immediate next task

Finish with exactly the conceptual state:

```text
CURRENT

Route A / A4
Physical validation pending

NEXT

Finish Route A physical validation

THEN

Route B / B1
Custom Code Foundation

LATER

Route C robust-steganography research

END GOAL

StegoCode Studio:
standard artistic QR
+
custom logo codes
+
image steganography
```