"""الـ API يقرأ ملفات الموديل بمسارات نسبية، فنشغّل الاختبارات من مجلد model."""
import os
import sys

MODEL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(MODEL_DIR)
sys.path.insert(0, MODEL_DIR)
sys.path.insert(0, os.path.join(MODEL_DIR, 'training'))  # asl_words_features
