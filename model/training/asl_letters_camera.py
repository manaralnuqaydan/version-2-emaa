"""موديل الحروف الإنجليزية للكاميرا الموحدة (Holistic).

Holistic يعطي نقاط اليد بإحداثيات الصورة (بدون world landmarks)، فندرب على (x, y) فقط
بعد ما نخلي الرسغ في الأصل والمسافة للمفصل الأوسط = 1. نفس التجهيز في api.py.
يحفظ: asl_letters_camera.onnx + asl_letters_camera_classes.json + results/asl_letters_camera.json

    python training/asl_letters_camera.py        (من مجلد model، يحتاج asl_landmarks.npz)
"""
import json
import time

import numpy as np
import tensorflow as tf
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

SEED = 42
tf.keras.utils.set_random_seed(SEED)
d = np.load('asl_landmarks.npz')
x, y, names = d['x'], d['y'], [str(c) for c in d['classes']]
# حروف A-Z فقط (del وspace وnothing مو حروف)
keep = [i for i, c in enumerate(names) if len(c) == 1 and (y == i).any()]
mask = np.isin(y, keep)
x, y = x[mask], np.searchsorted(keep, y[mask])
classes = [names[i] for i in keep]


def normalize_xy(pts):
    p = pts[..., :2] - pts[..., :1, :2]
    return p / (np.linalg.norm(p[..., 9, :], axis=-1)[..., None, None] + 1e-9)


xn = normalize_xy(x).reshape(len(x), -1).astype(np.float32)
x_tr, x_te, y_tr, y_te = train_test_split(xn, y, test_size=0.2, random_state=SEED, stratify=y)
x_tr, x_va, y_tr, y_va = train_test_split(x_tr, y_tr, test_size=0.1, random_state=SEED, stratify=y_tr)


def augment(v, label):
    # ميلان بسيط للكف وتغيير حجم وضوضاء، عشان الكاميرا الحقيقية
    p = tf.reshape(v, (21, 2))
    a = tf.random.uniform([], -0.25, 0.25)
    rot = tf.stack([[tf.cos(a), -tf.sin(a)], [tf.sin(a), tf.cos(a)]])
    p = tf.matmul(p, rot) * tf.random.uniform([], 0.9, 1.1) + tf.random.normal((21, 2), 0, 0.02)
    p = p - p[:1]
    return tf.reshape(p, (42,)), label


ds = tf.data.Dataset.from_tensor_slices((x_tr, y_tr)).shuffle(4096, seed=SEED).map(augment).batch(64)
model = tf.keras.Sequential([
    tf.keras.Input((42,), name='landmarks'),
    tf.keras.layers.Dense(256, activation='relu'), tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(128, activation='relu'), tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(len(classes), activation='softmax'),
])
model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
t = time.time()
model.fit(ds, validation_data=(x_va, y_va), epochs=200, verbose=0,
          callbacks=[tf.keras.callbacks.EarlyStopping(patience=20, restore_best_weights=True)])
pred = model.predict(x_te, verbose=0).argmax(1)
pr, rc, f1, _ = precision_recall_fscore_support(y_te, pred, average='macro', zero_division=0)
summary = {'name': '2D landmarks + MLP (camera, ours)', 'accuracy': accuracy_score(y_te, pred), 'precision_macro': pr,
           'recall_macro': rc, 'f1_macro': f1, 'test_images': len(y_te), 'classes': classes,
           'train_time_min': (time.time() - t) / 60}
print(json.dumps({k: v for k, v in summary.items() if k != 'classes'}, indent=1))
json.dump(summary, open('results/asl_letters_camera.json', 'w'), indent=1)
np.save('results/asl_letters_camera_confusion.npy', confusion_matrix(y_te, pred))
json.dump(classes, open('asl_letters_camera_classes.json', 'w'))

import tf2onnx  # noqa: E402

spec = (tf.TensorSpec((None, 42), tf.float32, name='landmarks'),)
tf2onnx.convert.from_function(tf.function(lambda landmarks: model(landmarks, training=False)), input_signature=spec,
                              opset=13, output_path='asl_letters_camera.onnx')
print('✅ asl_letters_camera.onnx')
