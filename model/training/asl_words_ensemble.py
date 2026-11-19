"""5 نسخ من 1D-CNN (بذور مختلفة) تصوت مع بعض + مرآة الإشارة. يحفظ asl_words.onnx و results/asl_words_ensemble.json

    for s in 1 2 3 4 5; do python asl_words_train.py --seed $s --keras-out seed$s.keras; done
    python asl_words_ensemble.py
"""
import json, numpy as np, tensorflow as tf
from asl_words_features import FEATURES, FRAMES, mirror_sequence, normalize_sequence
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, top_k_accuracy_score
d=np.load('asl_citizen_landmarks.npz')
x=np.stack([normalize_sequence(s.astype(np.float32)) for s in d['x']]); y=d['y']; te=d['split']=='test'
xt, yt = x[te], y[te]; xm=np.stack([mirror_sequence(s) for s in xt])
models=[tf.keras.models.load_model(f'seed{s}.keras') for s in range(1,6)]
P=[m.predict(xt,verbose=0) for m in models]; PM=[m.predict(xm,verbose=0) for m in models]
acc=lambda p:(p.argmax(1)==yt).mean()
print('singles',[round(acc(p),4) for p in P])
e=np.mean(P,0); em=np.mean(PM,0)
print('ensemble',acc(e),'ensemble+mirror',acc(e+em),'single+mirror',[round(acc(p+q),4) for p,q in zip(P,PM)])
best=e+em
pr,rc,f1,_=precision_recall_fscore_support(yt,best.argmax(1),average='macro',zero_division=0)
json.dump({'accuracy':acc(best),'top5_accuracy':top_k_accuracy_score(yt,best,k=5,labels=range(100)),'f1_macro':f1,'precision_macro':pr,'recall_macro':rc,
 'singles':[float(acc(p)) for p in P],'ensemble_no_mirror':float(acc(e)),'test_videos':int(te.sum())},open('results/asl_words_ensemble.json','w'),indent=1)
# ONNX: متوسط الخمس نسخ في موديل واحد بنفس المدخل والمخرج
import tf2onnx
spec=(tf.TensorSpec((None,FRAMES,FEATURES),tf.float32,name='sequence'),)
tf2onnx.convert.from_function(tf.function(lambda sequence: tf.add_n([m(sequence,training=False) for m in models])/len(models)),input_signature=spec,opset=13,output_path='asl_words.onnx')
print('saved')
