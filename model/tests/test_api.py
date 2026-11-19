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
    assert set(body['models']) == {'arsl_letters', 'arsl_phrases', 'asl_letters', 'asl_words'}
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
