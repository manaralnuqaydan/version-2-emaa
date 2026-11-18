# موديل التعرف على حروف لغة الإشارة (ArASL)

الموديل شبكة CNN مدرّبة على داتا [ArASL](https://www.kaggle.com/datasets/gannayasser/arabic-alphabets-sign-language-dataset-arasl)
(54,049 صورة رمادية 64×64، 32 فئة: الحروف + ال، لا، ة). الداتا برخصة CC BY 4.0.

## التدريب

سكربتات التدريب في `training/` وتنشغّل من مجلد `model`:

```bash
pip install -r training/requirements-train.txt
# فك ضغط الداتا داخل مجلد model بحيث يكون فيه ArASL_Database_54K_Final/
python training/extract.py   # يحوّل الصور إلى data.npz
python training/train.py     # يدرّب ويحفظ model.keras و model.onnx و classes.json
```

## التشغيل

التشغيل يحتاج OpenCV فقط (بدون tensorflow ولا onnxruntime):

`npm run dev` في المجلد الرئيسي يشغّله لحاله. أو يدويًا:

```bash
pip install -r requirements.txt
uvicorn api:app --port 8000
```

الواجهة (`CameraScreen.tsx`) تكتشف اليد بـ MediaPipe في المتصفح، تقص صورة اليد 64×64،
وترسلها إلى `POST /predict-image` بالشكل `{"image": "data:image/jpeg;base64,..."}`.
الرد `{"prediction": "ب", "confidence": 97.3}`، والواجهة تجمع الحروف إلى كلمة.

## الأداء

- دقة 97.0% على 10,810 صورة اختبار من ArASL (تقسيم عشوائي، فالدقة على أشخاص جدد أمام الكاميرا قد تكون أقل).
- زمن الموديل وحده: وسيط 1.4ms، والطلب كامل عبر الـ API: وسيط 5.4ms (معالج سحابي 4 أنوية بدون GPU، `python latency.py`، النتيجة في `results/latency.json`).
- الواجهة تثبّت الحرف بعد قراءتين متتاليتين بثقة 60% فأكثر (`src/lib/arasl.ts`).

## بدون مساعد خارجي

ما فيه أي اتصال بخدمة ذكاء اصطناعي خارجية. الترجمة كلها من الموديلات المدربة وأشكال اليد في الداتاسيت،
والردود الجاهزة للعبارات المعروفة من `public/data/dataset.json`.

