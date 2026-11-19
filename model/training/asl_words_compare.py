"""مقارنة نماذج مشين ليرننق على كلمات ASL Citizen (نفس التقسيم الرسمي، أشخاص الاختبار ما شافهم أي نموذج).

يقارن بنموذجنا الأساسي (1D-CNN من asl_words_train.py):
  Logistic Regression, k-NN, Random Forest, SVM (RBF)  على ملخص زمني للحركة
  BiGRU                                               على التسلسل كامل
يحفظ: results/asl_words_compare.json و results/asl_words_<model>_confusion.npy

    python asl_words_compare.py --data asl_citizen_landmarks.npz
"""
import argparse
import json
import os
import pickle
import time

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, precision_recall_fscore_support,
                             top_k_accuracy_score)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from asl_words_features import FEATURES, FRAMES, mirror_sequence, normalize_sequence

p = argparse.ArgumentParser()
p.add_argument('--data', default='asl_citizen_landmarks.npz')
p.add_argument('--seed', type=int, default=42)
p.add_argument('--skip-gru', action='store_true')
args = p.parse_args()
os.makedirs('results', exist_ok=True)

d = np.load(args.data)
x = np.stack([normalize_sequence(s.astype(np.float32)) for s in d['x']])
y, split, user, classes = d['y'], d['split'], d['user'], [str(c) for c in d['classes']]
tr, va, te = split == 'train', split == 'val', split == 'test'
assert not set(user[tr]) & set(user[te]), 'أشخاص مشتركين بين التدريب والاختبار'
labels = range(len(classes))


def summarize(seqs):
    # متوسط وانحراف الحركة + متوسط كل ربع من الفيديو (يحفظ ترتيب الحركة تقريبًا)
    parts = [seqs.mean(1), seqs.std(1)] + [c.mean(1) for c in np.array_split(seqs, 4, axis=1)]
    return np.concatenate(parts, axis=1)


# نضيف نسخة مرآة من التدريب (أعسر ↔ أيمن) مثل نموذجنا الأساسي
x_tr = np.concatenate([x[tr], np.stack([mirror_sequence(s) for s in x[tr]])])
y_tr = np.concatenate([y[tr], y[tr]])
f_tr, f_te = summarize(x_tr), summarize(x[te])


def latency_ms(predict, sample_fn, n=100):
    predict(sample_fn(0))  # تسخين
    t = time.time()
    for i in range(n):
        predict(sample_fn(i))
    return (time.time() - t) / n * 1000


def score(key, name, prob, train_time, lat, size_mb, params=None):
    pred = prob.argmax(1)
    pr, rc, f1, _ = precision_recall_fscore_support(y[te], pred, average='macro', zero_division=0)
    np.save(f'results/asl_words_{key}_confusion.npy', confusion_matrix(y[te], pred, labels=list(labels)))
    r = {'name': name, 'accuracy': accuracy_score(y[te], pred),
         'top5_accuracy': top_k_accuracy_score(y[te], prob, k=5, labels=list(labels)),
         'precision_macro': pr, 'recall_macro': rc, 'f1_macro': f1,
         'latency_ms': lat, 'size_mb': size_mb, 'params': params, 'train_time_min': train_time / 60}
    print(key, json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in r.items()}), flush=True)
    return r


results = {}
classic = {
    'logreg': ('Logistic Regression', make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=0.5))),
    'knn': ('k-NN (k=5)', make_pipeline(StandardScaler(), KNeighborsClassifier(5, weights='distance'))),
    'rf': ('Random Forest', RandomForestClassifier(500, n_jobs=-1, random_state=args.seed)),
    'svm': ('SVM (RBF)', make_pipeline(StandardScaler(), SVC(C=10, probability=True, random_state=args.seed))),
}
for key, (name, clf) in classic.items():
    t = time.time()
    clf.fit(f_tr, y_tr)
    train_time = time.time() - t
    prob = clf.predict_proba(f_te)
    lat = latency_ms(clf.predict_proba, lambda i: summarize(x[te][i:i + 1]))
    results[key] = score(key, name, prob, train_time, lat, len(pickle.dumps(clf)) / 1e6)

if not args.skip_gru:
    import tensorflow as tf

    tf.keras.utils.set_random_seed(args.seed)
    inp = tf.keras.Input((FRAMES, FEATURES))
    h = tf.keras.layers.Masking(0.0)(inp)
    h = tf.keras.layers.Bidirectional(tf.keras.layers.GRU(128, return_sequences=True))(h)
    h = tf.keras.layers.Bidirectional(tf.keras.layers.GRU(128))(h)
    h = tf.keras.layers.Dropout(0.4)(h)
    model = tf.keras.Model(inp, tf.keras.layers.Dense(len(classes), activation='softmax')(h))
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    t = time.time()
    model.fit(x_tr, y_tr, validation_data=(x[va], y[va]), epochs=120, batch_size=64, verbose=2,
              callbacks=[tf.keras.callbacks.ReduceLROnPlateau(patience=6, factor=0.5),
                         tf.keras.callbacks.EarlyStopping(patience=15, restore_best_weights=True)])
    train_time = time.time() - t
    fn = tf.function(lambda a: model(a, training=False))
    lat = latency_ms(fn, lambda i: x[te][i:i + 1])
    results['bigru'] = score('bigru', 'BiGRU (sequence)', model.predict(x[te], verbose=0), train_time, lat,
                             model.count_params() * 4 / 1e6, int(model.count_params()))

json.dump(results, open('results/asl_words_compare.json', 'w'), indent=1)
print('✅ results/asl_words_compare.json')
