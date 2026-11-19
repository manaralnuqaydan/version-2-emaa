"""اختبارات الـ API بدون اتصال بالإنترنت."""
import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import api

client = TestClient(api.app)


def png_b64(img):
    ok, buf = cv2.imencode('.png', img)
    assert ok
    return 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode()


def test_root_reports_real_model_status():
    body = client.get('/').json()
    assert set(body['models']) == {'arsl_letters', 'arsl_phrases', 'asl_letters', 'asl_letters_camera', 'asl_words'}
    assert body['models']['arsl_letters'] is True
    # الحالة لازم تطابق الملفات الموجودة فعلًا، ما ندّعي موديل غير موجود
    assert body['models']['asl_words'] == (api.asl_words_net is not None)
    assert body['models']['asl_letters'] == (api.asl_net is not None)


def test_predict_image_returns_known_class():
    img = np.random.default_rng(0).integers(0, 255, (120, 120), dtype=np.uint8)
    body = client.post('/predict-image', json={'image': png_b64(img)}).json()
    assert body['prediction'] in api.classes
    assert 0 <= body['confidence'] <= 100


def test_predict_image_bad_input_does_not_crash():
    body = client.post('/predict-image', json={'image': 'not-an-image'}).json()
    assert body['confidence'] == 0


def test_predict_asl_without_model_or_bad_shape_is_empty():
    body = client.post('/predict-asl', json={'landmarks': [[0, 0, 0]] * 5}).json()
    assert body == {'prediction': '', 'confidence': 0}


@pytest.mark.skipif(api.phrase_model is None, reason='scikit-learn غير مثبت')
def test_predict_phrase():
    pts = np.random.default_rng(1).random((21, 3)).tolist()
    body = client.post('/predict-phrase', json={'landmarks': pts}).json()
    assert body['prediction'] in [str(c).replace('_', ' ') for c in api.phrase_model.classes_]
    assert client.post('/predict-phrase', json={'landmarks': pts[:3]}).json()['prediction'] == ''


def test_predict_asl_word_rejects_wrong_shape():
    body = client.post('/predict-asl-word', json={'frames': [[0.0] * 10] * 4}).json()
    assert body['prediction'] == '' and body['top'] == []


def test_no_chatbot_endpoint():
    # emaa يترجم من الداتاسيت والموديلات المحلية بس، بدون أي مساعد خارجي
    assert client.post('/chat', json={'messages': []}).status_code in (404, 405)
    assert 'chatbot' not in client.get('/').json()


def test_asl_word_names_are_readable():
    import api

    assert api.word_name('W.H.A.T') == 'what'
    assert api.word_name('THANKYOU') == 'thank you'
    assert api.word_name('BEE1') == 'bee'
    assert api.word_name('HELLO') == 'hello'


def test_hand_motion_separates_held_hand_from_moving_sign():
    import api

    held = np.zeros((32, 153), np.float32)
    held[:, 3:9] = [[-1, 0, 0, 1, 0, 0]]  # الكتفين
    held[:, 27:30] = [0.2, 0.5, 0]  # رسغ اليد اليمنى ثابت
    moving = held.copy()
    moving[:, 27] = np.linspace(-0.5, 0.5, 32)
    assert api.hand_motion(held) < 0.05
    assert api.hand_motion(moving) > 0.5


def test_asl_letter_from_camera_points_reads_either_hand():
    if api.asl_cam_net is None:
        return
    # يد مفتوحة (B): الأصابع لفوق والإبهام مطوي على الكف
    import numpy as np
    pts = np.zeros((21, 2))
    pts[1:5] = [[0.05, -0.05], [0.08, -0.1], [0.06, -0.15], [0.03, -0.18]]
    for f, x in enumerate([0.06, 0.02, -0.02, -0.06]):
        for j in range(4):
            pts[5 + 4 * f + j] = [x, -0.15 - 0.07 * j]
    # نفس اليد: اليسرى كما هي، واليمنى مرآتها
    a = client.post('/predict-asl-letter', json={'landmarks': (pts + 0.5).tolist(), 'aspect': 1, 'hand': 'left'}).json()
    b = client.post('/predict-asl-letter', json={'landmarks': (pts * [-1, 1] + 0.5).tolist(), 'aspect': 1, 'hand': 'right'}).json()
    assert a['prediction'] == b['prediction'] and a['prediction'] in api.asl_cam_classes
