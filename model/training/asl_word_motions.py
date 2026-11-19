"""حركة الأفاتار لكلمات ASL: يختار لكل كلمة فيديو حقيقي يمثلها من ASL Citizen ويحفظ حركة اليدين.

لكل كلمة: من فيديوهات التدريب، الفيديو الأقرب لبقية فيديوهات نفس الكلمة (medoid)،
ونحفظ لكل لقطة: مكان الرسغ نسبة للكتفين + شكل اليد (21 نقطة) لليدين.
الأشخاص اللي يأشرون باليسار نعكسهم عشان الأفاتار يأشر دائمًا باليد اليمنى.

الملف الناتج مشتق من ASL Citizen (ترخيص غير تجاري بدون إعادة نشر)، فهو في .gitignore
وينحط يدويًا في public/data على جهاز العرض.

    python training/asl_word_motions.py --data training/asl_citizen_landmarks.npz
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asl_words_features import N_POSE, mirror_sequence, normalize_sequence, word_name  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument('--data', default='training/asl_citizen_landmarks.npz')
p.add_argument('--out', default='../public/data/asl_word_motions.json')
args = p.parse_args()

d = np.load(args.data)
X, Y, split, classes = d['x'].astype(np.float32), d['y'], d['split'], [str(c) for c in d['classes']]
R0, L0 = N_POSE, N_POSE + 21
L_SH, R_SH, L_WR, R_WR = 1, 2, 5, 6  # داخل POSE_IDS
PALM = [(0, 5), (5, 9), (9, 13), (13, 17), (0, 17)]


def present(pts, a, b):
    return np.abs(pts[:, a:b]).sum(axis=(1, 2)) > 0


def aspect(pts, a):
    # x مقسوم على عرض الفيديو وy على طوله: نختار النسبة اللي تخلي عظام الكف ثابتة الطول
    hand = pts[present(pts, a, a + 21), a:a + 21]
    if len(hand) < 4:
        return 4 / 3
    best, score = 4 / 3, 1e9
    for r in (1.0, 4 / 3, 16 / 9):
        h = hand * np.array([r, 1, r])
        lens = np.stack([np.linalg.norm(h[:, i] - h[:, j], axis=1) for i, j in PALM], 1)
        cv = (lens.std(0) / (lens.mean(0) + 1e-9)).mean()
        if cv < score:
            best, score = r, cv
    return best


def fill(arr, ok):
    # اللقطات اللي ما انكشفت فيها اليد: نكمّلها بأقرب لقطة موجودة
    idx = np.where(ok)[0]
    near = idx[np.abs(np.arange(len(arr))[:, None] - idx[None]).argmin(1)]
    return arr[near]


def smooth(arr):
    out = arr.copy()
    out[1:-1] = (arr[:-2] + 2 * arr[1:-1] + arr[2:]) / 4
    return out


def motion(seq):
    pts = seq.reshape(len(seq), -1, 3)
    # اليد المسيطرة هي الأكثر ظهورًا؛ إذا كانت اليسار نعكس الفيديو
    if present(pts, L0, L0 + 21).sum() > present(pts, R0, R0 + 21).sum():
        pts = mirror_sequence(seq).reshape(len(seq), -1, 3)
    right = present(pts, R0, R0 + 21)
    if right.sum() < 8 or not (present(pts, L_SH, L_SH + 1) & present(pts, R_SH, R_SH + 1)).any():
        return None
    first, last = np.where(right)[0][[0, -1]]
    pts = pts[first:last + 1]
    r = aspect(pts, R0)
    pts = pts * np.array([r, 1, r], np.float32)
    sh = pts[:, [L_SH, R_SH]]
    sh_ok = np.abs(sh).sum(axis=(1, 2)) > 0
    center = sh[sh_ok].mean(axis=(0, 1))
    width = np.linalg.norm(sh[sh_ok, 0, :2] - sh[sh_ok, 1, :2], axis=1).mean()

    def side(a, wrist_id):
        ok = present(pts, a, a + 21)
        if ok.mean() < 0.4:
            return None
        hand = fill(pts[:, a:a + 21], ok)
        wrist = (hand[:, 0] - center) / width  # مكان الرسغ نسبة لمنتصف الكتفين وعرضهم
        shape = hand - hand[:, :1]
        shape /= np.linalg.norm(shape[:, 9], axis=1)[:, None, None] + 1e-9
        return {'wrist': np.round(smooth(wrist).astype(float), 3).tolist(), 'hand': np.round(smooth(shape).astype(float), 2).tolist()}

    return {'right': side(R0, R_WR), 'left': side(L0, L_WR)}


train = np.isin(split, ['train', 'val'])
out = {}
for c, name in enumerate(classes):
    ids = np.where(train & (Y == c))[0]
    norm = np.stack([normalize_sequence(X[i]) for i in ids])
    # medoid: أقرب فيديو لبقية فيديوهات نفس الكلمة
    dist = np.linalg.norm((norm[:, None] - norm[None]).reshape(len(ids), len(ids), -1), axis=2)
    for i in ids[np.argsort(dist.mean(1))]:
        m = motion(X[i])
        if m and m['right']:
            out[word_name(name)] = m
            break
    print(f'{word_name(name):>14}', 'two hands' if out.get(word_name(name), {}).get('left') else '')

os.makedirs(os.path.dirname(args.out), exist_ok=True)
json.dump(out, open(args.out, 'w'), separators=(',', ':'))
print(f'✅ {args.out}: {len(out)} words, {os.path.getsize(args.out) / 1e6:.1f} MB')
