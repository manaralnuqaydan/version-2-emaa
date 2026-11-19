"""رسومات البوستر للثلاث موديلات في مجلد واحد: results/poster/

    python training/poster_charts.py     (من مجلد model، ويحتاج data.npz لصور ArASL)

1) حروف عربية (ArASL، صور): موديلنا CNN مقابل Random Forest وLogistic Regression على البكسلات
2) حروف إنجليزية (ASL Alphabet، نقاط اليد): من results/asl_summary.json
3) كلمات إنجليزية (ASL Citizen، فيديو): من training/results/asl_words_*
"""
import argparse
import json
import os
import shutil
import time

import cv2
import matplotlib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument('--arasl', default='data.npz')
args = p.parse_args()
OUT = 'results/poster'
os.makedirs(OUT, exist_ok=True)

BLUE, ORANGE, GRAY = '#2a78d6', '#eb6834', '#b9b8b1'
INK, INK2, SURFACE, GRID = '#0b0b0b', '#52514e', '#fcfcfb', '#e4e3df'
plt.rcParams.update({
    'font.size': 12, 'axes.edgecolor': INK2, 'axes.labelcolor': INK2, 'xtick.color': INK2,
    'ytick.color': INK2, 'axes.spines.top': False, 'axes.spines.right': False,
    'figure.facecolor': SURFACE, 'axes.facecolor': SURFACE, 'savefig.dpi': 200,
})


def compare_chart(rows, title, xlabel, path):
    rows = sorted(rows, key=lambda r: r['accuracy'])
    fig, ax = plt.subplots(figsize=(9, 0.8 * len(rows) + 1.4))
    yy = np.arange(len(rows))
    for label, key, color, off in [('Accuracy', 'accuracy', BLUE, 0.2), ('Macro F1', 'f1_macro', ORANGE, -0.2)]:
        vals = np.array([r[key] for r in rows]) * 100
        ax.barh(yy + off, vals, height=0.38, color=color, label=label, edgecolor=SURFACE, linewidth=2)
        for i, v in enumerate(vals):
            ax.text(v + 0.6, i + off, f'{v:.1f}%', va='center', fontsize=9, color=INK if key == 'accuracy' else INK2)
    ax.set_yticks(yy, [r['name'] for r in rows])
    for lab, r in zip(ax.get_yticklabels(), rows):
        lab.set_fontweight('bold' if 'ours' in r['name'] else 'normal')
    ax.set_xlim(0, 112)
    ax.set_xlabel(xlabel)
    ax.grid(axis='x', color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16 - 0.5 / len(rows)), ncol=2, frameon=False, fontsize=10)
    ax.set_title(title, loc='left', color=INK, fontweight='bold')
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def per_class_chart(cm, names, title, path):
    per = np.diag(cm) / np.maximum(cm.sum(1), 1) * 100
    order = np.argsort(per)
    fig, ax = plt.subplots(figsize=(9, 0.28 * len(names) + 1.5))
    ax.barh(range(len(names)), per[order], color=[ORANGE if v < np.median(per) else BLUE for v in per[order]],
            height=0.7, edgecolor=SURFACE, linewidth=1.5)
    ax.set_yticks(range(len(names)), [names[i] for i in order], fontsize=10)
    for i, v in enumerate(per[order]):
        ax.text(v + 0.5, i, f'{v:.0f}%', va='center', fontsize=8, color=INK2)
    ax.set_xlim(min(80, per.min() - 5), 104)
    ax.set_xlabel('Accuracy per sign (%)')
    ax.grid(axis='x', color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_title(title, loc='left', color=INK, fontweight='bold')
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def confusion_chart(cm, names, title, path, fontsize=8):
    cmn = cm / np.maximum(cm.sum(1, keepdims=True), 1) * 100
    fig, ax = plt.subplots(figsize=(10, 9))
    im = ax.imshow(cmn, cmap='Blues', vmin=0, vmax=100)
    ax.set_xticks(range(len(names)), names, rotation=90, fontsize=fontsize)
    ax.set_yticks(range(len(names)), names, fontsize=fontsize)
    ax.set_xlabel('Predicted')
    ax.set_ylabel('True')
    fig.colorbar(im, ax=ax, fraction=0.046, label='% of true sign')
    ax.set_title(title, loc='left', color=INK, fontweight='bold')
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def scores(name, y_true, pred, **extra):
    pr, rc, f1, _ = precision_recall_fscore_support(y_true, pred, average='macro', zero_division=0)
    return {'name': name, 'accuracy': accuracy_score(y_true, pred), 'precision_macro': pr,
            'recall_macro': rc, 'f1_macro': f1, **extra}


summary = {}

# 1) الحروف العربية: نفس تقسيم train.py (20% اختبار، random_state=42)
d = np.load(args.arasl)
x, y = d['x'], d['y']
classes = json.load(open('classes.json', encoding='utf-8'))
x_tr, x_te, y_tr, y_te = train_test_split(x, y, test_size=0.2, random_state=42, stratify=y)
net = cv2.dnn.readNetFromONNX('model.onnx')


def cnn_prob(imgs):
    out = []
    for i in range(0, len(imgs), 256):
        net.setInput(imgs[i:i + 256][..., None].astype(np.float32))
        out.append(net.forward())
    return np.concatenate(out)


t = time.time()
prob = cnn_prob(x_te) + cnn_prob(x_te[:, :, ::-1].copy())  # الصورة ومرآتها مثل api.py
lat = (time.time() - t) / len(x_te) * 1000
pred = prob.argmax(1)
ar_rows = [scores('CNN + mirror (ours)', y_te, pred, latency_ms=lat, test_images=len(y_te))]
small = lambda a: np.stack([cv2.resize(i, (16, 16), interpolation=cv2.INTER_AREA) for i in a]).reshape(len(a), -1) / 255
s_tr, s_te = small(x_tr), small(x_te)
for name, clf in [('Random Forest (pixels)', RandomForestClassifier(300, n_jobs=-1, random_state=42)),
                  ('Logistic Regression (pixels)', LogisticRegression(max_iter=300))]:
    t = time.time()
    clf.fit(s_tr, y_tr)
    ar_rows.append(scores(name, y_te, clf.predict(s_te), train_time_min=(time.time() - t) / 60))
    print(ar_rows[-1], flush=True)
summary['arabic_letters'] = {'dataset': 'ArASL (54,049 images, 32 letters)', 'split': 'random 80/20 (same signers can appear in train and test)', 'models': ar_rows}
compare_chart(ar_rows, 'Arabic letters (ArASL, 32 signs): accuracy by model',
              f'% on {len(y_te):,} test images (random 20% split of ArASL)', f'{OUT}/arabic_letters_accuracy.png')
cm = confusion_matrix(y_te, pred)
per_class_chart(cm, classes, 'Arabic letters: accuracy per letter (ours)', f'{OUT}/arabic_letters_per_letter.png')
confusion_chart(cm, classes, 'Arabic letters: confusion matrix (ours)', f'{OUT}/arabic_letters_confusion.png', 10)

# 2) الحروف الإنجليزية
en = json.load(open('results/asl_summary.json'))
en_rows = [r for r in en.values() if 'ours' not in r['name']] + [{**r, 'name': r['name'].replace(' (ours)', '')} for r in en.values() if 'ours' in r['name']]
if os.path.exists('results/asl_letters_camera.json'):  # الموديل اللي تستخدمه الكاميرا (نقاط x, y فقط)
    en_rows.append(json.load(open('results/asl_letters_camera.json')))
summary['english_letters'] = {'dataset': 'ASL Alphabet (hand landmarks)', 'models': en_rows}
compare_chart(en_rows, 'English letters (ASL Alphabet): accuracy by model',
              '% on a random 20% test split of ASL Alphabet hands', f'{OUT}/english_letters_accuracy.png')

# 3) الكلمات الإنجليزية: النتائج المحفوظة + رقم التصويت الجديد
words = {'cnn': json.load(open('training/results/asl_words_summary.json')),
         **json.load(open('training/results/asl_words_compare.json'))}
ens = json.load(open('training/results/asl_words_ensemble.json'))
words['cnn']['name'] = '1D-CNN single'
w_rows = list(words.values()) + [{'name': '5x 1D-CNN + mirror (ours)', **{k: ens[k] for k in ('accuracy', 'f1_macro')}}]
summary['english_words'] = {'dataset': 'ASL Citizen (100 words, 1290 test videos, 11 unseen signers)', 'models': w_rows}
compare_chart(w_rows, 'English words (ASL Citizen, 100 signs): accuracy by model',
              '% on 1290 test videos from 11 signers never seen in training', f'{OUT}/english_words_accuracy.png')
for f in ['asl_words_per_sign.png', 'asl_words_confusion.png', 'asl_words_accuracy_vs_latency.png']:
    shutil.copy(f'training/results/{f}', f'{OUT}/english_words_{f[len("asl_words_"):]}')

json.dump(summary, open(f'{OUT}/summary.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
lines = ['| Task | Dataset | Our model | Accuracy | Macro F1 |', '|---|---|---|---|---|']
for key, title in [('arabic_letters', 'Arabic letters'), ('english_letters', 'English letters'), ('english_words', 'English words')]:
    best = max((r for r in summary[key]['models'] if 'ours' in r['name']), key=lambda r: r['accuracy'])
    lines.append(f"| {title} | {summary[key]['dataset']} | {best['name']} | {best['accuracy']*100:.1f}% | {best['f1_macro']*100:.1f}% |")
open(f'{OUT}/table.md', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
