# إيماء · EMAA

تطبيق ترجمة لغة الإشارة (العربية ArSL والأمريكية ASL) مع أفاتار سعودي ثلاثي الأبعاد ومساعد ذكي.

## التشغيل (أمر واحد)

يحتاج Node 20 أو أحدث و Python 3.10 أو أحدث.

```
git clone https://github.com/manaralnuqaydan/version-2-emaa.git
cd version-2-emaa
npm install
npm run dev
```

ثم افتح `http://localhost:8080`.

- `npm run dev` يشغّل الواجهة وخادم البايثون مع بعض. أول مرة يسوي بيئة بايثون في `model/.venv` ويثبت المكتبات لحاله (يأخذ دقائق مرة وحدة بس).
- كل شي يشتغل محليًا بدون إنترنت وبدون أي مفتاح API: الترجمة من الداتاسيت والموديلات المدربة بس.
- `npm run dev:web` يشغّل الواجهة لحالها لو تبي.

## ترتيب الملفات

```
src/                 الواجهة (React + TanStack + Vite)
  routes/            الصفحات: /home  /modes  /chat (نص ← إشارة)  /camera (إشارة ← نص)
  components/screens/  الشاشات (ChatScreen = نص ← إشارة، CameraScreen = إشارة ← نص)
  i18n/              نصوص العربي والإنجليزي
public/              الأفاتار avatar.fbx وأشكال اليد
model/               خادم البايثون (FastAPI)
  api.py             الخادم
  model.onnx classes.json phrases_model.pkl   الموديلات المدربة
  tests/             اختبارات الخادم
  training/          سكربتات التدريب وتجهيز الداتا (ما يحتاجها التشغيل)
scripts/dev.mjs      تشغيل الواجهة والخادم بأمر واحد
docs/                التوثيق، والملخص النهائي في docs/08-final-report.md
tests/               اختبارات الواجهة
```

## الاختبارات

```
npm test
cd model && .venv/Scripts/python -m pip install pytest httpx && .venv/Scripts/python -m pytest tests
```
(على ماك ولينكس: `.venv/bin/python` بدل `.venv/Scripts/python`)
