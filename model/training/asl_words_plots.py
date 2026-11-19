"""تشارتات البوستر لكلمات ASL: results/asl_words_*.png و results/asl_words_table.md

    python asl_words_plots.py
"""
import json

import matplotlib
import numpy as np

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

OUT = 'results'
BLUE, ORANGE, GRAY = '#2a78d6', '#eb6834', '#b9b8b1'
INK, INK2, SURFACE, GRID = '#0b0b0b', '#52514e', '#fcfcfb', '#e4e3df'
plt.rcParams.update({
    'font.size': 12, 'axes.edgecolor': INK2, 'axes.labelcolor': INK2, 'xtick.color': INK2,
    'ytick.color': INK2, 'axes.spines.top': False, 'axes.spines.right': False,
    'figure.facecolor': SURFACE, 'axes.facecolor': SURFACE, 'savefig.dpi': 200,
})

ours = json.load(open(f'{OUT}/asl_words_summary.json'))
ours['size_mb'] = ours['params'] * 4 / 1e6
summary = {'cnn': ours, **json.load(open(f'{OUT}/asl_words_compare.json'))}
config = json.load(open(f'{OUT}/asl_words_config.json'))
classes = config['classes']
n_test, n_signers = ours['test_videos'], ours['test_signers']
rows = sorted(summary.items(), key=lambda kv: kv[1]['accuracy'])
names = [r['name'] for _, r in rows]
mine = [k == 'cnn' for k, _ in rows]

# 1) الدقة وTop-5 وF1 لكل نموذج
fig, ax = plt.subplots(figsize=(10, 0.95 * len(rows) + 1.4))
yy = np.arange(len(rows))
series = [('Top-1 accuracy', 'accuracy', BLUE, 0.27), ('Top-5 accuracy', 'top5_accuracy', GRAY, 0),
          ('Macro F1', 'f1_macro', ORANGE, -0.27)]
for label, key, color, off in series:
    vals = np.array([r[key] for _, r in rows]) * 100
    ax.barh(yy + off, vals, height=0.25, color=color, label=label, edgecolor=SURFACE, linewidth=2)
    for i, v in enumerate(vals):
        ax.text(v + 0.6, i + off, f'{v:.1f}%', va='center', fontsize=9, color=INK if key == 'accuracy' else INK2)
ax.set_yticks(yy, names)
for lab, m in zip(ax.get_yticklabels(), mine):
    lab.set_fontweight('bold' if m else 'normal')
ax.set_xlim(0, 110)
ax.set_xlabel(f'% on {n_test} test videos from {n_signers} signers never seen in training')
ax.grid(axis='x', color=GRID, linewidth=0.8)
ax.set_axisbelow(True)
ax.legend(loc='lower right', frameon=False, fontsize=10)
ax.set_title(f'ASL words ({len(classes)} signs): accuracy by model', loc='left', color=INK, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/asl_words_accuracy.png')

# 2) الدقة مقابل السرعة
fig, ax = plt.subplots(figsize=(8, 5))
for (_, r), m in zip(rows, mine):
    ax.scatter(r['latency_ms'], r['accuracy'] * 100, s=110, color=BLUE if m else GRAY,
               edgecolor=SURFACE, linewidth=2, zorder=3)
    ax.annotate(r['name'], (r['latency_ms'], r['accuracy'] * 100), textcoords='offset points',
                xytext=(9, -4), fontsize=10, color=INK if m else INK2, fontweight='bold' if m else 'normal')
ax.set_xscale('log')
ax.set_xlabel('Latency per video on CPU (ms, log scale)')
ax.set_ylabel('Top-1 accuracy (%)')
ax.grid(color=GRID, linewidth=0.8)
ax.set_axisbelow(True)
ax.set_title('Accuracy vs speed (up and left is better)', loc='left', color=INK, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/asl_words_accuracy_vs_latency.png')

# 3) دقة كل كلمة لنموذجنا: أفضل 15 وأصعب 15
cm = np.load(f'{OUT}/asl_words_confusion.npy').astype(float)
per = np.diag(cm) / np.maximum(cm.sum(1), 1) * 100
order = np.argsort(per)
pick = np.concatenate([order[:15], order[-15:]])
fig, ax = plt.subplots(figsize=(9, 10))
vals = per[pick]
ax.barh(range(len(pick)), vals, color=[ORANGE] * 15 + [BLUE] * 15, height=0.7, edgecolor=SURFACE, linewidth=2)
ax.set_yticks(range(len(pick)), [classes[i] for i in pick], fontsize=10)
for i, v in enumerate(vals):
    ax.text(v + 1, i, f'{v:.0f}%', va='center', fontsize=9, color=INK2)
ax.axhline(14.5, color=INK2, linewidth=0.8, linestyle='--')
ax.set_xlim(0, 112)
ax.set_xlabel('Accuracy per sign (%)')
ax.grid(axis='x', color=GRID, linewidth=0.8)
ax.set_axisbelow(True)
ax.set_title('Easiest 15 (blue) and hardest 15 (orange) signs', loc='left', color=INK, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/asl_words_per_sign.png')

# 4) مصفوفة الالتباس لنموذجنا (100×100)
cmn = cm / np.maximum(cm.sum(1, keepdims=True), 1) * 100
fig, ax = plt.subplots(figsize=(11, 10))
im = ax.imshow(cmn, cmap='Blues', vmin=0, vmax=100)
ax.set_xticks(range(len(classes)), classes, rotation=90, fontsize=4.5)
ax.set_yticks(range(len(classes)), classes, fontsize=4.5)
ax.set_xlabel('Predicted sign')
ax.set_ylabel('True sign')
fig.colorbar(im, ax=ax, fraction=0.046, label='% of true sign')
ax.set_title(f'Confusion matrix: {ours["name"]}', loc='left', color=INK, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/asl_words_confusion.png')

# 5) جدول
lines = ['| Model | Top-1 | Top-5 | Precision | Recall | Macro F1 | Latency (ms) | Size (MB) | Train (min) |',
         '|---|---|---|---|---|---|---|---|---|']
for _, r in reversed(rows):
    lines.append(f"| {r['name']} | {r['accuracy']*100:.1f}% | {r['top5_accuracy']*100:.1f}% | "
                 f"{r['precision_macro']*100:.1f}% | {r['recall_macro']*100:.1f}% | {r['f1_macro']*100:.1f}% | "
                 f"{r['latency_ms']:.1f} | {r['size_mb']:.1f} | {r['train_time_min']:.1f} |")
lines.append(f'\nASL Citizen subset: {len(classes)} signs, official signer-independent split, '
             f'{n_test} test videos from {n_signers} unseen signers.')
open(f'{OUT}/asl_words_table.md', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
